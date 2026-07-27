import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { pdf } from '@react-pdf/renderer';
import { supabase } from '@/config/supabase';
import { getMonthlyReportPeriodData, updateMonthlyReport, approveMonthlyReport } from '@/services/monthlyReportEnhanced.service';
import MonthlyReportPDF from '@/components/pdf/MonthlyReportPDF';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Select from '@/components/ui/Select';
import { getUserSignatureForPDF } from '@/services/userSignatures.service';
import { ArrowLeft, AlertCircle, Check } from 'lucide-react';

const STATUS_BADGE: Record<string, 'default' | 'success' | 'warning' | 'info'> = {
  draft: 'default', generated: 'warning', reviewed: 'warning', approved: 'info', sent: 'success',
};
const STATUS_LABELS: Record<string, string> = { draft: 'Borrador', generated: 'Generado', reviewed: 'Revisado', approved: 'Aprobado', sent: 'Enviado' };
const MONTH_NAMES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function MonthlyReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<any>(null);
  const [periodData, setPeriodData] = useState<any>(null);
  const [recipients, setRecipients] = useState<Array<{ id: string; name: string; email: string; role_label?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [generalStatus, setGeneralStatus] = useState('operativo');
  const [generalNotes, setGeneralNotes] = useState('');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveNotes, setApproveNotes] = useState('');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState('');

  useEffect(() => { if (id) loadReport(); }, [id]);

  const loadReport = async () => {
    if (!id) return;
    try {
      const { data: r } = await supabase.from('monthly_reports').select('*').eq('id', id).single();
      if (r) {
        // Load approver profile separately
        let approvedByProfile = null;
        if (r.approved_by) {
          const { data: profile } = await supabase.from('profiles').select('full_name, email').eq('id', r.approved_by).single();
          approvedByProfile = profile;
        }
        r.approved_by_profile = approvedByProfile;

        // Load related entities separately
        let elevator = null;
        if (r.elevator_id) {
          const { data: e } = await supabase.from('elevators').select('id, code, building:buildings(id, name, address, client:clients(name))').eq('id', r.elevator_id).single();
          elevator = e;
        }
        r.elevator = elevator;

        setReport(r);
        setGeneralStatus(r.general_status || 'operativo');
        setGeneralNotes(r.general_notes || '');
        // Load period data
        if (r.elevator_id && r.report_month && r.report_year) {
          const pd = await getMonthlyReportPeriodData(r.elevator_id, r.report_year, r.report_month);
          setPeriodData(pd);
        }
        // Load recipients from building_recipients
        if (r.building_id) {
          const { data: recs } = await supabase
            .from('building_recipients')
            .select('id, full_name, email, role_label')
            .eq('building_id', r.building_id)
            .eq('active', true)
            .eq('receives_monthly_reports', true)
            .or(`elevator_id.is.null,elevator_id.eq.${r.elevator_id}`);
          setRecipients((recs || []).map((c: any) => ({ id: c.id, name: c.full_name, email: c.email, role_label: c.role_label })));
        }
      }
    } catch (err: any) { setError(err?.message || 'Error'); } finally { setLoading(false); }
  };

  const handleGeneratePDF = async () => {
    if (!report) return;
    setGenerating(true); setError(''); setSuccess('');
    try {
      await updateMonthlyReport(report.id, { general_status: generalStatus, general_notes: generalNotes });
      const nextVersion = (report.pdf_version || 0) + 1;
      const sigData = await getUserSignatureForPDF(report.created_by, 'administrator');
      const approverName = (report as any).approved_by_profile?.full_name;
      const reportWithVersion = { ...report, pdf_version: nextVersion };

      const blob = await pdf(
        <MonthlyReportPDF
          report={reportWithVersion}
          maintenances={periodData?.maintenances || []}
          serviceOrders={periodData?.serviceOrders || []}
          claims={periodData?.claims || []}
          summary={periodData?.summary || { preventiveCount: 0, correctiveCount: 0, serviceOrderCount: 0, claimCount: 0, totalApproved: 0, totalWithCorrections: 0, firstDate: null, lastDate: null }}
          signatureUrl={sigData?.signedUrl || undefined}
          signerName={approverName || undefined}
        />
      ).toBlob();

      // Upload to storage
      const arrayBuffer = await blob.arrayBuffer();
      const pdfBase64 = btoa(new Uint8Array(arrayBuffer).reduce((d, b) => d + String.fromCharCode(b), ''));
      const version = (report.pdf_version || 0) + 1;
      const storagePath = `monthly-reports/${report.report_year}/${report.report_month}/${report.elevator_id}/informe-${report.report_year}-${String(report.report_month).padStart(2, '0')}-v${version}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from('service-order-reports')
        .upload(storagePath, new Blob([Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0))], { type: 'application/pdf' }), { contentType: 'application/pdf', upsert: true });

      if (uploadError) throw uploadError;

      // Update report
      await supabase.from('monthly_reports').update({
        pdf_url: storagePath, pdf_storage_path: storagePath,
        pdf_version: version, pdf_generated_at: new Date().toISOString(),
        status: 'generated', updated_at: new Date().toISOString(),
      }).eq('id', report.id);

      setSuccess(`PDF versión ${version} generado correctamente`);
      await loadReport();
    } catch (err: any) { setError('Error al generar PDF: ' + (err?.message || '')); }
    finally { setGenerating(false); }
  };

  const handleViewPDF = async () => {
    if (!report?.pdf_url) return;
    const { data } = await supabase.storage.from('service-order-reports').createSignedUrl(report.pdf_url, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const handleDownloadPDF = async () => {
    if (!report?.pdf_url) return;
    const { data } = await supabase.storage.from('service-order-reports').createSignedUrl(report.pdf_url, 3600);
    if (!data?.signedUrl) return;
    const response = await fetch(data.signedUrl);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `informe-mensual-${report.report_year}-${String(report.report_month).padStart(2, '0')}-v${report.pdf_version || 1}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  };

  const handleApprove = async () => {
    if (!report) return;
    try {
      await approveMonthlyReport(report.id);
      setShowApproveModal(false);
      setSuccess('Informe aprobado correctamente');
      await loadReport();
    } catch (err: any) { setError(err?.message || 'Error al aprobar'); }
  };

  const handleSendEmail = async () => {
    if (!report) return;
    setEmailSending(true); setEmailResult('');
    try {
      const result = await supabase.functions.invoke('send-monthly-report-email', {
        body: {
          monthly_report_id: report.id,
          recipients: recipients.map(r => ({ email: r.email, name: r.name })),
          subject: `SICOM Patagonia — Informe mensual ${elevator?.code || ''} — ${MONTH_NAMES[report.report_month || 0]} ${report.report_year}`,
          body: `Adjuntamos el informe mensual correspondiente a ${elevator?.code || ''} del período ${MONTH_NAMES[report.report_month || 0]} ${report.report_year}.`,
        },
      });
      if (result.error) throw new Error(result.error);
      setEmailResult('Informe enviado correctamente');
      await loadReport();
    } catch (err: any) {
      setEmailResult('Error: ' + (err?.message || ''));
    } finally { setEmailSending(false); }
  };

  if (loading) return <DashboardLayout role="admin" title="Informe Mensual"><div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" /></div></DashboardLayout>;
  if (!report) return <DashboardLayout role="admin" title="Informe Mensual"><div className="text-center py-8"><p className="text-gray-500">Informe no encontrado</p></div></DashboardLayout>;

  const elevator = report.elevator as any;
  const monthLabel = MONTH_NAMES[report.report_month || 0] + ' ' + report.report_year;

  return (
    <DashboardLayout role="admin" title={`Informe ${monthLabel}`}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/admin/informes-mensuales')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900"><ArrowLeft size={18} /> Volver</button>
          <Badge variant={STATUS_BADGE[report.status]}>{STATUS_LABELS[report.status]}</Badge>
        </div>

        {error && <div className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}
        {success && <div className="p-3 bg-success/10 border border-success/30 rounded text-success text-sm flex items-center gap-2"><Check size={16} /> {success}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card><CardHeader><h3 className="font-semibold">Datos del Informe</h3></CardHeader><CardContent className="space-y-2 text-sm">
              <div><span className="text-gray-500">Período: </span>{monthLabel}</div>
              <div><span className="text-gray-500">Ascensor: </span>{elevator?.code || '-'}</div>
              <div><span className="text-gray-500">Edificio: </span>{elevator?.building?.name || '-'}</div>
              <div><span className="text-gray-500">Cliente: </span>{elevator?.building?.client?.name || '-'}</div>
            </CardContent></Card>

            {periodData && (
              <Card><CardHeader><h3 className="font-semibold">Resumen del Período</h3></CardHeader><CardContent>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-2 bg-gray-50 rounded"><p className="text-xl font-bold">{periodData.summary.preventiveCount}</p><p className="text-xs text-gray-500">Preventivos</p></div>
                  <div className="p-2 bg-gray-50 rounded"><p className="text-xl font-bold">{periodData.summary.correctiveCount}</p><p className="text-xs text-gray-500">Correctivos</p></div>
                  <div className="p-2 bg-gray-50 rounded"><p className="text-xl font-bold">{periodData.summary.serviceOrderCount}</p><p className="text-xs text-gray-500">Órdenes</p></div>
                  <div className="p-2 bg-gray-50 rounded"><p className="text-xl font-bold">{periodData.summary.claimCount}</p><p className="text-xs text-gray-500">Reclamos</p></div>
                  <div className="p-2 bg-gray-50 rounded"><p className="text-xl font-bold">{periodData.summary.totalApproved}</p><p className="text-xs text-gray-500">Aprobados</p></div>
                  <div className="p-2 bg-gray-50 rounded"><p className="text-xl font-bold">{periodData.summary.totalWithCorrections}</p><p className="text-xs text-gray-500">Con correcciones</p></div>
                </div>
              </CardContent></Card>
            )}

            <Card><CardHeader><h3 className="font-semibold">Estado General</h3></CardHeader><CardContent className="space-y-3">
              <Select label="Estado del mes" options={[{ value: 'operativo', label: 'Operativo' }, { value: 'operativo_con_observaciones', label: 'Operativo con observaciones' }, { value: 'requiere_seguimiento', label: 'Requiere seguimiento' }, { value: 'fuera_de_servicio', label: 'Fuera de servicio' }]} value={generalStatus} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setGeneralStatus(e.target.value)} />
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Observación general</label><textarea className="w-full border rounded px-3 py-2 text-sm resize-none" rows={3} value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)} placeholder="Observaciones del período..." /></div>
            </CardContent></Card>
          </div>

          <div className="space-y-6">
            <Card><CardHeader><h3 className="font-semibold">PDF</h3></CardHeader><CardContent>
              {report.pdf_url ? (
                <div className="space-y-2">
                  <p className="text-sm text-success font-medium">PDF v{report.pdf_version} generado</p>
                  <Button className="w-full" variant="outline" onClick={handleViewPDF}>Ver PDF</Button>
                  <Button className="w-full" variant="outline" onClick={handleDownloadPDF}>Descargar PDF</Button>
                  <Button className="w-full" onClick={handleGeneratePDF} disabled={generating}>{generating ? 'Regenerando...' : 'Regenerar PDF'}</Button>
                </div>
              ) : (
                <Button className="w-full" onClick={handleGeneratePDF} disabled={generating}>{generating ? 'Generando...' : 'Generar y Guardar PDF'}</Button>
              )}
            </CardContent></Card>

            {report.pdf_url && report.status === 'generated' && (
              <Card><CardHeader><h3 className="font-semibold">Aprobación</h3></CardHeader><CardContent>
                <p className="text-sm text-gray-600 mb-3">Revisá el informe y aprobalo para habilitar el envío.</p>
                <Button className="w-full" onClick={() => setShowApproveModal(true)}>Aprobar informe</Button>
              </CardContent></Card>
            )}

            {report.pdf_url && report.status === 'approved' && recipients.length > 0 && (
              <Card><CardHeader><h3 className="font-semibold">Enviar por Correo</h3></CardHeader><CardContent>
                <p className="text-sm text-gray-600 mb-3">Enviar el informe a {recipients.length} destinatario(s).</p>
                <Button className="w-full" onClick={() => setShowEmailModal(true)}>Enviar por correo</Button>
              </CardContent></Card>
            )}

            <Card><CardHeader><h3 className="font-semibold">Destinatarios ({recipients.length})</h3></CardHeader><CardContent>
              {recipients.length === 0 ? (
                <p className="text-sm text-gray-500">No hay destinatarios configurados para informes mensuales.</p>
              ) : (
                <div className="space-y-2">
                  {recipients.map((r) => (
                    <div key={r.id} className="text-sm">
                      <p className="font-medium">{r.name}</p>
                      <p className="text-xs text-gray-500">{r.email}{r.role_label ? ` — ${r.role_label}` : ''}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent></Card>
          </div>
        </div>
      </div>

      {showApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-2">Aprobar informe mensual</h3>
            <p className="text-sm text-gray-600 mb-3">¿Confirmás que el informe fue revisado y está listo para enviarse?</p>
            <textarea className="w-full border rounded px-3 py-2 text-sm resize-none mb-3" rows={2} value={approveNotes} onChange={(e) => setApproveNotes(e.target.value)} placeholder="Observaciones (opcional)..." />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowApproveModal(false)}>Cancelar</Button>
              <Button onClick={handleApprove}>Aprobar</Button>
            </div>
          </div>
        </div>
      )}

      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-2">Enviar Informe Mensual</h3>
            {emailSending ? (
              <div className="text-center py-4"><p className="text-sm text-gray-600">Enviando informe...</p></div>
            ) : emailResult ? (
              <div className="text-center py-4">
                <p className="text-sm mb-4">{emailResult}</p>
                <Button onClick={() => { setShowEmailModal(false); setEmailResult(''); }}>Cerrar</Button>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-3">Enviar a {recipients.length} destinatario(s).</p>
                <div className="space-y-2 mb-4">
                  {recipients.map((r) => (
                    <div key={r.id} className="text-sm p-2 bg-gray-50 rounded">
                      <p className="font-medium">{r.name}</p>
                      <p className="text-xs text-gray-500">{r.email}</p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowEmailModal(false)}>Cancelar</Button>
                  <Button onClick={handleSendEmail}>Enviar</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}