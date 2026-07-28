import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { getResponsibleElevators, getResponsibleVisitEntries, getResponsibleBuildings } from '@/services/responsiblePortalService';
import type { ResponsibleElevator, ResponsibleVisitEntry } from '@/services/responsiblePortalService';
import { OPERATIONAL_STATUS_LABELS, STATUS_COLORS } from '@/types/elevators';
import { ArrowLeft, AlertCircle } from 'lucide-react';

function formatDateOnly(v?: string | null): string {
  if (!v) return '-';
  const [y, m, d] = v.slice(0, 10).split('-');
  return `${Number(d)}/${Number(m)}/${y}`;
}

export default function ResponsibleBuildingDetailPage() {
  const { buildingId } = useParams<{ buildingId: string }>();
  const navigate = useNavigate();
  const [elevators, setElevators] = useState<ResponsibleElevator[]>([]);
  const [visits, setVisits] = useState<ResponsibleVisitEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [buildingName, setBuildingName] = useState('');

  useEffect(() => { if (buildingId) loadData(); }, [buildingId]);

  const loadData = async () => {
    setLoading(true); setError('');
    try {
      const [els, vis, blds] = await Promise.all([
        getResponsibleElevators(buildingId),
        getResponsibleVisitEntries(),
        getResponsibleBuildings(),
      ]);
      const building = blds.find((b) => b.id === buildingId);
      if (!building) { setError('No tiene permiso para consultar este recurso'); return; }
      setBuildingName(building.name);
      setElevators(els);
      const elevatorIds = new Set(els.map((e) => e.id));
      setVisits(vis.filter((v) => elevatorIds.has(v.elevator_id)).slice(0, 10));
    } catch (err: any) { setError(err?.message || 'Error'); } finally { setLoading(false); }
  };

  if (loading) return <DashboardLayout role="responsible" title="Edificio"><div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" /></div></DashboardLayout>;
  if (error) return <DashboardLayout role="responsible" title="Edificio"><div className="max-w-2xl mx-auto"><button onClick={() => navigate('/responsable/edificios')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"><ArrowLeft size={18} /> Volver</button><Card><CardContent><div className="text-center py-8"><AlertCircle size={48} className="mx-auto text-danger mb-4" /><p className="text-gray-600">{error}</p></div></CardContent></Card></div></DashboardLayout>;

  return (
    <DashboardLayout role="responsible" title={buildingName || 'Edificio'}>
      <div className="space-y-6">
        <button onClick={() => navigate('/responsable/edificios')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900"><ArrowLeft size={18} /> Volver</button>
        <h2 className="text-xl font-bold text-gray-900">{buildingName}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card><CardHeader><h3 className="font-semibold text-gray-900">Ascensores ({elevators.length})</h3></CardHeader><CardContent className="space-y-3">
            {elevators.length === 0 ? <p className="text-gray-500">No hay ascensores asignados</p> : elevators.map((e) => (
              <Link key={e.id} to={`/responsable/ascensores/${e.id}`} className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                <div className="flex items-center justify-between">
                  <div><p className="font-mono font-semibold">{e.code}</p><p className="text-sm text-gray-600">{e.manufacturer} {e.model}</p></div>
                  <div className="flex gap-1"><Badge className={e.operational_status ? STATUS_COLORS[e.operational_status] || '' : ''}>{e.operational_status ? OPERATIONAL_STATUS_LABELS[e.operational_status as keyof typeof OPERATIONAL_STATUS_LABELS] || '-' : '-'}</Badge></div>
                </div>
              </Link>
            ))}
          </CardContent></Card>
          <Card><CardHeader><h3 className="font-semibold text-gray-900">Últimas visitas ({visits.length})</h3></CardHeader><CardContent className="space-y-3">
            {visits.length === 0 ? <p className="text-gray-500">No hay visitas</p> : visits.map((v) => (
              <div key={v.id} className="p-3 bg-gray-50 rounded-lg"><p className="text-sm font-semibold">{formatDateOnly(v.visit_date)}</p><p className="text-xs text-gray-600 truncate">{v.title || v.description}</p></div>
            ))}
          </CardContent></Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
