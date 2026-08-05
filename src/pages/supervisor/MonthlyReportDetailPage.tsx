import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { pdf } from '@react-pdf/renderer';
import { supabase } from '@/config/supabase';
import { getMonthlyReportPeriodData } from '@/services/monthlyReportEnhanced.service';
import MonthlyReportPDF from '@/components/pdf/MonthlyReportPDF';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Select from '@/components/ui/Select';
import { getUserSignatureForPDF } from '@/services/userSignatures.service';
import { ArrowLeft, AlertCircle, Check } from 'lucide-react';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const STATUS_BADGE: Record<string, 'default' | 'success' | 'warning' | 'info'> = {
  draft: 'default', generated: 'warning', reviewed: 'warning', approved: 'info', sent: 'success',
};
const STATUS_LABELS: Record<string, string> = { draft: 'Borrador', generated: 'Generado', reviewed: 'Revisado', approved: 'Aprobado', sent: 'Enviado' };
const MONTH_NAMES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function MonthlyReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [periodData, setPeriodData] = useState<Record<string, unknown> | null>(null);
  const [recipients, setRecipients] = useState<Array<{ id: string; name: string; email: string; role_label?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [generalStatus, setGeneralStatus] = useState('operativo');
  const [generalNotes, setGeneralNotes] = useState('');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState('');
  const approveRef = useRef(false);
  const generateRef = useRef(false);
  const emailRef = useRef(false);

  useEffect(() => { if (id) loadReport(); }, [id]);

  const removeUploadedPdfSafely = async (storagePath: string) => {
    try {
      await supabase.storage.from('service-order-reports').remove([storagePath]);
    } catch { /* best effort */ }
  };

  const loadReport = async () => {
    if (!id) return;
    try {
      const { data: r } = await supabase.from('monthly_reports').select('*').eq('id', id).single();
      if (r) {
        let approvedByProfile = null;
        if (r.approved_by) {
          const { data: profile } = await supabase.from('profiles').select('full_name, email').eq('id', r.approved_by).single();
          approvedByProfile = profile;
        }
        r.approved_by_profile = approvedByProfile;

        let elevator = null;
        if (r.elevator_id) {
          const { data: e } = await supabase.from('elevators').select('id, code, building:buildings(id, name, address, client:clients(name))').eq('id', r.elevator_id).single();
          elevator = e;
        }
        r.elevator = elevator;

        setReport(r);
        setGeneralStatus(r.general_status || 'operativo');
        setGeneralNotes(r.general_notes || '');
        if (r.elevator_id && r.report_month && r.report_year) {
          const pd = await getMonthlyReportPeriodData(r.elevator_id, r.report_year, r.report_month);
          setPeriodData(pd);
        }
        if (r.building_id) {
          const { data: recs } = await supabase
            .from('building_recipients')
            .select('id, full_name, email, role_label')
            .eq('building_id', r.building_id)
            .eq('active', true)
            .eq('receives_monthly_reports', true)
            .or(`elevator_id.is.null,elevator_id.eq.${r.elevator_id}`);
          setRecipients((recs || []).map((c: Record<string, unknown>) => ({ id: c.id as string, name: c.full_name as string, email: c.email as string, role_label: c.role_label as string | undefined })));
        }
      }
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error'); } finally { setLoading(false); }
  };

  const handleGeneratePDF = async () => {
    if (!report || generateRef.current) return;
    const reportStatus = report.status as string;
    if (reportStatus !== 'draft' && reportStatus !== 'generated') {
      setError('El informe cambió de estado y ya no puede regenerarse.');
      return;
    }
    generateRef.current = true;
    setGenerating(true); setError(''); setSuccess('');
    try {
      const nextVersion = ((report.pdf_version as number) || 0) + 1;
      const sigData = await getUserSignatureForPDF(report.created_by as string, 'administrator');
      const reportWithCurrent = {
        ...report,
        general_status: generalStatus,
        general_notes: generalNotes,
        pdf_version: nextVersion,
      };

      const hasTestRecords = (periodData?.serviceOrders as Array<Record<string, unknown>> || []).some((o) => {
        const sc = o.service_case as Record<string, unknown> | undefined;
        return sc?.numbering_mode === 'test' || ((sc?.case_number as number) >= 1900 && (sc?.case_number as number) <= 1999);
      }) || (periodData?.claims as Array<Record<string, unknown>> || []).some((cl) => {
        const sc = cl.service_case as Record<string, unknown> | undefined;
        return sc?.numbering_mode === 'test' || ((sc?.case_number as number) >= 1900 && (sc?.case_number as number) <= 1999);
      });
      const isTestDoc = hasTestRecords || report.numbering_mode === 'test';

      const blob = await pdf(
        <MonthlyReportPDF
          report={reportWithCurrent}
          maintenances={(periodData?.maintenances as Array<Record<string, unknown>>) || []}
          serviceOrders={(periodData?.serviceOrders as Array<Record<string, unknown>>) || []}
          claims={(periodData?.claims as Array<Record<string, unknown>>) || []}
          summary={(periodData?.summary as Record<string, unknown>) || { preventiveCount: 0, correctiveCount: 0, serviceOrderCount: 0, claimCount: 0, totalApproved: 0, totalWithCorrections: 0, firstDate: null, lastDate: null }}
          signatureUrl={sigData?.signedUrl || undefined}
          signerName={(report.created_user as Record<string, unknown>)?.full_name as string || undefined}
          isTestDocument={isTestDoc}
          documentStatus="preliminary"
        />
      ).toBlob();

      const arrayBuffer = await blob.arrayBuffer();
      const pdfBase64 = btoa(new Uint8Array(arrayBuffer).reduce((d, b) => d + String.fromCharCode(b), ''));
      const version = (report.pdf_version as number || 0) + 1;
      const operationId = crypto.randomUUID();
      const storagePath = `monthly-reports/${report.report_year}/${report.report_month}/${report.elevator_id}/informe-${report.report_year}-${String(report.report_month).padStart(2, '0')}-v${version}-${operationId}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from('service-order-reports')
        .upload(storagePath, new Blob([Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0))], { type: 'application/pdf' }), { contentType: 'application/pdf', upsert: false });

      if (uploadError) throw uploadError;

      // Atomic update with status guard
      const { data: updatedRow, error: updateError } = await supabase
        .from('monthly_reports')
        .update({
          status: 'generated',
          general_status: generalStatus,
          general_notes: generalNotes,
          pdf_url: storagePath,
          pdf_storage_path: storagePath,
          pdf_version: version,
          pdf_generated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', report.id)
        .in('status', ['draft', 'generated'])
        .select('id, status, pdf_url, pdf_version')
        .maybeSingle();

      if (updateError) {
        await removeUploadedPdfSafely(storagePath);
        throw updateError;
      }

      if (!updatedRow) {
        await removeUploadedPdfSafely(storagePath);
        setError('El informe cambió de estado durante la generación. Actualizá la página.');
        await loadReport();
        return;
      }

      setSuccess(`PDF versión ${version} generado correctamente`);
      await loadReport();
    } catch (err: unknown) { setError('Error al generar PDF: ' + (err instanceof Error ? err.message : '')); }
    finally { generateRef.current = false; setGenerating(false); }
  };

  const handleViewPDF = async () => {
    if (!report?.pdf_url) return;
    const { data } = await supabase.storage.from('service-order-reports').createSignedUrl(report.pdf_url as string, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const handleDownloadPDF = async () => {
    if (!report?.pdf_url) return;
    const { data } = await supabase.storage.from('service-order-reports').createSignedUrl(report.pdf_url as string, 3600);
    if (!data?.signedUrl) return;
    const response = await fetch(data.signedUrl);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    const elevCode = (report.elevator as Record<string, unknown>)?.code as string || 'ascensor';
    a.download = `informe-mensual-${elevCode.toLowerCase()}-${report.report_year}-${String(report.report_month).padStart(2, '0')}-v${(report.pdf_version as number) || 1}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  };

  const handleApprove = async () => {
    if (!report || approveRef.current) return;
    if ((report.status as string) !== 'generated') {
      setError('El informe ya fue aprobado o cambió de estado.');
      setShowApproveModal(false);
      return;
    }
    approveRef.current = true;
    setApproving(true); setError('');
    try {
      const { data: sigData } = await supabase.auth.getUser();
      const userId = sigData?.user?.id;
      if (!userId) throw new Error('No se pudo identificar el usuario');

      const { data: profileData } = await supabase.from('profiles').select('full_name, email').eq('id', userId).single();
      const approverName = (profileData as Record<string, unknown>)?.full_name as string || 'Usuario aprobador no disponible';
      const sigResult = await getUserSignatureForPDF(userId, 'administrator');

      const version = ((report.pdf_version as number) || 0) + 1;
      const reportWithApproval = {
        ...report,
        general_status: generalStatus,
        general_notes: generalNotes,
        pdf_version: version,
      };

      const hasTestRecords = (periodData?.serviceOrders as Array<Record<string, unknown>> || []).some((o) => {
        const sc = o.service_case as Record<string, unknown> | undefined;
        return sc?.numbering_mode === 'test' || ((sc?.case_number as number) >= 1900 && (sc?.case_number as number) <= 1999);
      }) || (periodData?.claims as Array<Record<string, unknown>> || []).some((cl) => {
        const sc = cl.service_case as Record<string, unknown> | undefined;
        return sc?.numbering_mode === 'test' || ((sc?.case_number as number) >= 1900 && (sc?.case_number as number) <= 1999);
      });
      const isTestDoc = hasTestRecords || report.numbering_mode === 'test';

      const blob = await pdf(
        <MonthlyReportPDF
          report={reportWithApproval}
          maintenances={(periodData?.maintenances as Array<Record<string, unknown>>) || []}
          serviceOrders={(periodData?.serviceOrders as Array<Record<string, unknown>>) || []}
          claims={(periodData?.claims as Array<Record<string, unknown>>) || []}
          summary={(periodData?.summary as Record<string, unknown>) || { preventiveCount: 0, correctiveCount: 0, serviceOrderCount: 0, claimCount: 0, totalApproved: 0, totalWithCorrections: 0, firstDate: null, lastDate: null }}
          signatureUrl={sigResult?.signedUrl || undefined}
          signerName={approverName}
          isTestDocument={isTestDoc}
          documentStatus="approved"
          approvedAt={new Date().toLocaleDateString('es-AR')}
        />
      ).toBlob();

      const arrayBuffer = await blob.arrayBuffer();
      const pdfBase64 = btoa(new Uint8Array(arrayBuffer).reduce((d, b) => d + String.fromCharCode(b), ''));
      const operationId = crypto.randomUUID();
      const storagePath = `monthly-reports/${report.report_year}/${report.report_month}/${report.elevator_id}/informe-${report.report_year}-${String(report.report_month).padStart(2, '0')}-v${version}-${operationId}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from('service-order-reports')
        .upload(storagePath, new Blob([Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0))], { type: 'application/pdf' }), { contentType: 'application/pdf', upsert: false });

      if (uploadError) throw uploadError;

      // Atomic update with status guard
      const { data: updatedRow, error: updateError } = await supabase
        .from('monthly_reports')
        .update({
          status: 'approved',
          approved_by: userId,
          approved_at: new Date().toISOString(),
          general_status: generalStatus,
          general_notes: generalNotes,
          pdf_url: storagePath,
          pdf_storage_path: storagePath,
          pdf_version: version,
          pdf_generated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', report.id)
        .eq('status', 'generated')
        .select('id, status, approved_by, approved_at, pdf_url, pdf_version')
        .maybeSingle();

      if (updateError) {
        await removeUploadedPdfSafely(storagePath);
        throw updateError;
      }

      if (!updatedRow) {
        await removeUploadedPdfSafely(storagePath);
        setError('El informe ya fue aprobado o cambió de estado.');
        setShowApproveModal(false);
        await loadReport();
        return;
      }

      setShowApproveModal(false);
      setSuccess('Informe aprobado correctamente');
      await loadReport();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al aprobar');
    } finally {
      approveRef.current = false;
      setApproving(false);
    }
  };

  const handleSendEmail = async () => {
    if (!report || emailRef.current) return;
    if (report.status !== 'approved') {
      setEmailResult('El informe debe estar aprobado para enviarse.');
      return;
    }
    if (recipients.length === 0) {
      setEmailResult('No hay destinatarios para enviar.');
      return;
    }
    if (!report.pdf_url) {
      setEmailResult('Primero generá el PDF del informe.');
      return;
    }
    emailRef.current = true;
    setEmailSending(true); setEmailResult('');
    try {
      const { data, error } = await supabase.functions.invoke('send-monthly-report-email', {
        body: {
          monthly_report_id: report.id,
          recipients: recipients.map(r => ({ email: r.email, name: r.name })),
          subject: `SICOM Patagonia — Informe mensual ${elevator?.code || ''} — ${MONTH_NAMES[(report.report_month as number) || 0]} ${report.report_year}`,
          body: `Adjuntamos el informe mensual correspondiente a ${elevator?.code || ''} del período ${MONTH_NAMES[(report.report_month as number) || 0]} ${report.report_year}.`,
        },
      });

      if (error) {
        const msg = error instanceof Error ? error.message : String(error);
        setEmailResult(`Error al enviar: ${msg}`);
        return;
      }

      if (!isRecord(data) || typeof data.success !== 'number' || typeof data.failed !== 'number' || !Array.isArray(data.results)) {
        setEmailResult('La respuesta del servicio de correo no es válida.');
        return;
      }

      const success = data.success as number;
      const failed = data.failed as number;
      const mockCount = typeof data.mock === 'number' ? (data.mock as number) : 0;
      const reportStatus = typeof data.report_status === 'string' ? data.report_status : 'approved';
      const statusUpdateFailed = data.status_update_failed === true;

      if (mockCount > 0 && success === 0 && failed === 0 && reportStatus === 'approved' && !statusUpdateFailed) {
        setEmailResult('El proveedor de correo no está configurado. No se envió ningún correo y el informe continúa aprobado.');
        await loadReport();
        return;
      }

      if (success > 0 && failed === 0 && mockCount === 0 && reportStatus === 'sent' && !statusUpdateFailed) {
        setEmailResult('Informe enviado correctamente');
        await loadReport();
        return;
      }

      if (statusUpdateFailed) {
        setEmailResult('Los correos fueron enviados, pero no se pudo actualizar el estado del informe. No repitas el envío.');
        await loadReport();
        return;
      }

      if (success === 0 && failed > 0) {
        setEmailResult(`No se pudo enviar el informe. ${failed} destinatario(s) fallaron. El informe continúa aprobado.`);
        return;
      }

      if (failed > 0) {
        setEmailResult(`Se enviaron ${success} correos y fallaron ${failed}. El informe continúa aprobado.`);
        await loadReport();
        return;
      }

      setEmailResult('La respuesta del servicio de correo no es válida.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setEmailResult(`Error al enviar: ${msg}`);
    } finally {
      emailRef.current = false;
      setEmailSending(false);
    }
  };

  if (loading) return <DashboardLayout role="admin" title="Informe Mensual"><div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" /></div></DashboardLayout>;
  if (!report) return <DashboardLayout role="admin" title="Informe Mensual"><div className="text-center py-8"><p className="text-gray-500">Informe no encontrado</p></div></DashboardLayout>;

  const elevator = report.elevator as Record<string, unknown>;
  const monthLabel = MONTH_NAMES[(report.report_month as number) || 0] + ' ' + report.report_year;
  const reportStatus = report.status as string;
  const isEditable = reportStatus === 'draft' || reportStatus === 'generated';
  const canRegenerate = isEditable;
  const canApprove = reportStatus === 'generated';
  const canEmail = reportStatus === 'approved' && Boolean(report.pdf_url);

  return (
    <DashboardLayout role="admin" title={`Informe ${monthLabel}`}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/admin/informes-mensuales')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900"><ArrowLeft size={18} /> Volver</button>
          <Badge variant={STATUS_BADGE[reportStatus]}>{STATUS_LABELS[reportStatus]}</Badge>
        </div>

        {error && <div role="alert" className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}
        {success && <div role="status" className="p-3 bg-success/10 border border-success/30 rounded text-success text-sm flex items-center gap-2"><Check size={16} /> {success}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card><CardHeader><h3 className="font-semibold">Datos del Informe</h3></CardHeader><CardContent className="space-y-2 text-sm">
              <div><span className="text-gray-500">Período: </span>{monthLabel}</div>
              <div><span className="text-gray-500">Ascensor: </span>{(elevator?.code as string) || '-'}</div>
              <div><span className="text-gray-500">Edificio: </span>{(elevator?.building as Record<string, unknown>)?.name as string || '-'}</div>
              <div><span className="text-gray-500">Cliente: </span>{((elevator?.building as Record<string, unknown>)?.client as Record<string, unknown>)?.name as string || '-'}</div>
            </CardContent></Card>

            {periodData && (
              <Card><CardHeader><h3 className="font-semibold">Resumen del Período</h3></CardHeader><CardContent>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-2 bg-gray-50 rounded"><p className="text-xl font-bold">{(periodData.summary as Record<string, unknown>)?.preventiveCount as number}</p><p className="text-xs text-gray-500">Preventivos</p></div>
                  <div className="p-2 bg-gray-50 rounded"><p className="text-xl font-bold">{(periodData.summary as Record<string, unknown>)?.correctiveCount as number}</p><p className="text-xs text-gray-500">Correctivos</p></div>
                  <div className="p-2 bg-gray-50 rounded"><p className="text-xl font-bold">{(periodData.summary as Record<string, unknown>)?.serviceOrderCount as number}</p><p className="text-xs text-gray-500">Órdenes</p></div>
                  <div className="p-2 bg-gray-50 rounded"><p className="text-xl font-bold">{(periodData.summary as Record<string, unknown>)?.claimCount as number}</p><p className="text-xs text-gray-500">Reclamos</p></div>
                  <div className="p-2 bg-gray-50 rounded"><p className="text-xl font-bold">{(periodData.summary as Record<string, unknown>)?.totalApproved as number}</p><p className="text-xs text-gray-500">Aprobados</p></div>
                  <div className="p-2 bg-gray-50 rounded"><p className="text-xl font-bold">{(periodData.summary as Record<string, unknown>)?.totalWithCorrections as number}</p><p className="text-xs text-gray-500">Con correcciones</p></div>
                </div>
              </CardContent></Card>
            )}

            <Card><CardHeader><h3 className="font-semibold">Estado General</h3></CardHeader><CardContent className="space-y-3">
              <Select label="Estado del mes" options={[{ value: 'operativo', label: 'Operativo' }, { value: 'operativo_con_observaciones', label: 'Operativo con observaciones' }, { value: 'requiere_seguimiento', label: 'Requiere seguimiento' }, { value: 'fuera_de_servicio', label: 'Fuera de servicio' }]} value={generalStatus} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => isEditable && setGeneralStatus(e.target.value)} disabled={!isEditable} />
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Observación general</label><textarea className="w-full border rounded px-3 py-2 text-sm resize-none" rows={3} value={generalNotes} onChange={(e) => isEditable && setGeneralNotes(e.target.value)} placeholder="Observaciones del período..." disabled={!isEditable} /></div>
            </CardContent></Card>
          </div>

          <div className="space-y-6">
            <Card><CardHeader><h3 className="font-semibold">PDF</h3></CardHeader><CardContent>
              {report.pdf_url ? (
                <div className="space-y-2">
                  <p className="text-sm text-success font-medium">PDF v{(report.pdf_version as number)} {reportStatus === 'approved' ? 'Aprobado' : 'Generado'}</p>
                  <Button className="w-full" variant="outline" onClick={handleViewPDF}>Ver PDF</Button>
                  <Button className="w-full" variant="outline" onClick={handleDownloadPDF}>Descargar PDF</Button>
                  {canRegenerate && <Button className="w-full" onClick={handleGeneratePDF} disabled={generating}>{generating ? 'Regenerando...' : 'Regenerar PDF'}</Button>}
                </div>
              ) : (
                <Button className="w-full" onClick={handleGeneratePDF} disabled={generating}>{generating ? 'Generando...' : 'Generar y Guardar PDF'}</Button>
              )}
            </CardContent></Card>

            {canApprove && (
              <Card><CardHeader><h3 className="font-semibold">Aprobación</h3></CardHeader><CardContent>
                <p className="text-sm text-gray-600 mb-3">Revisá el informe y aprobalo para habilitar el envío.</p>
                <Button className="w-full" onClick={() => setShowApproveModal(true)} disabled={approving}>{approving ? 'Aprobando...' : 'Aprobar informe'}</Button>
              </CardContent></Card>
            )}

            {canEmail && (
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
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowApproveModal(false)}>Cancelar</Button>
              <Button onClick={handleApprove} disabled={approving}>{approving ? 'Aprobando...' : 'Aprobar'}</Button>
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
