import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { listMyServiceOrders } from '@/services/serviceOrders.service';
import type { ServiceOrderWithRelations } from '@/services/serviceOrders.service';
import { CLAIM_PRIORITY_LABELS } from '@/types/database';
import { Eye, Play, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/config/supabase';

const PRIORITY_STYLE: Record<string, { bg: string; border: string; text: string; badge: 'danger' | 'warning' | 'info' | 'default' }> = {
  urgent: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', badge: 'danger' },
  high: { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-700', badge: 'warning' },
  normal: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'info' },
  low: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-500', badge: 'default' },
};

export default function TechServiceOrdersPage() {
  const [orders, setOrders] = useState<ServiceOrderWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState('');

  useEffect(() => { supabase.auth.getUser().then(({ data }) => { if (data.user) setUserId(data.user.id); }); }, []);
  useEffect(() => { if (userId) loadOrders(); }, [userId]);

  const loadOrders = async () => {
    setLoading(true); setError('');
    try {
      const result = await listMyServiceOrders(userId);
      setOrders(result);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error al cargar órdenes'); }
    finally { setLoading(false); }
  };

  const assigned = orders.filter(o => o.status === 'assigned');
  const inProgress = orders.filter(o => o.status === 'in_progress');
  const changesRequested = orders.filter(o => o.status === 'changes_requested');
  const pending = assigned.length + inProgress.length + changesRequested.length;

  const renderCard = (order: ServiceOrderWithRelations) => {
    const p = PRIORITY_STYLE[order.priority] || PRIORITY_STYLE.normal;
    const caseNum = order.service_case?.case_number;
    const caseMode = order.service_case?.numbering_mode;
    const numLabel = caseMode === 'test' ? `PRUEBA N.º ${caseNum}` : `N.º ${caseNum}`;
    const isLead = order.technicians?.some(t => t.is_lead);

    return (
      <div key={order.id} className={`rounded-lg border-2 ${p.border} ${p.bg} p-4`}>
        <div className="flex items-start justify-between mb-2">
          <div>
            {order.status === 'assigned' && <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded mr-2">NUEVA</span>}
            {order.status === 'changes_requested' && <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded mr-2">CORRECCIONES</span>}
            <span className="font-mono font-bold text-gray-900">{numLabel}</span>
            {isLead && <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded ml-2">Principal</span>}
          </div>
          <Badge variant={order.status === 'changes_requested' ? 'danger' : p.badge}>{CLAIM_PRIORITY_LABELS[order.priority as keyof typeof CLAIM_PRIORITY_LABELS]}</Badge>
        </div>
        {order.reviewer_notes && (
          <div className="p-2 bg-red-50 border border-red-200 rounded text-sm mb-2">
            <p className="text-red-700 font-medium text-xs">Observación del revisor:</p>
            <p className="text-red-600">{order.reviewer_notes}</p>
          </div>
        )}
        <p className="text-sm font-medium text-gray-900 mb-1">{order.building?.name || 'Sin edificio'}</p>
        <p className="text-xs text-gray-500 mb-1">{order.elevator?.code ? `Ascensor ${order.elevator.code}` : ''}</p>
        <p className="text-sm text-gray-700 mb-2">{order.subject}</p>
        {order.scheduled_date && <p className="text-xs text-gray-500 mb-2">📅 {new Date(order.scheduled_date).toLocaleDateString('es-AR')}{order.scheduled_time ? ` ${order.scheduled_time}` : ''}</p>}
        <div className="flex gap-2">
          {order.status === 'assigned' && (
            <Link to={`/tecnico/ordenes/${order.id}`}><Button size="sm"><Play size={14} className="mr-1" /> Comenzar trabajo</Button></Link>
          )}
          {order.status === 'changes_requested' && (
            <Link to={`/tecnico/ordenes/${order.id}`}><Button size="sm"><Play size={14} className="mr-1" /> Retomar trabajo</Button></Link>
          )}
          {order.status === 'in_progress' && (
            <Link to={`/tecnico/ordenes/${order.id}`}><Button size="sm"><Play size={14} className="mr-1" /> Continuar</Button></Link>
          )}
          <Link to={`/tecnico/ordenes/${order.id}`}><Button size="sm" variant="outline"><Eye size={14} className="mr-1" /> Ver</Button></Link>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout role="technician" title="Mis Órdenes">
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-700">{assigned.length}</p>
            <p className="text-xs text-blue-600">Nuevas</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-yellow-700">{inProgress.length}</p>
            <p className="text-xs text-yellow-600">En ejecución</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-gray-700">{pending}</p>
            <p className="text-xs text-gray-600">Pendientes</p>
          </div>
        </div>

        {error && <div role="alert" className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm flex items-center justify-between"><span className="flex items-center gap-2"><AlertCircle size={16} /> {error}</span><Button size="sm" variant="outline" onClick={loadOrders}><RefreshCw size={14} /></Button></div>}

        {loading ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" /></div>
        : pending === 0 && !error ? <div className="text-center py-12"><CheckCircle size={48} className="mx-auto text-success mb-4" /><p className="text-lg font-medium text-gray-900">No tenés órdenes pendientes</p><p className="text-sm text-gray-500">Las nuevas asignaciones aparecerán aquí.</p></div>
        : <div className="space-y-6">
            {changesRequested.length > 0 && <div><h3 className="text-sm font-bold text-red-700 uppercase tracking-wide mb-3">Correcciones Solicitadas ({changesRequested.length})</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-3">{changesRequested.map(renderCard)}</div></div>}
            {assigned.length > 0 && <div><h3 className="text-sm font-bold text-blue-700 uppercase tracking-wide mb-3">Nuevas Órdenes ({assigned.length})</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-3">{assigned.map(renderCard)}</div></div>}
            {inProgress.length > 0 && <div><h3 className="text-sm font-bold text-yellow-700 uppercase tracking-wide mb-3">En Ejecución ({inProgress.length})</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-3">{inProgress.map(renderCard)}</div></div>}
          </div>
        }
      </div>
    </DashboardLayout>
  );
}
