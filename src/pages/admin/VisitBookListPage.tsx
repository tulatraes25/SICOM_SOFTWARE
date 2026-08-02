import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/config/supabase';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import { listAllEntries } from '@/services/elevatorVisitBook.service';
import { VISIT_ENTRY_STATUS_LABELS, VISIT_ORIGIN_LABELS } from '@/types/database';
import { formatVisitDuration } from '@/utils/visitDuration';
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

function formatMaintenanceId(entry: any): string {
  if (entry.service_case) return formatCaseNumber(entry.service_case);
  const type = entry.title || 'Mantenimiento';
  const date = entry.visit_date ? formatDateOnly(entry.visit_date) : '';
  return `${type} — ${date}`;
}

function formatTime(ts: string | null | undefined) {
  if (!ts) return '-';
  return new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function VisitBookListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [entries, setEntries] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showPdfModal, setShowPdfModal] = useState(false);

  // Filter states
  const [clientId, setClientId] = useState('');
  const [buildingId, setBuildingId] = useState('');
  const [elevatorId, setElevatorId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterOrigin, setFilterOrigin] = useState('');
  const [filterTechnician, setFilterTechnician] = useState('');
  const [search, setSearch] = useState('');

  // Cascade data
  const [clients, setClients] = useState<any[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [elevators, setElevators] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);

  // Load cascade options
  useEffect(() => {
    supabase.from('clients').select('id, name').eq('active', true).order('name').then(({ data, error }) => {
      if (error) console.error('Error loading clients:', error);
      else setClients(data || []);
    });
    supabase.from('profiles').select('id, full_name').eq('role', 'technician').eq('active', true).order('full_name').then(({ data, error }) => {
      if (error) console.error('Error loading technicians:', error);
      else setTechnicians(data || []);
    });
  }, []);

  useEffect(() => {
    if (!clientId) { setBuildings([]); return; }
    supabase.from('buildings').select('id, name, client_id').eq('client_id', clientId).eq('active', true).order('name').then(({ data }) => setBuildings(data || []));
  }, [clientId]);

  useEffect(() => {
    if (!buildingId) { setElevators([]); return; }
    supabase.from('elevators').select('id, code, building_id').eq('building_id', buildingId).eq('active', true).order('code').then(({ data }) => setElevators(data || []));
  }, [buildingId]);

  // Resolve query params on mount
  useEffect(() => {
    const bId = searchParams.get('buildingId');
    const eId = searchParams.get('elevatorId');
    if (bId) setBuildingId(bId);
    if (eId) setElevatorId(eId);
    if (bId && !clientId) {
      supabase.from('buildings').select('client_id').eq('id', bId).single().then(({ data }) => {
        if (data?.client_id) setClientId(data.client_id);
      });
    }
  }, []);

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (buildingId) params.set('buildingId', buildingId);
    if (elevatorId) params.set('elevatorId', elevatorId);
    setSearchParams(params, { replace: true });
  }, [buildingId, elevatorId]);

  // Load entries
  useEffect(() => { loadEntries(); }, [clientId, buildingId, elevatorId, filterStatus, filterOrigin, filterTechnician, dateFrom, dateTo, search]);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const result = await listAllEntries({
        clientId: clientId || undefined,
        buildingId: buildingId || undefined,
        elevatorId: elevatorId || undefined,
        technicianId: filterTechnician || undefined,
        status: filterStatus || undefined,
        originType: filterOrigin || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        search: search || undefined,
      });
      setEntries(result.data);
      setCount(result.count);
    } catch (err) { console.error('[VisitBook] Error:', err); } finally { setLoading(false); }
  };

  const clearFilters = () => {
    setClientId(''); setBuildingId(''); setElevatorId('');
    setDateFrom(''); setDateTo('');
    setFilterStatus(''); setFilterOrigin(''); setFilterTechnician(''); setSearch('');
    setSearchParams({}, { replace: true });
  };

  const hasActiveFilters = clientId || buildingId || elevatorId || dateFrom || dateTo || filterStatus || filterOrigin || filterTechnician || search;

  return (
    <DashboardLayout role="admin" title="Libro de Visitas">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BookOpen size={24} />
              Libro Digital de Visitas
            </h2>
            <p className="text-gray-500">{count === 1 ? '1 asiento registrado' : `${count} asientos registrados`}</p>
          </div>
          <Button onClick={() => setShowPdfModal(true)}>
            <FileDown size={16} className="mr-2" /> Generar PDF
          </Button>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <select className="border rounded px-3 py-2 text-sm" value={clientId} onChange={(e) => { setClientId(e.target.value); setBuildingId(''); setElevatorId(''); }}>
                <option value="">Todos los clientes</option>
                {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select className="border rounded px-3 py-2 text-sm" value={buildingId} onChange={(e) => { setBuildingId(e.target.value); setElevatorId(''); }} disabled={!clientId}>
                <option value="">Todos los edificios</option>
                {buildings.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <select className="border rounded px-3 py-2 text-sm" value={elevatorId} onChange={(e) => setElevatorId(e.target.value)} disabled={!buildingId}>
                <option value="">Todos los ascensores</option>
                {elevators.map((el: any) => <option key={el.id} value={el.id}>{el.code}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border rounded px-3 py-2 text-sm" placeholder="Desde" />
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border rounded px-3 py-2 text-sm" placeholder="Hasta" />
              <select className="border rounded px-3 py-2 text-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="">Todos los estados</option>
                {Object.entries(VISIT_ENTRY_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-3">
              <select className="border rounded px-3 py-2 text-sm" value={filterOrigin} onChange={(e) => setFilterOrigin(e.target.value)}>
                <option value="">Todos los orígenes</option>
                <option value="service_order">Orden de servicio</option>
                <option value="maintenance">Mantenimiento</option>
                <option value="claim">Reclamo</option>
                <option value="manual">Manual</option>
              </select>
              <select className="border rounded px-3 py-2 text-sm" value={filterTechnician} onChange={(e) => setFilterTechnician(e.target.value)}>
                <option value="">Todos los técnicos</option>
                {technicians.map((t: any) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
              {hasActiveFilters && (
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
                <p className="text-gray-500">{hasActiveFilters ? 'No se encontraron resultados' : 'No hay visitas registradas'}</p>
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
          initialClientId={clientId}
          initialBuildingId={buildingId}
          initialElevatorId={elevatorId}
          initialScope={buildingId && !elevatorId ? 'building' : 'elevator'}
          allowBuildingScope={true}
          onClose={() => setShowPdfModal(false)}
        />
      )}
    </DashboardLayout>
  );
}
