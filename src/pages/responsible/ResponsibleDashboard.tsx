import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { getResponsibleElevators, getResponsibleVisitEntries, getResponsibleMonthlyReports, getResponsibleBuildings, getErrorMessage } from '@/services/responsiblePortalService';
import type { ResponsibleElevator, ResponsibleVisitEntry, ResponsibleMonthlyReport, ResponsibleBuilding } from '@/services/responsiblePortalService';
import { Building2, FileText, Eye, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { formatVisitDuration } from '@/utils/visitDuration';

function formatDateOnly(v?: string | null): string { if (!v) return '-'; const [y, m, d] = v.slice(0, 10).split('-'); return `${Number(d)}/${Number(m)}/${y}`; }
const ORIGIN_LABELS: Record<string, string> = { maintenance: 'Mantenimiento', service_order: 'Orden de servicio', inspection: 'Inspección', manual: 'Registro manual', claim: 'Reclamo' };

export default function ResponsibleDashboard() {
  const { profile } = useAuth();
  const [buildings, setBuildings] = useState<ResponsibleBuilding[]>([]);
  const [elevators, setElevators] = useState<ResponsibleElevator[]>([]);
  const [visits, setVisits] = useState<ResponsibleVisitEntry[]>([]);
  const [reports, setReports] = useState<ResponsibleMonthlyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true); setError('');
    try {
      const [blds, els, vis, rep] = await Promise.all([
        getResponsibleBuildings(), getResponsibleElevators(),
        getResponsibleVisitEntries(), getResponsibleMonthlyReports(),
      ]);
      setBuildings(blds); setElevators(els); setVisits(vis); setReports(rep);
    } catch (err: unknown) { setError(getErrorMessage(err)); } finally { setLoading(false); }
  };

  const buildingMap = useMemo(() => new Map(buildings.map((b) => [b.id, b])), [buildings]);
  const elevatorMap = useMemo(() => new Map(elevators.map((e) => [e.id, e])), [elevators]);

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`;
  const monthVisitsCount = visits.filter((v) => v.visit_date >= monthStart && v.visit_date <= monthEnd).length;
  const recentVisits = useMemo(() => [...visits].sort((a, b) => b.visit_date.localeCompare(a.visit_date)).slice(0, 10), [visits]);

  const stats = [
    { label: 'Edificios', value: buildings.length, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Ascensores', value: elevators.length, icon: Building2, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Visitas del mes', value: monthVisitsCount, icon: Clock, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Informes', value: reports.length, icon: FileText, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  return (
    <DashboardLayout role="responsible" title="Portal del Responsable">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Bienvenido/a, {profile?.full_name || 'Responsable'}</h2>
          <Button variant="outline" onClick={loadData} disabled={loading}><RefreshCw size={14} className="mr-1" /> Actualizar</Button>
        </div>
        {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((s) => { const Icon = s.icon; return (
            <Card key={s.label}><CardContent><div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-600">{s.label}</p><p className="text-2xl font-bold text-gray-900">{s.value}</p></div>
              <div className={`p-2 rounded-lg ${s.bg} ${s.color}`}><Icon size={20} /></div>
            </div></CardContent></Card>
          );})}
        </div>
        <Card><CardContent>
          <h3 className="font-semibold text-gray-900 mb-4">Última actividad</h3>
          {loading ? <div className="text-center py-6"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
          : recentVisits.length === 0 ? <p className="text-gray-500 text-center py-6">No hay visitas recientes</p>
          : <div className="space-y-3">
            {recentVisits.map((v) => {
              const el = elevatorMap.get(v.elevator_id);
              const bld = el ? buildingMap.get(el.building_id) : null;
              return (
                <div key={v.id} className="p-3 bg-gray-50 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold">{formatDateOnly(v.visit_date)}</span>
                      <Badge variant="success" className="text-xs">Aprobado</Badge>
                      {v.case_number && <span className="text-xs text-gray-400">N.º {v.case_number}</span>}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{bld?.name || '-'} · {el?.code || '-'}</p>
                    <p className="text-xs text-gray-500">{ORIGIN_LABELS[v.origin_type || ''] || v.origin_type || '-'} · {v.title || v.description}</p>
                    <p className="text-xs text-gray-400">{formatVisitDuration(v)}</p>
                  </div>
                  <Link to={`/responsable/ascensores/${v.elevator_id}`}><Button size="sm" variant="ghost"><Eye size={14} /></Button></Link>
                </div>
              );
            })}
          </div>}
        </CardContent></Card>
      </div>
    </DashboardLayout>
  );
}
