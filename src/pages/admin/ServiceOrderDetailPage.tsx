import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Select from '@/components/ui/Select';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { getServiceOrder, markReady, assignTechnicians, completeOrder, cancelOrder, getOrderEvents, getOrderProgress, addProgress } from '@/services/serviceOrders.service';
import { SERVICE_ORDER_STATUS_LABELS, SERVICE_ORDER_TYPE_LABELS, CLAIM_PRIORITY_LABELS } from '@/types/database';
import type { ServiceOrder } from '@/types/database';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { supabase } from '@/config/supabase';

const STATUS_BADGE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = { draft: 'default', ready: 'info', assigned: 'warning', in_progress: 'warning', visited: 'info', completed: 'success', cancelled: 'danger' };

export default function ServiceOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<ServiceOrder | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [progress, setProgress] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTechs, setSelectedTechs] = useState<string[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressNote, setProgressNote] = useState('');
  const [progressType, setProgressType] = useState('update');

  useEffect(() => { if (id) loadData(); }, [id]);

  const loadData = async () => {
    if (!id) return;
    try {
      const [o, evts, prog] = await Promise.all([getServiceOrder(id), getOrderEvents(id), getOrderProgress(id)]);
      setOrder(o); setEvents(evts); setProgress(prog);
      const { data: techs } = await supabase.from('profiles').select('id, full_name').eq('role', 'technician').eq('active', true);
      setTechnicians(techs || []);
    } catch (err: any) { setError(err?.message || 'Error'); } finally { setLoading(false); }
  };

  const handleAction = async (action: () => Promise<void>) => {
    setActionLoading(true); setError('');
    try { await action(); await loadData(); } catch (err: any) { setError(err?.message || 'Error'); } finally { setActionLoading(false); }
  };

  const handleReady = () => { if (!confirm('¿Marcar como listo?')) return; handleAction(() => markReady(id!)); };
  const handleAssign = () => handleAction(() => assignTechnicians(id!, selectedTechs)).then(() => { setShowAssignModal(false); setSelectedTechs([]); });
  const handleComplete = () => handleAction(() => completeOrder(id!)).then(() => { setShowProgressModal(false); setProgressNote(''); });
  const handleAddProgress = () => handleAction(() => addProgress(id!, progressNote, progressType)).then(() => { setShowProgressModal(false); setProgressNote(''); });
  const handleCancel = () => handleAction(() => cancelOrder(id!, cancelReason)).then(() => { setShowCancelModal(false); setCancelReason(''); });

  if (loading) return <DashboardLayout role="admin" title="Orden"><div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" /></div></DashboardLayout>;
  if (error && !order) return <DashboardLayout role="admin" title="Orden"><div className="max-w-2xl mx-auto"><button onClick={() => navigate('/admin/ordenes-servicio')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"><ArrowLeft size={18} /> Volver</button><Card><CardContent><div className="text-center py-8"><AlertCircle size={48} className="mx-auto text-danger mb-4" /><p className="text-gray-600">{error}</p></div></CardContent></Card></div></DashboardLayout>;
  if (!order) return null;

  const caseNum = (order.service_case as any)?.case_number;
  const caseMode = (order.service_case as any)?.numbering_mode;
  const isActive = !['completed', 'cancelled'].includes(order.status);

  return (
    <DashboardLayout role="admin" title={`Orden ${caseMode === 'test' ? 'PRUEBA ' : ''}N.º ${caseNum}`}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <button onClick={() => navigate('/admin/ordenes-servicio')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2"><ArrowLeft size={18} /> Volver</button>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900">{caseMode === 'test' ? 'PRUEBA ' : ''}N.º {caseNum}</h2>
              <Badge variant={STATUS_BADGE[order.status]}>{SERVICE_ORDER_STATUS_LABELS[order.status]}</Badge>
            </div>
            <p className="text-gray-500">{order.subject}</p>
          </div>
          {isActive && (
            <div className="flex gap-2 flex-wrap">
              {order.status === 'draft' && <Button onClick={handleReady}>Marcar Listo</Button>}
              {['draft', 'ready', 'assigned'].includes(order.status) && <Button onClick={() => setShowAssignModal(true)}>Asignar Técnicos</Button>}
              {order.status === 'assigned' && <Button onClick={() => handleAction(async () => { const { startOrder } = await import('@/services/serviceOrders.service'); await startOrder(id!); })}>Iniciar Trabajo</Button>}
              {['in_progress', 'visited'].includes(order.status) && <Button onClick={() => setShowProgressModal(true)}>Registrar Avance</Button>}
              {['in_progress', 'visited'].includes(order.status) && <Button onClick={handleComplete}>Completar</Button>}
              {!['completed', 'cancelled'].includes(order.status) && <Button variant="danger" onClick={() => setShowCancelModal(true)}>Cancelar</Button>}
            </div>
          )}
        </div>
        {error && <div className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card><CardHeader><h3 className="font-semibold">Detalle</h3></CardHeader><CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div><span className="text-gray-500">Trabajo solicitado:</span><p className="mt-1">{order.work_requested}</p></div>
                <div><span className="text-gray-500">Tipo: </span>{SERVICE_ORDER_TYPE_LABELS[order.order_type]}</div>
                <div><span className="text-gray-500">Prioridad: </span>{CLAIM_PRIORITY_LABELS[order.priority as keyof typeof CLAIM_PRIORITY_LABELS]}</div>
                {order.scheduled_date && <div><span className="text-gray-500">Programada: </span>{new Date(order.scheduled_date).toLocaleDateString('es-AR')}{order.scheduled_time ? ` ${order.scheduled_time}` : ''}</div>}
              </div>
            </CardContent></Card>

            {progress.length > 0 && (
              <Card><CardHeader><h3 className="font-semibold">Avances</h3></CardHeader><CardContent>
                <div className="space-y-2">{progress.map((p) => (
                  <div key={p.id} className="p-2 border rounded text-sm"><p className="font-medium">{p.note}</p><p className="text-xs text-gray-500">{(p.tech as any)?.full_name} — {new Date(p.created_at).toLocaleString('es-AR')}</p></div>
                ))}</div>
              </CardContent></Card>
            )}
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

            <Card><CardHeader><h3 className="font-semibold">Historial</h3></CardHeader><CardContent>
              {events.length === 0 ? <p className="text-gray-500 text-sm">Sin eventos</p> : (
                <div className="space-y-2">{events.map((e) => (
                  <div key={e.id} className="flex gap-2 text-sm"><div className="w-2 h-2 rounded-full bg-secondary mt-1.5 shrink-0" /><div><p className="text-gray-900">{e.event_type.replace(/_/g, ' ')}</p><p className="text-gray-500 text-xs">{new Date(e.created_at).toLocaleString('es-AR')}</p></div></div>
                ))}</div>
              )}
            </CardContent></Card>
          </div>
        </div>
      </div>

      {showAssignModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="bg-white rounded-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4">Asignar Técnicos</h3>
        <div className="space-y-2">{technicians.map(t => (
          <label key={t.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedTechs.includes(t.id)} onChange={(e) => { if (e.target.checked) setSelectedTechs([...selectedTechs, t.id]); else setSelectedTechs(selectedTechs.filter(x => x !== t.id)); }} />{t.full_name}</label>
        ))}</div>
        <div className="flex justify-end gap-2 mt-4"><Button variant="outline" onClick={() => setShowAssignModal(false)}>Cancelar</Button><Button onClick={handleAssign} disabled={selectedTechs.length === 0 || actionLoading}>Asignar</Button></div>
      </div></div>}

      {showProgressModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="bg-white rounded-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4">Registrar Avance</h3>
        <Select label="Tipo" options={[{ value: 'update', label: 'Actualización' }, { value: 'diagnostic', label: 'Diagnóstico' }, { value: 'material_needed', label: 'Material necesario' }, { value: 'completion_note', label: 'Nota de finalización' }]} value={progressType} onChange={(e) => setProgressType(e.target.value)} />
        <textarea className="w-full border rounded px-3 py-2 text-sm resize-none mt-3" rows={3} value={progressNote} onChange={(e) => setProgressNote(e.target.value)} placeholder="Descripción del avance..." />
        <div className="flex justify-end gap-2 mt-4"><Button variant="outline" onClick={() => setShowProgressModal(false)}>Cancelar</Button><Button onClick={handleAddProgress} disabled={!progressNote.trim() || actionLoading}>Registrar</Button></div>
      </div></div>}

      {showCancelModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="bg-white rounded-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4">Cancelar Orden</h3>
        <textarea className="w-full border rounded px-3 py-2 text-sm resize-none" rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Motivo..." />
        <div className="flex justify-end gap-2 mt-4"><Button variant="outline" onClick={() => setShowCancelModal(false)}>Cancelar</Button><Button variant="danger" onClick={handleCancel} disabled={!cancelReason.trim() || actionLoading}>Cancelar orden</Button></div>
      </div></div>}
    </DashboardLayout>
  );
}
