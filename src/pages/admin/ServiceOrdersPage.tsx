import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { listServiceOrders } from '@/services/serviceOrders.service';
import { SERVICE_ORDER_STATUS_LABELS, SERVICE_ORDER_TYPE_LABELS, CLAIM_PRIORITY_LABELS } from '@/types/database';
import type { ServiceOrder } from '@/types/database';
import { Plus, Search, Eye, Wrench } from 'lucide-react';

const STATUS_BADGE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  draft: 'default', ready: 'info', assigned: 'warning', in_progress: 'warning', visited: 'info', completed: 'success', cancelled: 'danger',
};
const STATUS_OPTIONS = [{ value: '', label: 'Todos' }, ...Object.entries(SERVICE_ORDER_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))];

export default function ServiceOrdersPage() {
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => { loadOrders(); }, [search, filterStatus]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const result = await listServiceOrders({ search: search || undefined, status: filterStatus || undefined });
      setOrders(result.data); setCount(result.count);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  return (
    <DashboardLayout role="admin" title="Órdenes de Servicio">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div><h2 className="text-2xl font-bold text-gray-900">Órdenes de Servicio</h2><p className="text-gray-500">{count} orden(es)</p></div>
          <Link to="/admin/ordenes-servicio/nueva"><Button><Plus size={16} className="mr-2" /> Nueva Orden</Button></Link>
        </div>
        <Card><CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
            <Select options={STATUS_OPTIONS} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} />
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-0">
          {loading ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" /></div>
          : orders.length === 0 ? <div className="text-center py-12"><Wrench size={48} className="mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No se encontraron órdenes</p></div>
          : <div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">N.º</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Fecha</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Cliente</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Tipo</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Prioridad</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Estado</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600"></th>
          </tr></thead><tbody>
            {orders.map((o) => <tr key={o.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-3 font-mono font-semibold text-gray-900">{o.service_case ? `${(o.service_case as any).numbering_mode === 'test' ? 'PRUEBA ' : ''}N.º ${(o.service_case as any).case_number}` : '-'}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{new Date(o.order_date).toLocaleDateString('es-AR')}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{(o.client as any)?.name || '-'}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{SERVICE_ORDER_TYPE_LABELS[o.order_type]}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{CLAIM_PRIORITY_LABELS[o.priority as keyof typeof CLAIM_PRIORITY_LABELS]}</td>
              <td className="px-4 py-3"><Badge variant={STATUS_BADGE[o.status]}>{SERVICE_ORDER_STATUS_LABELS[o.status]}</Badge></td>
              <td className="px-4 py-3"><Link to={`/admin/ordenes-servicio/${o.id}`}><Button variant="ghost" size="sm"><Eye size={14} /></Button></Link></td>
            </tr>)}
          </tbody></table></div>}
        </CardContent></Card>
      </div>
    </DashboardLayout>
  );
}
