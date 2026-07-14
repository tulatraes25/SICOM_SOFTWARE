import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { listBudgets } from '@/services/budgets.service';
import { BUDGET_STATUS_LABELS } from '@/types/database';
import type { Budget } from '@/types/database';
import { Plus, Search, Eye, FileText } from 'lucide-react';

const STATUS_BADGE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  draft: 'default',
  ready: 'info',
  sent: 'info',
  accepted: 'success',
  rejected: 'danger',
  expired: 'warning',
  cancelled: 'danger',
};

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  ...Object.entries(BUDGET_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l })),
];

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => { loadBudgets(); }, [search, filterStatus]);

  const loadBudgets = async () => {
    setLoading(true);
    try {
      const result = await listBudgets({
        search: search || undefined,
        status: filterStatus || undefined,
      });
      setBudgets(result.data);
      setCount(result.count);
    } catch (err) {
      console.error('Error loading budgets:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="admin" title="Presupuestos">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Presupuestos</h2>
            <p className="text-gray-500">{count} presupuesto(s)</p>
          </div>
          <Link to="/admin/presupuestos/nuevo">
            <Button><Plus size={16} className="mr-2" /> Nuevo Presupuesto</Button>
          </Link>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input placeholder="Buscar por asunto o número..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select options={STATUS_OPTIONS} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : budgets.length === 0 ? (
              <div className="text-center py-12">
                <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">No se encontraron presupuestos</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Número</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Fecha</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Cliente</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Asunto</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Total</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Estado</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgets.map((b) => (
                      <tr key={b.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono font-semibold text-gray-900">
                          {b.service_case ? (
                            <>
                              {(b.service_case as any).numbering_mode === 'test' ? 'PRUEBA ' : ''}N.º {(b.service_case as any).case_number}
                            </>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{new Date(b.budget_date).toLocaleDateString('es-AR')}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{(b.client as any)?.name || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 max-w-[200px] truncate">{b.subject}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatCurrency(b.total)}</td>
                        <td className="px-4 py-3">
                          <Badge variant={STATUS_BADGE[b.status]}>{BUDGET_STATUS_LABELS[b.status]}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Link to={`/admin/presupuestos/${b.id}`}>
                            <Button variant="ghost" size="sm"><Eye size={14} /></Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
