import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { getResponsibleElevators, getResponsibleBuildings } from '@/services/responsiblePortalService';
import type { ResponsibleElevator, ResponsibleBuilding } from '@/services/responsiblePortalService';
import { OPERATIONAL_STATUS_LABELS, CONSERVATION_STATUS_LABELS, STATUS_COLORS } from '@/types/elevators';
import { Building2, Eye, AlertCircle, RefreshCw } from 'lucide-react';

export default function ResponsibleElevatorsPage() {
  const [elevators, setElevators] = useState<ResponsibleElevator[]>([]);
  const [buildings, setBuildings] = useState<ResponsibleBuilding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true); setError('');
    try {
      const [els, blds] = await Promise.all([getResponsibleElevators(), getResponsibleBuildings()]);
      setElevators(els);
      setBuildings(blds);
    } catch (err: any) { setError(err?.message || 'Error'); } finally { setLoading(false); }
  };

  const buildingName = (id: string | null) => id ? buildings.find((b) => b.id === id)?.name || '-' : '-';

  return (
    <DashboardLayout role="responsible" title="Mis Ascensores">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Mis Ascensores</h2>
          <Button variant="outline" onClick={loadData} disabled={loading}><RefreshCw size={14} className="mr-1" /> Actualizar</Button>
        </div>
        {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" /></div>
        ) : elevators.length === 0 ? (
          <Card><CardContent><div className="text-center py-12"><Building2 size={48} className="mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No tiene ascensores asignados</p></div></CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {elevators.map((e) => (
              <Card key={e.id}>
                <CardContent>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-mono font-bold text-lg">{e.code}</p>
                      <p className="text-sm text-gray-600">{buildingName(e.building_id)}</p>
                      <p className="text-sm text-gray-500">{e.manufacturer} {e.model}</p>
                      <div className="flex gap-2 mt-2">
                        <Badge className={e.operational_status ? STATUS_COLORS[e.operational_status] || '' : ''}>{e.operational_status ? OPERATIONAL_STATUS_LABELS[e.operational_status as keyof typeof OPERATIONAL_STATUS_LABELS] || '-' : '-'}</Badge>
                        <Badge className={e.conservation_status ? STATUS_COLORS[e.conservation_status] || '' : ''}>{e.conservation_status ? CONSERVATION_STATUS_LABELS[e.conservation_status as keyof typeof CONSERVATION_STATUS_LABELS] || '-' : '-'}</Badge>
                      </div>
                    </div>
                    <Link to={`/responsable/ascensores/${e.id}`}><Button size="sm" variant="ghost"><Eye size={14} /></Button></Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
