import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import { listAllEntries } from '@/services/elevatorVisitBook.service';
import { VISIT_ENTRY_STATUS_LABELS, VISIT_ORIGIN_LABELS } from '@/types/database';
import VisitBookPdfModal from '@/components/pdf/VisitBookPdfModal';
import { Eye, BookOpen, Search, Clock, FileDown, X } from 'lucide-react';

const STATUS_BADGE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  draft: 'default', in_progress: 'info', submitted: 'info',
  changes_requested: 'warning', approved: 'success', rectified: 'warning', cancelled: 'danger',
};

function formatCaseNumber(sc: any): string {
  if (!sc) return '';
  if (sc.numbering_mode === 'test') return `PRUEBA N.º ${sc.case_number}`;
  return `N.º ${sc.case_number}`;
}

function formatDateOnly(value?: string | null): string {
  if (!value) return '-';
  const [year, month, day] = value.slice(0, 10).split('-');
  if (!year || !month || !day) return value;
  return `${Number(day)}/${Number(month)}/${year}`;
}

function formatVisitDuration(entry: any): string {
  if (entry.duration_seconds !== null && entry.duration_seconds !== undefined && entry.duration_seconds > 0) {
    if (entry.duration_seconds < 60) return '<1 min';
    if (entry.duration_seconds < 120) return '1 min';
    if (entry.duration_seconds < 3600) return `${Math.floor(entry.duration_seconds / 60)} min`;
    const h = Math.floor(entry.duration_seconds / 3600);
    const m = Math.floor((entry.duration_seconds % 3600) / 60);
    return m > 0 ? `${h} h ${m} min` : `${h} h`;
  }
  if (entry.duration_minutes !== null && entry.duration_minutes !== undefined && entry.duration_minutes > 0) {
    if (entry.duration_minutes < 60) return `${entry.duration_minutes} min`;
    const h = Math.floor(entry.duration_minutes / 60);
    const m = entry.duration_minutes % 60;
    return m > 0 ? `${h} h ${m} min` : `${h} h`;
  }
  if (entry.check_in_at && entry.check_out_at) {
    const diff = Math.floor((new Date(entry.check_out_at).getTime() - new Date(entry.check_in_at).getTime()) / 1000);
    if (diff < 60) return '<1 min';
    if (diff < 120) return '1 min';
    if (diff < 3600) return `${Math.floor(diff / 60)} min`;
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    return m > 0 ? `${h} h ${m} min` : `${h} h`;
  }
  return '-';
}

function formatMaintenanceId(entry: any): string {
  if (entry.service_case) return formatCaseNumber(entry.service_case);
  const type = entry.title || 'Mantenimiento';
  const date = entry.visit_date ? formatDateOnly(entry.visit_date) : '';
  return `${type} — ${date}`;
}

export default function VisitBookListPage() {
  const [searchParams] = useSearchParams();
  const [entries, setEntries] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterOrigin, setFilterOrigin] = useState('');
  const [showPdfModal, setShowPdfModal] = useState(false);

  const initialElevatorId = searchParams.get('elevatorId') || '';
  const initialBuildingId = searchParams.get('buildingId') || '';

  useEffect(() => { loadEntries(); }, [search, filterStatus, filterOrigin]);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const result = await listAllEntries({ search: search || undefined, status: filterStatus || undefined });
      let filtered = result.data;
      if (filterOrigin) filtered = filtered.filter((e: any) => e.origin_type === filterOrigin);
      setEntries(filtered);
      setCount(filtered.length);
    } catch (err) { console.error('[VisitBook] Error:', err); } finally { setLoading(false); }
  };

  const clearFilters = () => { setSearch(''); setFilterStatus(''); setFilterOrigin(''); };

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
          <Button onClick={() => setShowPdfModal(true)}>
            <FileDown size={16} className="mr-2" /> Generar PDF
          </Button>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              <select className="border rounded px-3 py-2 text-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="">Todos los estados</option>
                {Object.entries(VISIT_ENTRY_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select className="border rounded px-3 py-2 text-sm" value={filterOrigin} onChange={(e) => setFilterOrigin(e.target.value)}>
                <option value="">Todos los orígenes</option>
                <option value="service_order">Orden de servicio</option>
                <option value="maintenance">Mantenimiento</option>
                <option value="claim">Reclamo</option>
                <option value="manual">Manual</option>
              </select>
              {(search || filterStatus || filterOrigin) && (
                <Button variant="outline" onClick={clearFilters}>
                  <X size={14} className="mr-1" /> Limpiar filtros
                </Button>
              )}
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
                <p className="text-gray-500">{search || filterStatus || filterOrigin ? 'No se encontraron resultados' : 'No hay visitas registradas'}</p>
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
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600"><span className="flex items-center gap-1"><Clock size={12} /> Ingreso</span></th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600"><span className="flex items-center gap-1"><Clock size={12} /> Salida</span></th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Duración</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Estado</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Ver</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry: any) => (
                      <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono font-semibold text-gray-900">N.º {entry.entry_number}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatDateOnly(entry.visit_date)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{(entry.elevator as any)?.code || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{(entry.elevator as any)?.building?.name || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{(entry.technician as any)?.full_name || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{VISIT_ORIGIN_LABELS[entry.origin_type] || entry.origin_type || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {entry.service_order ? (
                            <Link to={`/admin/ordenes-servicio/${entry.service_order_id}`} className="text-blue-600 hover:underline">
                              {entry.service_case ? formatCaseNumber(entry.service_case) : (entry.service_order as any).subject || 'Orden'}
                            </Link>
                          ) : entry.service_record_id ? (
                            <span>{formatMaintenanceId(entry)}</span>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatTime(entry.check_in_at)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatTime(entry.check_out_at)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatVisitDuration(entry)}</td>
                        <td className="px-4 py-3">
                          <Badge variant={STATUS_BADGE[entry.status] || 'default'}>
                            {(VISIT_ENTRY_STATUS_LABELS as Record<string, string>)[entry.status] || entry.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Link to={`/admin/ascensores/${entry.elevator_id}/libro/${entry.id}`}>
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

      {showPdfModal && (
        <VisitBookPdfModal
          initialElevatorId={initialElevatorId}
          initialBuildingId={initialBuildingId}
          allowBuildingScope={true}
          onClose={() => setShowPdfModal(false)}
        />
      )}
    </DashboardLayout>
  );
}

function formatTime(ts: string | null | undefined) {
  if (!ts) return '-';
  return new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
}
