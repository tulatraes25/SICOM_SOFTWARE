import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { pdf } from '@react-pdf/renderer';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { getServiceOrder, assignTechnician, cancelOrder, approveOrder, requestCorrections, getOrderEvents, getOrderProgress, addProgress, generateOrderPDF, getOrderPDFUrl } from '@/services/serviceOrders.service';
import type { ServiceOrderEvent, ServiceOrderProgress } from '@/services/serviceOrders.service';
import ServiceOrderReportPDF from '@/components/pdf/ServiceOrderReportPDF';
import SendOrderEmailModal from '@/components/serviceOrders/SendOrderEmailModal';
import { SERVICE_ORDER_STATUS_LABELS, SERVICE_ORDER_TYPE_LABELS, CLAIM_PRIORITY_LABELS } from '@/types/database';
import type { ServiceOrder } from '@/types/database';
import { ArrowLeft, AlertCircle, Mail } from 'lucide-react';
import { supabase } from '@/config/supabase';

const STATUS_BADGE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  draft: 'default', ready: 'info', assigned: 'warning', in_progress: 'warning', visited: 'info',
  completed: 'success', approved: 'success', changes_requested: 'warning', cancelled: 'danger',
};

const STATUS_LABELS_ADMIN: Record<string, string> = {
  draft: 'Pendiente de asignación', ready: 'Pendiente de asignación',
  assigned: 'Asignada', in_progress: 'En progreso', completed: 'Completada',
  approved: 'Aprobada', changes_requested: 'Correcciones solicitadas', cancelled: 'Cancelada',
};

const EVENT_LABELS: Record<string, string> = {
  order_created: 'Orden creada',
  technician_assigned: 'Técnico asignado',
  order_started: 'Trabajo iniciado',
  visit_registered: 'Visita registrada',
  progress_added: 'Avance registrado',
  order_completed: 'Trabajo completado', order_cancelled: 'Orden cancelada',
  order_reopened: 'Orden reabierta', order_approved: 'Orden aprobada',
  corrections_requested: 'Correcciones solicitadas',
};

interface TechOption { id: string; full_name: string; }

