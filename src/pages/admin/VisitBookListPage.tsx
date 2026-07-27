import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import { listAllEntries } from '@/services/elevatorVisitBook.service';
import { VISIT_ENTRY_STATUS_LABELS, VISIT_ORIGIN_LABELS } from '@/types/database';
import { Eye, BookOpen, Search, Clock } from 'lucide-react';

const STATUS_BADGE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  draft: 'default',
  submitted: 'info',
  approved: 'success',
  rectified: 'warning',
  cancelled: 'danger',
};

export default function VisitBookListPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { loadEntries(); }, [search]);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const result = await listAllEntries({ search: search || undefined });
      setEntries(result.data);
      setCount(result.count);
    } catch (err) { console.error('[VisitBook] Error:', err); } finally { setLoading(false); }
  };

  const formatTime = (ts: string | null | undefined) => {
    if (!ts) return '-';
    return new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (mins: number | null | undefined) => {
    if (!mins) return '-';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <DashboardLayout role="admin" title="Libro de Visitas">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BookOpen size={24} />
              Libro Digital de Visitas
            </h2>
            <p className="text-gray-500">{count} asiento(s) registrado(s)</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="relative max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Buscar por título, descripción o número..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
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
                <p className="text-gray-500">
                  {search ? 'No se encontraron resultados' : 'No hay visitas registradas'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Asiento</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Fecha</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Ascensor</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Edificio</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Técnico</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Origen</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Documento</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                        <span className="flex items-center gap-1"><Clock size={12} /> Ingreso</span>
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                        <span className="flex items-center gap-1"><Clock size={12} /> Salida</span>
                      </th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Duración</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Estado</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Ver</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry: any) => (
                      <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono font-semibold text-gray-900">
                          N.º {entry.entry_number}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(entry.visit_date).toLocaleDateString('es-AR')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {(entry.elevator as any)?.code || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {(entry.elevator as any)?.building?.name || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {(entry.technician as any)?.full_name || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {VISIT_ORIGIN_LABELS[entry.origin_type] || entry.origin_type || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {entry.service_order ? (
                            <Link to={`/admin/ordenes-servicio/${entry.service_order_id}`} className="text-blue-600 hover:underline">
                              {(entry.service_order as any).subject || 'Orden'}
                            </Link>
                          ) : entry.service_record_id ? (
                            <span>Mant. #{entry.service_record_id.slice(0, 8)}</span>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {formatTime(entry.check_in_at)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {formatTime(entry.check_out_at)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {formatDuration(entry.duration_minutes)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={STATUS_BADGE[entry.status] || 'default'}>
                            {(VISIT_ENTRY_STATUS_LABELS as Record<string, string>)[entry.status] || entry.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Link to={`/admin/ascensores/${entry.elevator_id}/libro/${entry.id}`}>
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
