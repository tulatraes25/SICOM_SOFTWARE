import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listMonthlyReports, getMonthlyReportStats, createMonthlyReport, findMonthlyReportByPeriod, validateReportRelations } from '@/services/monthlyReportEnhanced.service';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Select from '@/components/ui/Select';
import { supabase } from '@/config/supabase';
import { FileText, Eye, Plus, AlertCircle, RefreshCw } from 'lucide-react';

const STATUS_BADGE: Record<string, 'default' | 'success' | 'warning' | 'info'> = {
  draft: 'default', reviewed: 'warning', approved: 'info', sent: 'success',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador', reviewed: 'Revisado', approved: 'Aprobado', sent: 'Enviado',
};

const MONTH_NAMES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

interface MonthlyListItem {
  id: string;
  report_month: number;
  report_year: number;
  status: string;
  pdf_url: string | null;
  elevator?: { code?: string; building?: { name?: string } } | null;
}

export default function MonthlyReportsPage() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<MonthlyListItem[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, generated: 0, sent: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Form state
  const [clientId, setClientId] = useState('');
  const [buildingId, setBuildingId] = useState('');
  const [elevatorId, setElevatorId] = useState('');
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [buildings, setBuildings] = useState<Array<{ id: string; name: string }>>([]);
  const [elevators, setElevators] = useState<Array<{ id: string; code: string }>>([]);

  const requestIdRef = useRef(0);
  const createRef = useRef(false);

  useEffect(() => { loadData(); }, [filterStatus]);

  useEffect(() => {
    supabase.from('clients').select('id, name').eq('active', true).order('name')
      .then(({ data }) => setClients((data || []) as Array<{ id: string; name: string }>));
  }, []);

  useEffect(() => {
    if (clientId) {
      supabase.from('buildings').select('id, name').eq('client_id', clientId).eq('active', true).order('name')
        .then(({ data }) => setBuildings((data || []) as Array<{ id: string; name: string }>));
      setBuildingId('');
      setElevatorId('');
    } else {
      setBuildings([]);
      setElevatorId('');
    }
  }, [clientId]);

  useEffect(() => {
    if (buildingId) {
      supabase.from('elevators').select('id, code').eq('building_id', buildingId).eq('active', true).order('code')
        .then(({ data }) => setElevators((data || []) as Array<{ id: string; code: string }>));
      setElevatorId('');
    } else {
      setElevators([]);
    }
  }, [buildingId]);

  const loadData = async () => {
    const reqId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const [reportsData, statsData] = await Promise.all([
        listMonthlyReports(filterStatus ? { status: filterStatus } : undefined),
        getMonthlyReportStats(),
      ]);
      if (reqId !== requestIdRef.current) return;
      setReports(reportsData as unknown as MonthlyListItem[]);
      setStats(statsData);
    } catch {
      if (reqId !== requestIdRef.current) return;
      setReports([]);
      setError('No se pudieron cargar los informes mensuales.');
    } finally {
      if (reqId === requestIdRef.current) setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!clientId) { setCreateError('Seleccioná un cliente.'); return; }
    if (!buildingId) { setCreateError('Seleccioná un edificio.'); return; }
    if (!elevatorId) { setCreateError('Seleccioná un ascensor.'); return; }
    if (reportMonth < 1 || reportMonth > 12) { setCreateError('Mes inválido.'); return; }
    if (reportYear < 2020 || reportYear > 2100) { setCreateError('Año inválido.'); return; }

    if (createRef.current) return;
    createRef.current = true;
    setCreating(true);
    setCreateError('');
    try {
      await validateReportRelations(clientId, buildingId, elevatorId);

      const existing = await findMonthlyReportByPeriod(elevatorId, reportYear, reportMonth);
      if (existing) {
        setCreateError('Ya existe un informe para este ascensor y período.');
        setCreating(false);
        createRef.current = false;
        return;
      }

      const result = await createMonthlyReport({
        elevator_id: elevatorId,
        client_id: clientId,
        building_id: buildingId,
        report_month: reportMonth,
        report_year: reportYear,
      });

      setShowCreate(false);
      navigate(`/admin/informes-mensuales/${result.id}`);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Error al crear');
      setCreating(false);
      createRef.current = false;
    }
  };

  const openCreate = () => {
    setClientId('');
    setBuildingId('');
    setElevatorId('');
    setCreateError('');
    setShowCreate(true);
  };

  return (
    <DashboardLayout role="admin" title="Informes Mensuales">
      <div className="space-y-4 2xl:space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl 2xl:text-2xl font-bold text-gray-900">Informes Mensuales</h2>
            <p className="text-gray-500">{stats.total} informe(s)</p>
          </div>
          <Button onClick={openCreate}><Plus size={16} className="mr-2" /> Nuevo informe mensual</Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 2xl:gap-4">
          {[{ label: 'Total', value: stats.total, bg: 'bg-gray-100' }, { label: 'Pendientes', value: stats.pending, bg: 'bg-warning/10' }, { label: 'Con PDF', value: stats.generated, bg: 'bg-info/10' }, { label: 'Enviados', value: stats.sent, bg: 'bg-success/10' }].map((s) => (
            <Card key={s.label}><CardContent><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">{s.label}</p><p className="text-2xl 2xl:text-3xl font-bold text-gray-900">{s.value}</p></div></div></CardContent></Card>
          ))}
        </div>

        {error && (
          <div role="alert" className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm flex items-center justify-between">
            <span className="flex items-center gap-2"><AlertCircle size={16} /> {error}</span>
            <Button size="sm" variant="outline" onClick={loadData}><RefreshCw size={14} /> Reintentar</Button>
          </div>
        )}

        <Select options={[{ value: '', label: 'Todos los estados' }, ...Object.entries(STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))]} value={filterStatus} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterStatus(e.target.value)} />

        <Card><CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : reports.length === 0 ? (
            <div className="text-center py-8">
              <FileText size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No hay informes mensuales</p>
              <p className="text-sm text-gray-400">Creá el primer informe para comenzar.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Período</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Ascensor</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Edificio</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Estado</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">PDF</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600"></th>
                </tr></thead>
                <tbody>
                  {reports.map((r) => {
                    const e = r.elevator as Record<string, unknown>;
                    return (
                      <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium">{MONTH_NAMES[r.report_month || 0]} {r.report_year}</td>
                        <td className="py-3 px-4 font-mono">{(e?.code as string) || '-'}</td>
                        <td className="py-3 px-4 text-gray-600">{((e as Record<string, unknown>)?.building as Record<string, unknown>)?.name as string || '-'}</td>
                        <td className="py-3 px-4"><Badge variant={STATUS_BADGE[r.status]}>{STATUS_LABELS[r.status]}</Badge></td>
                        <td className="py-3 px-4">{r.pdf_url ? <Badge variant="success">Generado</Badge> : <Badge variant="default">Pendiente</Badge>}</td>
                        <td className="py-3 px-4 text-right"><Link to={`/admin/informes-mensuales/${r.id}`}><Button size="sm"><Eye size={14} className="mr-1" /> Ver</Button></Link></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent></Card>

        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold mb-4">Nuevo Informe Mensual</h3>
              {createError && <div role="alert" className="p-2 bg-danger/10 rounded text-danger text-sm mb-3 flex items-center gap-2"><AlertCircle size={14} /> {createError}</div>}
              <div className="space-y-3">
                <Select label="Cliente *" options={[{ value: '', label: 'Seleccionar' }, ...clients.map((c) => ({ value: c.id, label: c.name }))]} value={clientId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setClientId(e.target.value); setCreateError(''); }} />
                <Select label="Edificio *" options={[{ value: '', label: 'Seleccionar' }, ...buildings.map((b) => ({ value: b.id, label: b.name }))]} value={buildingId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setBuildingId(e.target.value); setCreateError(''); }} disabled={!clientId} />
                <Select label="Ascensor *" options={[{ value: '', label: 'Seleccionar' }, ...elevators.map((el) => ({ value: el.id, label: el.code }))]} value={elevatorId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setElevatorId(e.target.value); setCreateError(''); }} disabled={!buildingId} />
                <div className="grid grid-cols-2 gap-3">
                  <Select label="Mes" options={MONTH_NAMES.slice(1).map((m, i) => ({ value: String(i + 1), label: m }))} value={String(reportMonth)} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setReportMonth(parseInt(e.target.value))} />
                  <Select label="Año" options={Array.from({ length: 5 }, (_, i) => ({ value: String(new Date().getFullYear() - 2 + i), label: String(new Date().getFullYear() - 2 + i) }))} value={String(reportYear)} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setReportYear(parseInt(e.target.value))} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
                  <Button onClick={handleCreate} disabled={creating}>{creating ? 'Creando...' : 'Crear borrador'}</Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
