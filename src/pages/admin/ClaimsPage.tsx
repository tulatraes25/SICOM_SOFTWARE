import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { listClaims } from '@/services/claims.service';
import { CLAIM_STATUS_LABELS, CLAIM_PRIORITY_LABELS, CLAIM_CATEGORY_LABELS } from '@/types/database';
import type { Claim } from '@/types/database';
import { Plus, Search, Eye, AlertTriangle } from 'lucide-react';

const STATUS_BADGE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  open: 'info', assigned: 'warning', in_progress: 'warning', visited: 'info',
  resolved: 'success', closed: 'default', cancelled: 'danger',
};
const PRIORITY_BADGE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  low: 'default', normal: 'info', high: 'warning', urgent: 'danger',
};
const STATUS_OPTIONS = [{ value: '', label: 'Todos' }, ...Object.entries(CLAIM_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))];
const PRIORITY_OPTIONS = [{ value: '', label: 'Todas' }, ...Object.entries(CLAIM_PRIORITY_LABELS).map(([v, l]) => ({ value: v, label: l }))];

export default function ClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');

  useEffect(() => { loadClaims(); }, [search, filterStatus, filterPriority]);

  const loadClaims = async () => {
    setLoading(true);
    try {
      const result = await listClaims({ search: search || undefined, status: filterStatus || undefined, priority: filterPriority || undefined });
      setClaims(result.data); setCount(result.count);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const daysSince = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000);

  return (
    <DashboardLayout role="admin" title="Reclamos">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div><h2 className="text-2xl font-bold text-gray-900">Reclamos</h2><p className="text-gray-500">{count} reclamo(s)</p></div>
          <Link to="/admin/reclamos/nuevo"><Button><Plus size={16} className="mr-2" /> Nuevo Reclamo</Button></Link>
        </div>
        <Card><CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
            <Select options={STATUS_OPTIONS} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} />
            <Select options={PRIORITY_OPTIONS} value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} />
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-0">
          {loading ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" /></div>
          : claims.length === 0 ? <div className="text-center py-12"><AlertTriangle size={48} className="mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No se encontraron reclamos</p></div>
          : <div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">N.º</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Fecha</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Cliente</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Categoría</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Prioridad</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Estado</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Días</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600"></th>
          </tr></thead><tbody>
            {claims.map((c) => <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-3 font-mono font-semibold text-gray-900">{c.service_case ? `${(c.service_case as any).numbering_mode === 'test' ? 'PRUEBA ' : ''}N.º ${(c.service_case as any).case_number}` : '-'}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{new Date(c.claim_date).toLocaleDateString('es-AR')}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{(c.client as any)?.name || '-'}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{CLAIM_CATEGORY_LABELS[c.category]}</td>
              <td className="px-4 py-3"><Badge variant={PRIORITY_BADGE[c.priority]}>{CLAIM_PRIORITY_LABELS[c.priority]}</Badge></td>
              <td className="px-4 py-3"><Badge variant={STATUS_BADGE[c.status]}>{CLAIM_STATUS_LABELS[c.status]}</Badge></td>
              <td className="px-4 py-3 text-sm text-gray-500">{daysSince(c.claim_date)}d</td>
              <td className="px-4 py-3"><Link to={`/admin/reclamos/${c.id}`}><Button variant="ghost" size="sm"><Eye size={14} /></Button></Link></td>
            </tr>)}
          </tbody></table></div>}
        </CardContent></Card>
      </div>
    </DashboardLayout>
  );
}
