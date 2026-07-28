import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { getResponsibleElevators, getResponsibleVisitEntries, getResponsibleMonthlyReports, getResponsibleBuildings } from '@/services/responsiblePortalService';
import type { ResponsibleElevator, ResponsibleVisitEntry, ResponsibleMonthlyReport, ResponsibleBuilding } from '@/services/responsiblePortalService';
import { Building2, FileText, Eye, Clock, AlertCircle, RefreshCw } from 'lucide-react';

function formatDateOnly(v?: string | null): string {
  if (!v) return '-';
  const [y, m, d] = v.slice(0, 10).split('-');
  return `${Number(d)}/${Number(m)}/${y}`;
}

function formatDuration(e: any): string {
  if (e.duration_seconds !== null && e.duration_seconds !== undefined && e.duration_seconds > 0) {
    if (e.duration_seconds < 60) return '<1 min';
    if (e.duration_seconds < 3600) return `${Math.floor(e.duration_seconds / 60)} min`;
    const h = Math.floor(e.duration_seconds / 3600);
    const m = Math.floor((e.duration_seconds % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  if (e.duration_minutes) return `${e.duration_minutes} min`;
  return '-';
}

const STATUS_BADGE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  draft: 'default', in_progress: 'info', submitted: 'info',
  changes_requested: 'warning', approved: 'success', cancelled: 'danger',
};

export default function ResponsibleDashboard() {
  const { user } = useAuth();
  const [buildings, setBuildings] = useState<ResponsibleBuilding[]>([]);
  const [elevators, setElevators] = useState<ResponsibleElevator[]>([]);
  const [visits, setVisits] = useState<ResponsibleVisitEntry[]>([]);
  const [reports, setReports] = useState<ResponsibleMonthlyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { if (user) loadData(); }, [user]);

  const loadData = async () => {
    setLoading(true); setError('');
    try {
      const [blds, els, vis, rep] = await Promise.all([
        getResponsibleBuildings(),
        getResponsibleElevators(),
        getResponsibleVisitEntries(),
        getResponsibleMonthlyReports(),
      ]);
      setBuildings(blds);
      setElevators(els);
      setVisits(vis.slice(0, 10));
      setReports(rep);
    } catch (err: any) { setError(err?.message || 'Error al cargar datos'); } finally { setLoading(false); }
  };

  const stats = [
    { label: 'Edificios', value: buildings.length, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Ascensores', value: elevators.length, icon: Building2, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Visitas del mes', value: visits.length, icon: Clock, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Informes', value: reports.length, icon: FileText, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  return (
    <DashboardLayout role="responsible" title="Portal del Responsable">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Bienvenido/a, {user?.email?.split('@')[0]}</h2>
          <Button variant="outline" onClick={loadData} disabled={loading}><RefreshCw size={14} className="mr-1" /> Actualizar</Button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.label}>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div><p className="text-sm text-gray-600">{s.label}</p><p className="text-2xl font-bold text-gray-900">{s.value}</p></div>
                    <div className={`p-2 rounded-lg ${s.bg} ${s.color}`}><Icon size={20} /></div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardContent>
            <h3 className="font-semibold text-gray-900 mb-4">Última actividad</h3>
            {loading ? (
              <div className="text-center py-6"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
            ) : visits.length === 0 ? (
              <p className="text-gray-500 text-center py-6">No hay visitas recientes</p>
            ) : (
              <div className="space-y-3">
                {visits.map((v) => (
                  <div key={v.id} className="p-3 bg-gray-50 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-semibold">{formatDateOnly(v.visit_date)}</span>
                        <Badge variant={STATUS_BADGE[v.status] || 'default'} className="text-xs">{v.status}</Badge>
                      </div>
                      <p className="text-sm text-gray-600 truncate mt-1">{v.title || v.description}</p>
                      <p className="text-xs text-gray-400">{formatDuration(v)} · {v.origin_type || '-'}</p>
                    </div>
                    <Link to={`/responsable/ascensores/${v.elevator_id}`}>
                      <Button size="sm" variant="ghost"><Eye size={14} /></Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
