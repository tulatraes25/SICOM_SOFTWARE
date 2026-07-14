import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { listServiceCases, formatCaseNumber } from '@/services/serviceCases.service';
import { CASE_ORIGIN_LABELS, CASE_STATUS_LABELS } from '@/types/database';
import type { ServiceCase } from '@/types/database';
import { Plus, Search, Eye, FolderOpen } from 'lucide-react';

const STATUS_BADGE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  open: 'info',
  assigned: 'warning',
  in_progress: 'warning',
  completed: 'success',
  closed: 'default',
  cancelled: 'danger',
};

const ORIGIN_OPTIONS = [
  { value: '', label: 'Todos los orígenes' },
  { value: 'budget', label: 'Presupuesto' },
  { value: 'claim', label: 'Reclamo' },
  { value: 'direct_report', label: 'Informe directo' },
  { value: 'scheduled_service', label: 'Servicio programado' },
  { value: 'other', label: 'Otro' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'open', label: 'Abierto' },
  { value: 'assigned', label: 'Asignado' },
  { value: 'in_progress', label: 'En curso' },
  { value: 'completed', label: 'Completado' },
  { value: 'closed', label: 'Cerrado' },
  { value: 'cancelled', label: 'Anulado' },
];

const MODE_OPTIONS = [
  { value: '', label: 'Todos los modos' },
  { value: 'test', label: 'Prueba' },
  { value: 'production', label: 'Producción' },
];

export default function ServiceCasesPage() {
  const [cases, setCases] = useState<ServiceCase[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterOrigin, setFilterOrigin] = useState('');
  const [filterMode, setFilterMode] = useState('');

  useEffect(() => {
    loadCases();
  }, [search, filterStatus, filterOrigin, filterMode]);

  const loadCases = async () => {
    setLoading(true);
    try {
      const result = await listServiceCases({
        search: search || undefined,
        status: filterStatus || undefined,
        origin_type: filterOrigin || undefined,
        numbering_mode: filterMode || undefined,
        limit: 50,
      });
      setCases(result.data);
      setCount(result.count);
    } catch (err) {
      console.error('Error loading cases:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="admin" title="Expedientes">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Expedientes</h2>
            <p className="text-gray-500">{count} expediente(s) registrado(s)</p>
          </div>
          <Link to="/admin/expedientes/nuevo">
            <Button>
              <Plus size={16} className="mr-2" />
              Nuevo Expediente
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Buscar por número o título..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                options={STATUS_OPTIONS}
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              />
              <Select
                options={ORIGIN_OPTIONS}
                value={filterOrigin}
                onChange={(e) => setFilterOrigin(e.target.value)}
              />
              <Select
                options={MODE_OPTIONS}
                value={filterMode}
                onChange={(e) => setFilterMode(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : cases.length === 0 ? (
              <div className="text-center py-12">
                <FolderOpen size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">No se encontraron expedientes</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Número</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Modo</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Origen</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Título</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Cliente</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Estado</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Creado</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cases.map((sc) => (
                      <tr key={sc.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className="font-mono font-semibold text-gray-900">
                            {formatCaseNumber(sc.case_number, sc.numbering_mode)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={sc.numbering_mode === 'test' ? 'warning' : 'success'}>
                            {sc.numbering_mode === 'test' ? 'PRUEBA' : 'PROD'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {CASE_ORIGIN_LABELS[sc.origin_type]}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 max-w-[200px] truncate">
                          {sc.title || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {(sc.client as any)?.name || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={STATUS_BADGE[sc.status] || 'default'}>
                            {CASE_STATUS_LABELS[sc.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {new Date(sc.created_at).toLocaleDateString('es-AR')}
                        </td>
                        <td className="px-4 py-3">
                          <Link to={`/admin/expedientes/${sc.id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye size={14} />
                            </Button>
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
