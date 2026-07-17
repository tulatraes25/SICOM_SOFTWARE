import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { listServiceOrders } from '@/services/serviceOrders.service';
import { CLAIM_PRIORITY_LABELS } from '@/types/database';
import type { ServiceOrder } from '@/types/database';
import { Eye, Play, CheckCircle } from 'lucide-react';
import { supabase } from '@/config/supabase';

const PRIORITY_STYLE: Record<string, { bg: string; border: string; text: string; badge: 'danger' | 'warning' | 'info' | 'default' }> = {
  urgent: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', badge: 'danger' },
  high: { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-700', badge: 'warning' },
  normal: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'info' },
  low: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-500', badge: 'default' },
};

export default function TechServiceOrdersPage() {
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');

  useEffect(() => { supabase.auth.getUser().then(({ data }) => { if (data.user) setUserId(data.user.id); }); }, []);
  useEffect(() => { if (userId) loadOrders(); }, [userId]);

  const loadOrders = async () => {
    setLoading(true);
    try { const result = await listServiceOrders({}); setOrders(result.data); }
    catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const assigned = orders.filter(o => o.status === 'assigned');
  const inProgress = orders.filter(o => o.status === 'in_progress');

  const renderCard = (order: ServiceOrder) => {
    const p = PRIORITY_STYLE[order.priority] || PRIORITY_STYLE.normal;
    const caseNum = (order.service_case as any)?.case_number;
    const caseMode = (order.service_case as any)?.numbering_mode;
    const numLabel = caseMode === 'test' ? `PRUEBA N.º ${caseNum}` : `N.º ${caseNum}`;

    return (
      <div key={order.id} className={`rounded-lg border-2 ${p.border} ${p.bg} p-4`}>
        <div className="flex items-start justify-between mb-2">
          <div>
            {order.status === 'assigned' && <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded mr-2">NUEVA</span>}
            <span className="font-mono font-bold text-gray-900">{numLabel}</span>
          </div>
          <Badge variant={p.badge}>{CLAIM_PRIORITY_LABELS[order.priority as keyof typeof CLAIM_PRIORITY_LABELS]}</Badge>
        </div>
        <p className="text-sm font-medium text-gray-900 mb-1">{(order.building as any)?.name || 'Sin edificio'}</p>
        <p className="text-xs text-gray-500 mb-1">{(order.elevator as any)?.code ? `Ascensor ${(order.elevator as any).code}` : ''}</p>
        <p className="text-sm text-gray-700 mb-2">{order.subject}</p>
        {order.scheduled_date && <p className="text-xs text-gray-500 mb-2">📅 {new Date(order.scheduled_date).toLocaleDateString('es-AR')}{order.scheduled_time ? ` ${order.scheduled_time}` : ''}</p>}
        <div className="flex gap-2">
          {order.status === 'assigned' && (
            <Link to={`/tecnico/ordenes/${order.id}`}><Button size="sm"><Play size={14} className="mr-1" /> Comenzar trabajo</Button></Link>
          )}
          {order.status === 'in_progress' && (
            <Link to={`/tecnico/ordenes/${order.id}`}><Button size="sm"><Play size={14} className="mr-1" /> Continuar</Button></Link>
          )}
          {order.status === 'visited' && (
            <Link to={`/tecnico/ordenes/${order.id}`}><Button size="sm"><CheckCircle size={14} className="mr-1" /> Completar</Button></Link>
          )}
          <Link to={`/tecnico/ordenes/${order.id}`}><Button size="sm" variant="outline"><Eye size={14} className="mr-1" /> Ver</Button></Link>
        </div>
      </div>
    );
  };

  const pending = assigned.length + inProgress.length;

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

        {loading ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" /></div>
        : pending === 0 ? <div className="text-center py-12"><CheckCircle size={48} className="mx-auto text-success mb-4" /><p className="text-lg font-medium text-gray-900">No tenés órdenes pendientes</p><p className="text-sm text-gray-500">Las nuevas asignaciones aparecerán aquí.</p></div>
        : <div className="space-y-6">
            {assigned.length > 0 && <div><h3 className="text-sm font-bold text-blue-700 uppercase tracking-wide mb-3">Nuevas Órdenes ({assigned.length})</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-3">{assigned.map(renderCard)}</div></div>}
            {inProgress.length > 0 && <div><h3 className="text-sm font-bold text-yellow-700 uppercase tracking-wide mb-3">En Ejecución ({inProgress.length})</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-3">{inProgress.map(renderCard)}</div></div>}
          </div>
        }
      </div>
    </DashboardLayout>
  );
}
