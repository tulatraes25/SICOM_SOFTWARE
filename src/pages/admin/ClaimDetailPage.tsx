import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Select from '@/components/ui/Select';
import { getClaim, assignTechnician, startWork, resolveClaim, closeClaim, cancelClaim, getClaimEvents } from '@/services/claims.service';
import { CLAIM_STATUS_LABELS, CLAIM_PRIORITY_LABELS, CLAIM_CATEGORY_LABELS, CLAIM_CHANNEL_LABELS } from '@/types/database';
import type { Claim } from '@/types/database';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { supabase } from '@/config/supabase';

const STATUS_BADGE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = { open: 'info', assigned: 'warning', in_progress: 'warning', visited: 'info', resolved: 'success', closed: 'default', cancelled: 'danger' };
const PRIORITY_BADGE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = { low: 'default', normal: 'info', high: 'warning', urgent: 'danger' };

export default function ClaimDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [assignTo, setAssignTo] = useState('');
  const [resolution, setResolution] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [technicians, setTechnicians] = useState<any[]>([]);

  useEffect(() => { if (id) loadData(); }, [id]);

  const loadData = async () => {
    if (!id) return;
    try {
      const [c, evts] = await Promise.all([getClaim(id), getClaimEvents(id)]);
      setClaim(c); setEvents(evts);
      const { data: techs } = await supabase.from('profiles').select('id, full_name').eq('role', 'technician').eq('active', true);
      setTechnicians(techs || []);
    } catch (err: any) { setError(err?.message || 'Error'); } finally { setLoading(false); }
  };

  const handleAction = async (action: () => Promise<void>) => {
    setActionLoading(true); setError('');
    try { await action(); await loadData(); } catch (err: any) { setError(err?.message || 'Error'); } finally { setActionLoading(false); }
  };

  const handleAssign = async () => {
    setActionLoading(true); setError('');
    try {
      await assignTechnician(id!, assignTo);
      // Send email notification
      try {
        await supabase.functions.invoke('send-technician-assignment-email', { body: { claim_id: id } });
      } catch (emailErr) {
        console.warn('Email notification failed:', emailErr);
      }
      await loadData();
      setShowAssignModal(false); setAssignTo('');
    } catch (err: any) { setError(err?.message || 'Error'); } finally { setActionLoading(false); }
  };
  const handleStartWork = () => { if (!confirm('¿Iniciar atención del reclamo?')) return; handleAction(() => startWork(id!)); };
  const handleResolve = () => handleAction(() => resolveClaim(id!, resolution)).then(() => { setShowResolveModal(false); setResolution(''); });
  const handleClose = () => { if (!confirm('¿Cerrar este reclamo?')) return; handleAction(() => closeClaim(id!)); };
  const handleCancel = () => handleAction(() => cancelClaim(id!, cancelReason)).then(() => { setShowCancelModal(false); setCancelReason(''); });

  if (loading) return <DashboardLayout role="admin" title="Reclamo"><div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" /></div></DashboardLayout>;
  if (error && !claim) return <DashboardLayout role="admin" title="Reclamo"><div className="max-w-2xl mx-auto"><button onClick={() => navigate('/admin/reclamos')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"><ArrowLeft size={18} /> Volver</button><Card><CardContent><div className="text-center py-8"><AlertCircle size={48} className="mx-auto text-danger mb-4" /><p className="text-gray-600">{error}</p></div></CardContent></Card></div></DashboardLayout>;
  if (!claim) return null;

  const isActive = !['closed', 'cancelled'].includes(claim.status);
  const caseNum = (claim.service_case as any)?.case_number;
  const caseMode = (claim.service_case as any)?.numbering_mode;

  return (
    <DashboardLayout role="admin" title={`Reclamo ${caseMode === 'test' ? 'PRUEBA ' : ''}N.º ${caseNum}`}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <button onClick={() => navigate('/admin/reclamos')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2"><ArrowLeft size={18} /> Volver</button>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900">{caseMode === 'test' ? 'PRUEBA ' : ''}N.º {caseNum}</h2>
              <Badge variant={STATUS_BADGE[claim.status]}>{CLAIM_STATUS_LABELS[claim.status]}</Badge>
              <Badge variant={PRIORITY_BADGE[claim.priority]}>{CLAIM_PRIORITY_LABELS[claim.priority]}</Badge>
            </div>
          </div>
          {isActive && (
            <div className="flex gap-2 flex-wrap">
              {claim.status === 'open' && <Button onClick={() => setShowAssignModal(true)}>Asignar técnico</Button>}
              {claim.status === 'assigned' && <Button onClick={handleStartWork}>Iniciar atención</Button>}
              {['in_progress', 'visited'].includes(claim.status) && <Button onClick={() => setShowResolveModal(true)}>Resolver</Button>}
              {claim.status === 'resolved' && <Button onClick={handleClose}>Cerrar</Button>}
              {['open', 'assigned', 'in_progress'].includes(claim.status) && <Button variant="danger" onClick={() => setShowCancelModal(true)}>Cancelar</Button>}
            </div>
          )}
        </div>
        {error && <div className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card><CardHeader><h3 className="font-semibold">Detalle del Reclamo</h3></CardHeader><CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div><span className="text-gray-500">Asunto: </span><span className="font-medium">{claim.subject}</span></div>
                <div><span className="text-gray-500">Fecha: </span>{new Date(claim.claim_date).toLocaleDateString('es-AR')}</div>
                <div><span className="text-gray-500">Canal: </span>{CLAIM_CHANNEL_LABELS[claim.channel]}</div>
                <div><span className="text-gray-500">Categoría: </span>{CLAIM_CATEGORY_LABELS[claim.category]}</div>
              </div>
              <div><span className="text-gray-500">Descripción:</span><p className="mt-1">{claim.description}</p></div>
              {claim.internal_notes && <div><span className="text-gray-500">Notas internas:</span><p className="mt-1 text-gray-600">{claim.internal_notes}</p></div>}
              {claim.resolution_summary && <div className="p-3 bg-success/5 border border-success/20 rounded"><span className="text-gray-500">Resolución:</span><p className="mt-1">{claim.resolution_summary}</p></div>}
            </CardContent></Card>
          </div>
          <div className="space-y-6">
            <Card><CardHeader><h3 className="font-semibold">Información</h3></CardHeader><CardContent className="space-y-2 text-sm">
              <div><span className="text-gray-500">Cliente: </span>{(claim.client as any)?.name || '-'}</div>
              <div><span className="text-gray-500">Edificio: </span>{(claim.building as any)?.name || '-'}</div>
              <div><span className="text-gray-500">Ascensor: </span>{(claim.elevator as any)?.code || '-'}</div>
              {claim.claimant_name && <div><span className="text-gray-500">Reclamante: </span>{claim.claimant_name}</div>}
              {claim.assigned_user && <div><span className="text-gray-500">Asignado a: </span>{(claim.assigned_user as any)?.full_name}</div>}
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
        <h3 className="text-lg font-semibold mb-4">Asignar Técnico</h3>
        <Select label="Técnico" options={technicians.map(t => ({ value: t.id, label: t.full_name }))} value={assignTo} onChange={(e) => setAssignTo(e.target.value)} />
        <div className="flex justify-end gap-2 mt-4"><Button variant="outline" onClick={() => setShowAssignModal(false)}>Cancelar</Button><Button onClick={handleAssign} disabled={!assignTo || actionLoading}>Asignar</Button></div>
      </div></div>}

      {showResolveModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="bg-white rounded-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4">Resolver Reclamo</h3>
        <textarea className="w-full border rounded px-3 py-2 text-sm resize-none" rows={3} value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Resumen de resolución..." />
        <div className="flex justify-end gap-2 mt-4"><Button variant="outline" onClick={() => setShowResolveModal(false)}>Cancelar</Button><Button onClick={handleResolve} disabled={!resolution.trim() || actionLoading}>Resolver</Button></div>
      </div></div>}

      {showCancelModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="bg-white rounded-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4">Cancelar Reclamo</h3>
        <textarea className="w-full border rounded px-3 py-2 text-sm resize-none" rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Motivo..." />
        <div className="flex justify-end gap-2 mt-4"><Button variant="outline" onClick={() => setShowCancelModal(false)}>Cancelar</Button><Button variant="danger" onClick={handleCancel} disabled={!cancelReason.trim() || actionLoading}>Cancelar reclamo</Button></div>
      </div></div>}
    </DashboardLayout>
  );
}