export default function ServiceOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<ServiceOrder | null>(null);
  const [events, setEvents] = useState<ServiceOrderEvent[]>([]);
  const [progress, setProgress] = useState<ServiceOrderProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTechId, setSelectedTechId] = useState('');
  const [technicians, setTechnicians] = useState<TechOption[]>([]);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressNote, setProgressNote] = useState('');
  const [progressType, setProgressType] = useState('update');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveNotes, setApproveNotes] = useState('');
  const [showCorrectionsModal, setShowCorrectionsModal] = useState(false);
  const [correctionsNotes, setCorrectionsNotes] = useState('');
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const actionRef = useRef(false);

  useEffect(() => { if (id) loadData(); }, [id]);

  const loadData = async () => {
    if (!id) return;
    try {
      const [o, evts, prog] = await Promise.all([getServiceOrder(id), getOrderEvents(id), getOrderProgress(id)]);
      setOrder(o); setEvents(evts as ServiceOrderEvent[]); setProgress(prog as ServiceOrderProgress[]);
      const { data: techs } = await supabase.from('profiles').select('id, full_name').eq('role', 'technician').eq('active', true);
      setTechnicians((techs || []) as TechOption[]);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error'); } finally { setLoading(false); }
  };

  const handleAction = async (action: () => Promise<void>, redirect?: string): Promise<boolean> => {
    if (actionRef.current) return false;
    actionRef.current = true;
    setActionLoading(true); setError('');
    try {
      await action();
      await loadData();
      if (redirect) navigate(redirect, { replace: true });
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
      return false;
    } finally {
      actionRef.current = false;
      setActionLoading(false);
    }
  };

  const openAssignModal = () => {
    if (!order) return;
    const currentTechId = order.technicians?.[0]?.technician?.id || '';
    setSelectedTechId(currentTechId);
    setShowAssignModal(true);
  };

  const handleAssign = () => {
    if (!selectedTechId) {
      setError('Debe seleccionar un técnico.');
      return;
    }
    handleAction(() => assignTechnician(id!, selectedTechId)).then((ok) => {
      if (ok) { setShowAssignModal(false); setSelectedTechId(''); }
    });
  };

  const handleApprove = () => handleAction(() => approveOrder(id!, approveNotes), '/admin/ordenes-servicio').then((ok) => { if (ok) { setShowApproveModal(false); setApproveNotes(''); } });
  const handleCorrections = () => handleAction(() => requestCorrections(id!, correctionsNotes), '/admin/ordenes-servicio').then((ok) => { if (ok) { setShowCorrectionsModal(false); setCorrectionsNotes(''); } });
  const handleCancel = () => handleAction(() => cancelOrder(id!, cancelReason)).then((ok) => { if (ok) { setShowCancelModal(false); setCancelReason(''); } });

  const handleGeneratePDF = async () => {
    if (!order || order.status !== 'approved') return;
    setPdfGenerating(true); setError('');
    try {
      const version = (order.final_pdf_version || 0) + 1;
      const blob = await pdf(
        <ServiceOrderReportPDF order={order} progress={progress} events={events}
          isTest={order.service_case?.numbering_mode === 'test'}
          signerName={order.reviewed_by ? (order.approved_user?.full_name || 'Administrador') : undefined} />
      ).toBlob();

      const arrayBuffer = await blob.arrayBuffer();
      const base64 = btoa(new Uint8Array(arrayBuffer).reduce((d, b) => d + String.fromCharCode(b), ''));

      await generateOrderPDF(id!, base64, version);
      await loadData();
      setSuccess(`PDF versión ${version} generado correctamente`);
    } catch (err: unknown) { setError('Error al generar PDF: ' + (err instanceof Error ? err.message : '')); }
    finally { setPdfGenerating(false); }
  };

  const handleDownloadPDF = async () => {
    if (!order?.final_pdf_path) return;
    const url = await getOrderPDFUrl(order.final_pdf_path);
    if (!url) return;
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `orden-${order.service_case?.case_number || 's/c'}-v${order.final_pdf_version || 1}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  };

  if (loading) return <DashboardLayout role="admin" title="Orden"><div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" /></div></DashboardLayout>;
  if (error && !order) return <DashboardLayout role="admin" title="Orden"><div className="max-w-2xl mx-auto"><button onClick={() => navigate('/admin/ordenes-servicio')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"><ArrowLeft size={18} /> Volver</button><Card><CardContent><div className="text-center py-8"><AlertCircle size={48} className="mx-auto text-danger mb-4" /><p className="text-gray-600">{error}</p></div></CardContent></Card></div></DashboardLayout>;
  if (!order) return null;

  const caseNum = order.service_case?.case_number;
  const caseMode = order.service_case?.numbering_mode;
  const numLabel = caseMode === 'test' ? `PRUEBA N.º ${caseNum}` : `N.º ${caseNum}`;
  const statusLabel = STATUS_LABELS_ADMIN[order.status] || SERVICE_ORDER_STATUS_LABELS[order.status];
  const isReviewable = order.status === 'completed';
  const canAssign = ['draft', 'ready', 'assigned'].includes(order.status);
  const assignedTech = order.technicians?.[0];

  return (
    <DashboardLayout role="admin" title={`Orden ${numLabel}`}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <button onClick={() => navigate('/admin/ordenes-servicio')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2"><ArrowLeft size={18} /> Volver</button>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900">{numLabel}</h2>
              <Badge variant={STATUS_BADGE[order.status]}>{statusLabel}</Badge>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {canAssign && <Button onClick={openAssignModal}>Asignar técnico</Button>}
            {isReviewable && <>
              <Button variant="outline" onClick={() => setShowCorrectionsModal(true)}>Solicitar correcciones</Button>
              <Button onClick={() => setShowApproveModal(true)}>Aprobar orden</Button>
            </>}
            {order.status === 'approved' && <>
              {order.final_pdf_path ? (
                <>
                  <Button variant="outline" onClick={handleDownloadPDF}>Descargar PDF</Button>
                  <Button onClick={handleGeneratePDF} disabled={pdfGenerating}>{pdfGenerating ? 'Regenerando...' : 'Regenerar PDF'}</Button>
                  <Button onClick={() => setShowEmailModal(true)}><Mail size={16} className="mr-2" /> Enviar por correo</Button>
                </>
              ) : (
                <Button onClick={handleGeneratePDF} disabled={pdfGenerating}>{pdfGenerating ? 'Generando...' : 'Generar PDF final'}</Button>
              )}
            </>}
            {!['completed', 'approved', 'cancelled'].includes(order.status) && <Button variant="danger" onClick={() => setShowCancelModal(true)}>Cancelar</Button>}
          </div>
        </div>
        {error && <div role="alert" className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}
        {success && <div role="status" className="p-3 bg-success/10 border border-success/30 rounded text-success text-sm">{success}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card><CardHeader><h3 className="font-semibold">Detalle</h3></CardHeader><CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div><span className="text-gray-500">Trabajo solicitado:</span><p className="mt-1">{order.work_requested || 'No informado'}</p></div>
                <div><span className="text-gray-500">Tipo: </span>{SERVICE_ORDER_TYPE_LABELS[order.order_type]}</div>
                <div><span className="text-gray-500">Prioridad: </span>{CLAIM_PRIORITY_LABELS[order.priority as keyof typeof CLAIM_PRIORITY_LABELS]}</div>
                {order.scheduled_date && <div><span className="text-gray-500">Programada: </span>{new Date(order.scheduled_date).toLocaleDateString('es-AR')}{order.scheduled_time ? ` ${order.scheduled_time}` : ''}</div>}
                {order.started_at && <div><span className="text-gray-500">Inicio: </span>{new Date(order.started_at).toLocaleString('es-AR')}</div>}
                {order.completed_at && <div><span className="text-gray-500">Finalización: </span>{new Date(order.completed_at).toLocaleString('es-AR')}</div>}
              </div>
              {order.completion_summary && (
                <div className="p-3 bg-success/5 border border-success/20 rounded">
                  <span className="text-gray-500">Trabajo realizado:</span>
                  <p className="mt-1">{order.completion_summary}</p>
                </div>
              )}
              {order.reviewer_notes && <div className="p-3 bg-warning/5 border border-warning/20 rounded"><span className="text-gray-500">Observaciones del revisor:</span><p className="mt-1">{order.reviewer_notes}</p></div>}
            </CardContent></Card>

            {progress.length > 0 && (
              <Card><CardHeader><h3 className="font-semibold">Avances</h3></CardHeader><CardContent>
                <div className="space-y-2">{progress.map((p) => (
                  <div key={p.id} className="p-3 border rounded text-sm">
                    <p className="font-medium">{p.note}</p>
                    <p className="text-xs text-gray-500 mt-1">{p.tech?.full_name || 'Técnico'} — {new Date(p.created_at).toLocaleString('es-AR')}</p>
                    {p.progress_type && <Badge variant="info" className="mt-1">{p.progress_type}</Badge>}
                  </div>
                ))}</div>
              </CardContent></Card>
            )}

            <Card><CardHeader><h3 className="font-semibold">Historial</h3></CardHeader><CardContent>
              {events.length === 0 ? <p className="text-gray-500 text-sm">Sin eventos</p> : (
                <div className="space-y-2">{events.map((e) => (
                  <div key={e.id} className="flex gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-secondary mt-1.5 shrink-0" />
                    <div>
                      <p className="text-gray-900">{EVENT_LABELS[e.event_type] || e.event_type}</p>
                      {e.performer?.full_name && <p className="text-gray-500 text-xs">{e.performer.full_name}</p>}
                      {typeof e.details?.notes === 'string' && e.details.notes && <p className="text-gray-500 text-xs italic">"{e.details.notes}"</p>}
                      <p className="text-gray-400 text-xs">{new Date(e.created_at).toLocaleString('es-AR')}</p>
                    </div>
                  </div>
                ))}</div>
              )}
            </CardContent></Card>
          </div>

          <div className="space-y-6">
            <Card><CardHeader><h3 className="font-semibold">Información</h3></CardHeader><CardContent className="space-y-2 text-sm">
              <div><span className="text-gray-500">Cliente: </span>{order.client?.name || '-'}</div>
              <div><span className="text-gray-500">Edificio: </span>{order.building?.name || '-'}</div>
              <div><span className="text-gray-500">Ascensor: </span>{order.elevator?.code || '-'}</div>
              {assignedTech ? (
                <div><span className="text-gray-500">Técnico asignado: </span>{assignedTech.technician?.full_name || '-'}</div>
              ) : (
                <div><span className="text-gray-500">Técnico asignado: </span><span className="text-gray-400 italic">Sin asignar</span></div>
              )}
            </CardContent></Card>
          </div>
        </div>
      </div>

      {/* Approve modal */}
      {showApproveModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="bg-white rounded-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-2">Aprobar orden de servicio</h3>
        <p className="text-sm text-gray-600 mb-3">¿Confirmás que el trabajo fue revisado y aprobado?</p>
        <textarea className="w-full border rounded px-3 py-2 text-sm resize-none mb-3" rows={2} value={approveNotes} onChange={(e) => setApproveNotes(e.target.value)} placeholder="Observaciones (opcional)..." />
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowApproveModal(false)}>Cancelar</Button><Button onClick={handleApprove} disabled={actionLoading}>Aprobar</Button></div>
      </div></div>}

      {/* Corrections modal */}
      {showCorrectionsModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="bg-white rounded-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-2">Solicitar correcciones</h3>
        <p className="text-sm text-gray-600 mb-3">Indicá las correcciones necesarias. El técnico deberá retomar el trabajo.</p>
        <textarea className="w-full border rounded px-3 py-2 text-sm resize-none mb-3" rows={3} value={correctionsNotes} onChange={(e) => setCorrectionsNotes(e.target.value)} placeholder="Observaciones obligatorias..." />
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowCorrectionsModal(false)}>Cancelar</Button><Button variant="danger" onClick={handleCorrections} disabled={!correctionsNotes.trim() || actionLoading}>Solicitar correcciones</Button></div>
      </div></div>}

      {/* Assign modal — single technician */}
      {showAssignModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="bg-white rounded-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4">Asignar técnico</h3>
        <div className="space-y-2">
          {technicians.map(t => (
            <label key={t.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedTechId === t.id ? 'border-primary bg-primary/5' : 'border-gray-200 hover:bg-gray-50'}`}>
              <input type="radio" name="techAssign" checked={selectedTechId === t.id} onChange={() => setSelectedTechId(t.id)} className="accent-primary" />
              <span className="text-sm font-medium">{t.full_name}</span>
            </label>
          ))}
          {technicians.length === 0 && <p className="text-gray-500 text-sm">No hay técnicos disponibles.</p>}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setShowAssignModal(false)}>Cancelar</Button>
          <Button onClick={handleAssign} disabled={!selectedTechId || actionLoading}>Asignar</Button>
        </div>
      </div></div>}

      {/* Cancel modal */}
      {showCancelModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="bg-white rounded-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4">Cancelar Orden</h3>
        <textarea className="w-full border rounded px-3 py-2 text-sm resize-none" rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Motivo..." />
        <div className="flex justify-end gap-2 mt-4"><Button variant="outline" onClick={() => setShowCancelModal(false)}>Cancelar</Button><Button variant="danger" onClick={handleCancel} disabled={!cancelReason.trim() || actionLoading}>Cancelar orden</Button></div>
      </div></div>}

      {/* Progress modal */}
      {showProgressModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="bg-white rounded-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4">Registrar Avance</h3>
        <select className="w-full border rounded px-3 py-2 text-sm mb-3" value={progressType} onChange={(e) => setProgressType(e.target.value)}>
          <option value="update">Actualización</option><option value="diagnostic">Diagnóstico</option><option value="material_needed">Material necesario</option><option value="completion_note">Nota de finalización</option>
        </select>
        <textarea className="w-full border rounded px-3 py-2 text-sm resize-none" rows={3} value={progressNote} onChange={(e) => setProgressNote(e.target.value)} placeholder="Descripción..." />
        <div className="flex justify-end gap-2 mt-4"><Button variant="outline" onClick={() => setShowProgressModal(false)}>Cancelar</Button><Button onClick={() => handleAction(() => addProgress(id!, progressNote, progressType)).then(() => { setShowProgressModal(false); setProgressNote(''); })} disabled={!progressNote.trim() || actionLoading}>Registrar</Button></div>
      </div></div>}

      <SendOrderEmailModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        orderId={id!}
        caseNumber={order.service_case?.case_number || 0}
        numberingMode={order.service_case?.numbering_mode || ''}
        elevatorCode={order.elevator?.code || ''}
        buildingName={order.building?.name || ''}
        buildingId={order.building?.id}
        elevatorId={order.elevator_id}
        pdfVersion={order.final_pdf_version || 1}
        onSent={() => { setShowEmailModal(false); loadData(); }}
      />
    </DashboardLayout>
  );
}
