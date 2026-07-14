import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/config/supabase';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { listEntriesByElevator } from '@/services/elevatorVisitBook.service';
import { VISIT_ENTRY_TYPE_LABELS, VISIT_ENTRY_STATUS_LABELS } from '@/types/database';
import type { ElevatorVisitEntry } from '@/types/database';
import { Plus, Search, Eye, BookOpen, ArrowLeft } from 'lucide-react';

const STATUS_BADGE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  draft: 'default',
  submitted: 'info',
  approved: 'success',
  rectified: 'warning',
  cancelled: 'danger',
};

const TYPE_OPTIONS = [
  { value: '', label: 'Todos los tipos' },
  ...Object.entries(VISIT_ENTRY_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l })),
];

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  ...Object.entries(VISIT_ENTRY_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l })),
];

export default function ElevatorVisitBookPage() {
  const { elevatorId } = useParams<{ elevatorId: string }>();
  const [elevator, setElevator] = useState<{ code: string; building?: any } | null>(null);
  const [entries, setEntries] = useState<ElevatorVisitEntry[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    if (elevatorId) loadElevator();
  }, [elevatorId]);

  useEffect(() => {
    if (elevatorId) loadEntries();
  }, [elevatorId, search, filterType, filterStatus]);

  const loadElevator = async () => {
    if (!elevatorId) return;
    const { data } = await supabase
      .from('elevators')
      .select('id, code, building:buildings(name, address, client:clients(name))')
      .eq('id', elevatorId)
      .single();
    setElevator(data);
  };

  const loadEntries = async () => {
    if (!elevatorId) return;
    setLoading(true);
    try {
      const result = await listEntriesByElevator(elevatorId, {
        search: search || undefined,
        entry_type: filterType || undefined,
        status: filterStatus || undefined,
      });
      setEntries(result.data);
      setCount(result.count);
    } catch (err) {
      console.error('Error loading visit entries:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="admin" title="Libro de Visitas">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Link to={`/admin/ascensores`} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2">
              <ArrowLeft size={18} /> Volver a ascensores
            </Link>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BookOpen size={24} />
              Libro de Visitas — {elevator?.code || '...'}
            </h2>
            <p className="text-gray-500">
              {(elevator?.building as any)?.name || '...'} — {count} asiento(s)
            </p>
          </div>
          <Link to={`/admin/ascensores/${elevatorId}/libro/nuevo`}>
            <Button>
              <Plus size={16} className="mr-2" />
              Nuevo Asiento
            </Button>
          </Link>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select options={TYPE_OPTIONS} value={filterType} onChange={(e) => setFilterType(e.target.value)} />
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
            ) : entries.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">No hay asientos en el libro de visitas</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Asiento</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Fecha Visita</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Tipo</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Expediente</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Técnico</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Estado</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono font-semibold text-gray-900">
                          N.º {entry.entry_number}
                          {entry.is_rectification && (
                            <Badge variant="warning" className="ml-2 text-xs">Rectificación</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(entry.visit_date).toLocaleDateString('es-AR')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {VISIT_ENTRY_TYPE_LABELS[entry.entry_type]}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {entry.service_case
                            ? `N.º ${(entry.service_case as any).case_number}`
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {(entry.technician as any)?.full_name || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={STATUS_BADGE[entry.status]}>
                            {VISIT_ENTRY_STATUS_LABELS[entry.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Link to={`/admin/ascensores/${elevatorId}/libro/${entry.id}`}>
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
