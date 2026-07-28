import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { getResponsibleElevators, getResponsibleClients, getResponsibleVisitEntries, getResponsibleBuildings, getErrorMessage } from '@/services/responsiblePortalService';
import type { ResponsibleElevator, ResponsibleVisitEntry, ResponsibleBuilding, ResponsibleClient } from '@/services/responsiblePortalService';
import { OPERATIONAL_STATUS_LABELS, STATUS_COLORS } from '@/types/elevators';
import { ArrowLeft, AlertCircle, FileDown, RefreshCw } from 'lucide-react';

function formatDateOnly(v?: string | null): string { if (!v) return '-'; const [y, m, d] = v.slice(0, 10).split('-'); return `${Number(d)}/${Number(m)}/${y}`; }

export default function ResponsibleBuildingDetailPage() {
  const { buildingId } = useParams<{ buildingId: string }>();
  const navigate = useNavigate();
  const [building, setBuilding] = useState<ResponsibleBuilding | null>(null);
  const [client, setClient] = useState<ResponsibleClient | null>(null);
  const [elevators, setElevators] = useState<ResponsibleElevator[]>([]);
  const [visits, setVisits] = useState<ResponsibleVisitEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { if (buildingId) loadData(); }, [buildingId]);

  const loadData = async () => {
    setLoading(true); setError('');
    try {
      const [blds, els, vis, cls] = await Promise.all([
        getResponsibleBuildings(), getResponsibleElevators(buildingId), getResponsibleVisitEntries(), getResponsibleClients(),
      ]);
      const b = blds.find((x) => x.id === buildingId);
      if (!b) { setError('No tiene permiso para consultar este recurso'); setLoading(false); return; }
      setBuilding(b);
      setClient(cls.find((c) => c.id === b.client_id) || null);
      setElevators(els);
      const elsIds = new Set(els.map((e) => e.id));
      setVisits(vis.filter((v) => elsIds.has(v.elevator_id)).slice(0, 10));
    } catch (err: unknown) { setError(getErrorMessage(err)); } finally { setLoading(false); }
  };

  const elevMap = useMemo(() => new Map(elevators.map((e) => [e.id, e])), [elevators]);

  if (loading) return <DashboardLayout role="responsible" title="Edificio"><div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" /></div></DashboardLayout>;
  if (error) return <DashboardLayout role="responsible" title="Edificio"><div className="max-w-2xl mx-auto"><button onClick={() => navigate('/responsable/edificios')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"><ArrowLeft size={18} /> Volver</button><Card><CardContent><div className="text-center py-8"><AlertCircle size={48} className="mx-auto text-danger mb-4" /><p className="text-gray-600">{error}</p><Button onClick={loadData} className="mt-4"><RefreshCw size={14} className="mr-1" /> Reintentar</Button></div></CardContent></Card></div></DashboardLayout>;
  if (!building) return null;

  return (
    <DashboardLayout role="responsible" title={building.name}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/responsable/edificios')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900"><ArrowLeft size={18} /> Volver</button>
          <Link to={`/responsable/libro-visitas?buildingId=${building.id}`}><Button variant="outline"><FileDown size={14} className="mr-1" /> Libro consolidado</Button></Link>
        </div>
        <h2 className="text-xl font-bold text-gray-900">{building.name}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><p className="text-gray-500">Código</p><p className="font-medium">{building.code}</p></div>
          <div><p className="text-gray-500">Dirección</p><p className="font-medium">{building.address}</p></div>
          <div><p className="text-gray-500">Localidad</p><p className="font-medium">{building.locality}</p></div>
          <div><p className="text-gray-500">Cliente</p><p className="font-medium">{client?.name || '-'}</p></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card><CardHeader><h3 className="font-semibold text-gray-900">Ascensores ({elevators.length})</h3></CardHeader><CardContent className="space-y-3">
            {elevators.length === 0 ? <p className="text-gray-500">No hay ascensores</p> : elevators.map((e) => (
              <Link key={e.id} to={`/responsable/ascensores/${e.id}`} className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                <div className="flex items-center justify-between">
                  <div><p className="font-mono font-semibold">{e.code}</p><p className="text-sm text-gray-600">{e.manufacturer} {e.model}</p></div>
                  <Badge className={e.operational_status ? STATUS_COLORS[e.operational_status] || '' : ''}>{e.operational_status ? OPERATIONAL_STATUS_LABELS[e.operational_status as keyof typeof OPERATIONAL_STATUS_LABELS] || '-' : '-'}</Badge>
                </div>
              </Link>
            ))}
          </CardContent></Card>
          <Card><CardHeader><h3 className="font-semibold text-gray-900">Últimas visitas ({visits.length})</h3></CardHeader><CardContent className="space-y-3">
            {visits.length === 0 ? <p className="text-gray-500">No hay visitas</p> : visits.map((v) => {
              const el = elevMap.get(v.elevator_id);
              return (
                <div key={v.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2"><span className="text-sm font-semibold">{formatDateOnly(v.visit_date)}</span><Badge variant="success" className="text-xs">Aprobado</Badge></div>
                  <p className="text-xs text-gray-600 mt-1">{el?.code || '-'} · {v.title || v.description}</p>
                </div>
              );
            })}
          </CardContent></Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
