import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/config/supabase';
import { getServiceRecordForReview, approveServiceRecord, rejectServiceRecord, updateElevatorStatusFromApprovedService } from '@/services/supervisor.service';
import { listServiceReportSends, sendServiceReportByEmail } from '@/services/serviceReportSends.service';
import { createAuditLog } from '@/services/audit.service';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import ServiceRecordPDF from '@/components/pdf/ServiceRecordPDF';
import { PDFDownloadLink, pdf } from '@react-pdf/renderer';
import { OPERATIONAL_STATUS_LABELS, CONSERVATION_STATUS_LABELS } from '@/types/elevators';
import type { ServiceRecord } from '@/types/database';
import { ArrowLeft, CheckCircle, XCircle, AlertCircle, Download, Loader2, Sparkles, Save, Mail, Clock, Check, X, Image, Calendar } from 'lucide-react';

const STATUS_BADGE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  draft: 'default', submitted: 'info', in_review: 'warning', approved: 'success', rejected: 'danger',
};

const STATUS_LABELS_ES: Record<string, string> = {
  draft: 'Borrador', submitted: 'Enviado', in_review: 'En revisión', approved: 'Aprobado', rejected: 'Rechazado',
};

export default function AdminServiceReviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<ServiceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [rejectNotes, setRejectNotes] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [finalReport, setFinalReport] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendHistory, setSendHistory] = useState<any[]>([]);
  const [recipients, setRecipients] = useState<any[]>([]);

  useEffect(() => { loadData(); }, [id]);
  useEffect(() => {
    const buildingId = (record?.elevator as any)?.building_id;
    if (buildingId) {
      supabase.from('building_report_recipients').select('*').eq('building_id', buildingId).eq('active', true)
        .then(({ data }) => setRecipients(data || []));
    }
  }, [(record?.elevator as any)?.building_id]);

  const loadData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError('');
      const data = await getServiceRecordForReview(id);
      setRecord(data);
      setFinalReport((data as any).ai_report_draft || (data as any).final_report_text || '');
      const sends = await listServiceReportSends(id);
      setSendHistory(sends);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAI = async () => {
    if (!id) return;
    setGeneratingAI(true);
    setError('');
    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-report', { body: { service_record_id: id } });
      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);
      setFinalReport(data.report);
      await supabase.from('service_records').update({ ai_report_draft: data.report, final_report_text: data.report, updated_at: new Date().toISOString() }).eq('id', id);
      setSuccess('Informe generado correctamente');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err?.message || 'Error al generar informe');
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleSaveReport = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await supabase.from('service_records').update({ final_report_text: finalReport, updated_at: new Date().toISOString() }).eq('id', id);
      setSuccess('Informe guardado correctamente');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!id) return;
    if (!confirm('¿Aprobar este mantenimiento?')) return;
    setSaving(true);
    try {
      await approveServiceRecord(id, finalReport || undefined);
      await updateElevatorStatusFromApprovedService(id);
      await createAuditLog({ action: 'approve', entity_type: 'service_record', entity_id: id });
      setSuccess('Mantenimiento aprobado correctamente');
      setTimeout(() => setSuccess(''), 3000);
      loadData();
    } catch (err: any) { setError(err?.message || 'Error al aprobar'); }
    finally { setSaving(false); }
  };

  const handleReject = async () => {
    if (!id || !rejectNotes.trim()) return;
    setSaving(true);
    try {
      await rejectServiceRecord(id, rejectNotes);
      await createAuditLog({ action: 'reject', entity_type: 'service_record', entity_id: id, new_data: { reason: rejectNotes } });
      setShowRejectModal(false);
      setRejectNotes('');
      setSuccess('Mantenimiento rechazado');
      setTimeout(() => setSuccess(''), 3000);
      loadData();
    } catch (err: any) { setError(err?.message || 'Error al rechazar'); }
    finally { setSaving(false); }
  };

  const handleSendEmail = async () => {
    if (!id || !record) return;
    setSendingEmail(true);
    setError('');
    try {
      const elevator = record.elevator as any;
      const technician = (record as any).technician;
      const checklist = (record as any).checklist || [];
      const pdfBlob = await pdf(
        <ServiceRecordPDF record={{ ...record, final_report_text: finalReport || record.final_report_text }} elevator={elevator} technician={technician} approvedBy={record.approved_by ? { full_name: (record as any).approved_by_profile?.full_name || 'Administrador' } : undefined} checklist={checklist} />
      ).toBlob();
      const arrayBuffer = await pdfBlob.arrayBuffer();
      const base64 = btoa(new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
      const filename = `informe-${elevator?.code || 'ascensor'}-${record.service_date}.pdf`;
      const result = await sendServiceReportByEmail(id, base64, filename);
      setSuccess(`Informe enviado correctamente a ${result.success} destinatario(s)`);
      setTimeout(() => setSuccess(''), 5000);
      const sends = await listServiceReportSends(id);
      setSendHistory(sends);
    } catch (err: any) {
      setError(err?.message || 'Error al enviar correo');
    } finally {
      setSendingEmail(false);
    }
  };

  if (loading) return <DashboardLayout role="admin" title="Revisión"><div className="text-center py-12"><Loader2 size={32} className="animate-spin mx-auto text-secondary" /></div></DashboardLayout>;
  if (error && !record) return <DashboardLayout role="admin" title="Revisión"><div className="max-w-2xl mx-auto"><button onClick={() => navigate('/admin/mantenimientos')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"><ArrowLeft size={18} /> Volver</button><Card><CardContent><div className="text-center py-8"><AlertCircle size={48} className="mx-auto text-danger mb-4" /><p className="text-gray-600">{error}</p></div></CardContent></Card></div></DashboardLayout>;
  if (!record) return <DashboardLayout role="admin" title="Revisión"><div className="text-center py-8"><p className="text-gray-500">No encontrado</p></div></DashboardLayout>;

  const elevator = record.elevator as any;
  const building = elevator?.building;
  const client = building?.client;
  const technician = (record as any).technician;
  const checklist = (record as any).checklist || [];
  const photos = (record as any).photos || [];
  const canReview = record.status === 'submitted' || record.status === 'in_review';
  const isApproved = record.status === 'approved';
  const isRejected = record.status === 'rejected';
  const canUseAI = ['submitted', 'in_review', 'approved'].includes(record.status);
  const fileName = `informe-${elevator?.code || 'ascensor'}-${record.service_date}.pdf`;

  return (
    <DashboardLayout role="admin" title="Revisión de Mantenimiento">
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Back button */}
        <button onClick={() => navigate('/admin/mantenimientos')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ArrowLeft size={18} /> Volver al listado
        </button>

        {/* Success/Error messages */}
        {success && <div className="p-3 bg-success/10 border border-success/30 rounded-lg text-success text-sm flex items-center gap-2"><CheckCircle size={16} /> {success}</div>}
        {error && <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}

        {/* Header with status */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold text-gray-900">{elevator?.code || '-'}</h1>
                  <Badge variant={STATUS_BADGE[record.status] || 'default'}>
                    {STATUS_LABELS_ES[record.status] || record.status}
                  </Badge>
                </div>
                <p className="text-gray-600">{building?.name || '-'} · {client?.name || '-'}</p>
              </div>
              <div className="text-right text-sm text-gray-500">
                <p>Servicio: <span className="font-medium text-gray-900 capitalize">{record.service_type}</span></p>
                <p>Fecha: <span className="font-medium text-gray-900">{new Date(record.service_date).toLocaleDateString('es-AR')}</span></p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Ascensor', value: elevator?.code || '-' },
            { label: 'Edificio', value: building?.name || '-' },
            { label: 'Cliente', value: client?.name || '-' },
            { label: 'Técnico', value: technician?.full_name || '-' },
          ].map((item) => (
            <div key={item.label} className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-500 uppercase">{item.label}</p>
              <p className="font-medium text-gray-900 mt-1">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column */}
          <div className="space-y-6">
            {/* Service data */}
            <Card>
              <CardHeader><h3 className="font-semibold text-gray-900 flex items-center gap-2"><Calendar size={18} /> Datos del Servicio</h3></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-gray-500">Tipo</p><p className="font-medium capitalize">{record.service_type}</p></div>
                  <div><p className="text-xs text-gray-500">Estado Operativo</p><Badge className={STATUS_COLORS_MAP[record.operational_status_at_service || ''] || ''}>{OPERATIONAL_STATUS_LABELS[record.operational_status_at_service as keyof typeof OPERATIONAL_STATUS_LABELS] || '-'}</Badge></div>
                  <div><p className="text-xs text-gray-500">Estado Conservación</p><Badge className={STATUS_COLORS_MAP[record.conservation_status_at_service || ''] || ''}>{CONSERVATION_STATUS_LABELS[record.conservation_status_at_service as keyof typeof CONSERVATION_STATUS_LABELS] || '-'}</Badge></div>
                  <div><p className="text-xs text-gray-500">Técnico</p><p className="font-medium">{technician?.full_name || '-'}</p></div>
                </div>
              </CardContent>
            </Card>

            {/* Checklist */}
            <Card>
              <CardHeader><h3 className="font-semibold text-gray-900 flex items-center gap-2"><CheckCircle size={18} /> Checklist</h3></CardHeader>
              <CardContent>
                {checklist.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-gray-200"><th className="text-left py-2">Ítem</th><th className="text-left py-2">Resultado</th><th className="text-left py-2">Nota</th></tr></thead>
                      <tbody>
                        {checklist.map((c: any, i: number) => (
                          <tr key={i} className="border-b border-gray-100">
                            <td className="py-2 pr-4">{c.item_name}</td>
                            <td className="py-2 pr-4"><Badge className={STATUS_COLORS_MAP[c.status] || ''}>{CHECKLIST_LABELS[c.status] || c.status}</Badge></td>
                            <td className="py-2 text-gray-500 text-xs">{c.notes || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="text-gray-500 text-sm">Sin checklist</p>}
              </CardContent>
            </Card>

            {/* Photos */}
            <Card>
              <CardHeader><h3 className="font-semibold text-gray-900 flex items-center gap-2"><Image size={18} /> Fotografías</h3></CardHeader>
              <CardContent>
                {photos.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((p: any) => (
                      <div key={p.id} className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                        <Image size={24} className="text-gray-400" />
                      </div>
                    ))}
                  </div>
                ) : <p className="text-gray-500 text-sm">Sin fotografías</p>}
              </CardContent>
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* AI Report */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Sparkles size={18} className="text-secondary" /> Informe IA</h3>
                  {canUseAI && (
                    <Button onClick={handleGenerateAI} loading={generatingAI} variant="secondary" size="sm">
                      {generatingAI ? <Loader2 size={14} className="animate-spin mr-1" /> : <Sparkles size={14} className="mr-1" />}
                      {finalReport ? 'Regenerar' : 'Generar'} con IA
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <textarea
                  value={finalReport}
                  onChange={(e) => setFinalReport(e.target.value)}
                  placeholder={canUseAI ? 'Haga clic en "Generar con IA" para crear un borrador...' : 'Sin informe disponible'}
                  className="w-full h-48 border border-gray-300 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  readOnly={!canUseAI}
                />
                {finalReport && (
                  <Button onClick={handleSaveReport} loading={saving} size="sm" className="mt-3">
                    <Save size={14} className="mr-1" /> Guardar cambios
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader><h3 className="font-semibold text-gray-900">Acciones</h3></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {canReview && (
                    <>
                      <Button onClick={handleApprove} loading={saving} className="w-full"><CheckCircle size={16} className="mr-2" /> Aprobar</Button>
                      <Button variant="danger" onClick={() => setShowRejectModal(true)} className="w-full"><XCircle size={16} className="mr-2" /> Rechazar</Button>
                    </>
                  )}
                  {isApproved && (
                    <>
                      <PDFDownloadLink
                        document={<ServiceRecordPDF record={{ ...record, final_report_text: finalReport || record.final_report_text }} elevator={elevator} technician={technician} approvedBy={record.approved_by ? { full_name: (record as any).approved_by_profile?.full_name || 'Administrador' } : undefined} checklist={checklist} />}
                        fileName={fileName}
                      >
                        {({ loading: pdfLoading }) => (
                          <Button className="w-full" disabled={pdfLoading}>
                            {pdfLoading ? <Loader2 size={16} className="animate-spin mr-2" /> : <Download size={16} className="mr-2" />}
                            Descargar PDF
                          </Button>
                        )}
                      </PDFDownloadLink>
                      <Button onClick={handleSendEmail} loading={sendingEmail} variant="secondary" className="w-full mt-2">
                        <Mail size={16} className="mr-2" /> Enviar por Correo ({recipients.length} destinatarios)
                      </Button>
                    </>
                  )}
                  {isRejected && (
                    <div className="p-3 bg-warning/10 rounded-lg text-sm text-warning">
                      <p className="font-medium">Rechazado</p>
                      {record.rejection_reason && <p className="mt-1">{record.rejection_reason}</p>}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Send history */}
            {sendHistory.length > 0 && (
              <Card>
                <CardHeader><h3 className="font-semibold text-gray-900 flex items-center gap-2"><Clock size={18} /> Historial de Envíos</h3></CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {sendHistory.map((send) => (
                      <div key={send.id} className="flex items-center gap-3 text-sm p-2 bg-gray-50 rounded">
                        {send.status === 'sent' ? <Check size={14} className="text-success" /> : <X size={14} className="text-danger" />}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{send.recipient_name}</p>
                          <p className="text-gray-500 text-xs truncate">{send.recipient_email}</p>
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap">{send.sent_at ? new Date(send.sent_at).toLocaleString('es-AR') : '-'}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Reject modal */}
        {showRejectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold mb-4">Motivo de Rechazo</h3>
              <textarea value={rejectNotes} onChange={(e) => setRejectNotes(e.target.value)} placeholder="Describa el motivo del rechazo..." className="w-full border border-gray-300 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary/20" rows={4} />
              <div className="flex justify-end gap-3 mt-4">
                <Button variant="outline" onClick={() => setShowRejectModal(false)}>Cancelar</Button>
                <Button variant="danger" onClick={handleReject} loading={saving} disabled={!rejectNotes.trim()}>Rechazar</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

const STATUS_COLORS_MAP: Record<string, string> = {
  operativo: 'bg-success/15 text-success', operativo_con_observaciones: 'bg-warning/15 text-warning', no_operativo: 'bg-danger/15 text-danger',
  fuera_de_servicio_preventivo: 'bg-danger/15 text-danger', fuera_de_servicio_por_reparacion: 'bg-danger/15 text-danger',
  conforme: 'bg-success/15 text-success', observado: 'bg-warning/15 text-warning', requiere_reparacion: 'bg-danger/15 text-danger',
  fuera_de_servicio: 'bg-danger/15 text-danger', pendiente_de_verificacion: 'bg-warning/15 text-warning',
};

const CHECKLIST_LABELS: Record<string, string> = {
  ok: 'Conforme', needs_attention: 'Observado', failed: 'Requiere intervención', na: 'No aplica',
};
