import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { getServiceOrder, startOrder, completeOrder, addProgress, getOrderProgress, getOrderEvents } from '@/services/serviceOrders.service';
import { SERVICE_ORDER_STATUS_LABELS, SERVICE_ORDER_TYPE_LABELS, CLAIM_PRIORITY_LABELS } from '@/types/database';
import type { ServiceOrder } from '@/types/database';
import { ArrowLeft, AlertCircle, Play, CheckCircle } from 'lucide-react';

const STATUS_BADGE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  assigned: 'warning', in_progress: 'warning', visited: 'info',
  completed: 'success', changes_requested: 'danger',
};

const EVENT_LABELS: Record<string, string> = {
  order_created: 'Orden creada', marked_ready: 'Marcada como lista',
  technician_assigned: 'Técnico asignado', order_started: 'Trabajo iniciado',
  progress_added: 'Avance registrado', order_completed: 'Trabajo completado',
  corrections_requested: 'Correcciones solicitadas', order_reopened: 'Trabajo retomado',
  order_approved: 'Orden aprobada', order_cancelled: 'Orden cancelada',
};

export default function TechServiceOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<ServiceOrder | null>(null);
  const [progress, setProgress] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressNote, setProgressNote] = useState('');
  const [progressType, setProgressType] = useState('update');

  useEffect(() => { if (id) loadData(); }, [id]);

  const loadData = async () => {
    if (!id) return;
    try {
      const [o, prog, evts] = await Promise.all([getServiceOrder(id), getOrderProgress(id), getOrderEvents(id)]);
      setOrder(o); setProgress(prog); setEvents(evts);
    } catch (err: any) { setError(err?.message || 'Error'); } finally { setLoading(false); }
  };

  const handleAction = async (action: () => Promise<void>) => {
    setActionLoading(true); setError('');
    try { await action(); await loadData(); } catch (err: any) { setError(err?.message || 'Error'); } finally { setActionLoading(false); }
  };

  if (loading) return <DashboardLayout role="technician" title="Orden"><div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" /></div></DashboardLayout>;
  if (error && !order) return <DashboardLayout role="technician" title="Orden"><div className="max-w-2xl mx-auto"><button onClick={() => navigate('/tecnico/ordenes')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"><ArrowLeft size={18} /> Volver</button><Card><CardContent><div className="text-center py-8"><AlertCircle size={48} className="mx-auto text-danger mb-4" /><p className="text-gray-600">{error}</p></div></CardContent></Card></div></DashboardLayout>;
  if (!order) return null;

  const caseNum = (order.service_case as any)?.case_number;
  const caseMode = (order.service_case as any)?.numbering_mode;
  const numLabel = caseMode === 'test' ? `PRUEBA N.º ${caseNum}` : `N.º ${caseNum}`;
  const isCompleted = order.status === 'completed';
  const isChangesRequested = order.status === 'changes_requested';

  return (
    <DashboardLayout role="technician" title={`Orden ${numLabel}`}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <button onClick={() => navigate('/tecnico/ordenes')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2"><ArrowLeft size={18} /> Volver a Mis Órdenes</button>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900">{numLabel}</h2>
              <Badge variant={STATUS_BADGE[order.status] || 'default'}>{SERVICE_ORDER_STATUS_LABELS[order.status]}</Badge>
            </div>
          </div>
          <div className="flex gap-2">
            {order.status === 'assigned' && <Button onClick={() => handleAction(() => startOrder(id!))} disabled={actionLoading}><Play size={16} className="mr-2" /> Comenzar trabajo</Button>}
            {isChangesRequested && <Button onClick={() => handleAction(() => startOrder(id!))} disabled={actionLoading}><Play size={16} className="mr-2" /> Retomar trabajo</Button>}
            {['in_progress', 'visited'].includes(order.status) && <Button onClick={() => setShowProgressModal(true)}>Registrar Avance</Button>}
            {['in_progress', 'visited'].includes(order.status) && <Button onClick={() => handleAction(() => completeOrder(id!))}><CheckCircle size={16} className="mr-2" /> Completar</Button>}
            {isCompleted && <Button onClick={() => navigate('/tecnico/ordenes')}>Volver a Mis Órdenes</Button>}
          </div>
        </div>

        {isChangesRequested && (
          <div className="p-4 bg-red-50 border-2 border-red-300 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={18} className="text-red-600" />
              <h3 className="font-bold text-red-700">Correcciones solicitadas</h3>
            </div>
            {(order as any).reviewer_notes ? (
              <p className="text-red-600 text-sm">{(order as any).reviewer_notes}</p>
            ) : (
              <p className="text-red-500 text-sm italic">No se informó una observación.</p>
            )}
            {(order as any).reviewed_at && (
              <p className="text-red-400 text-xs mt-2">Solicitado el {new Date((order as any).reviewed_at).toLocaleString('es-AR')}</p>
            )}
          </div>
        )}

        {error && <div className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card><CardHeader><h3 className="font-semibold">Detalle</h3></CardHeader><CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div><span className="text-gray-500">Trabajo solicitado:</span><p className="mt-1">{order.work_requested || 'No informado'}</p></div>
                <div><span className="text-gray-500">Tipo: </span>{SERVICE_ORDER_TYPE_LABELS[order.order_type]}</div>
                <div><span className="text-gray-500">Prioridad: </span>{CLAIM_PRIORITY_LABELS[order.priority as keyof typeof CLAIM_PRIORITY_LABELS]}</div>
                {order.scheduled_date && <div><span className="text-gray-500">Programada: </span>{new Date(order.scheduled_date).toLocaleDateString('es-AR')}{order.scheduled_time ? ` ${order.scheduled_time}` : ''}</div>}
              </div>
            </CardContent></Card>

            {progress.length > 0 && (
              <Card><CardHeader><h3 className="font-semibold">Avances</h3></CardHeader><CardContent>
                <div className="space-y-2">{progress.map((p) => (
                  <div key={p.id} className="p-3 border rounded text-sm">
                    <p className="font-medium">{p.note}</p>
                    <p className="text-xs text-gray-500 mt-1">{(p.tech as any)?.full_name || 'Técnico'} — {new Date(p.created_at).toLocaleString('es-AR')}</p>
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
                      {e.details?.notes && <p className="text-gray-500 text-xs italic">"{e.details.notes}"</p>}
                      <p className="text-gray-400 text-xs">{new Date(e.created_at).toLocaleString('es-AR')}</p>
                    </div>
                  </div>
                ))}</div>
              )}
            </CardContent></Card>
          </div>

          <div className="space-y-6">
            <Card><CardHeader><h3 className="font-semibold">Información</h3></CardHeader><CardContent className="space-y-2 text-sm">
              <div><span className="text-gray-500">Cliente: </span>{(order.client as any)?.name || '-'}</div>
              <div><span className="text-gray-500">Edificio: </span>{(order.building as any)?.name || '-'}</div>
              <div><span className="text-gray-500">Ascensor: </span>{(order.elevator as any)?.code || '-'}</div>
              {order.technicians && order.technicians.length > 0 && (
                <div><span className="text-gray-500">Técnicos:</span>
                  <ul className="mt-1">{order.technicians.map((t: any, i: number) => <li key={i}>{t.technician?.full_name}{t.is_lead ? ' (Principal)' : ''}</li>)}</ul>
                </div>
              )}
            </CardContent></Card>
          </div>
        </div>
      </div>

      {showProgressModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="bg-white rounded-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4">Registrar Avance</h3>
        <select className="w-full border rounded px-3 py-2 text-sm mb-3" value={progressType} onChange={(e) => setProgressType(e.target.value)}>
          <option value="update">Actualización</option><option value="diagnostic">Diagnóstico</option><option value="material_needed">Material necesario</option><option value="completion_note">Nota de finalización</option>
        </select>
        <textarea className="w-full border rounded px-3 py-2 text-sm resize-none" rows={3} value={progressNote} onChange={(e) => setProgressNote(e.target.value)} placeholder="Descripción..." />
        <div className="flex justify-end gap-2 mt-4"><Button variant="outline" onClick={() => setShowProgressModal(false)}>Cancelar</Button><Button onClick={() => handleAction(() => addProgress(id!, progressNote, progressType)).then(() => { setShowProgressModal(false); setProgressNote(''); })} disabled={!progressNote.trim() || actionLoading}>Registrar</Button></div>
      </div></div>}
    </DashboardLayout>
  );
}
