import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { getResponsibleBuildings, getResponsibleElevators } from '@/services/responsiblePortalService';
import type { ResponsibleBuilding, ResponsibleElevator } from '@/services/responsiblePortalService';
import { Building2, MapPin, Eye, AlertCircle, RefreshCw } from 'lucide-react';

export default function ResponsibleBuildingsPage() {
  const [buildings, setBuildings] = useState<ResponsibleBuilding[]>([]);
  const [elevators, setElevators] = useState<ResponsibleElevator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true); setError('');
    try {
      const [blds, els] = await Promise.all([getResponsibleBuildings(), getResponsibleElevators()]);
      setBuildings(blds);
      setElevators(els);
    } catch (err: any) { setError(err?.message || 'Error'); } finally { setLoading(false); }
  };

  const elevatorsByBuilding = (buildingId: string) => elevators.filter((e) => e.building_id === buildingId);

  return (
    <DashboardLayout role="responsible" title="Mis Edificios">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Mis Edificios</h2>
          <Button variant="outline" onClick={loadData} disabled={loading}><RefreshCw size={14} className="mr-1" /> Actualizar</Button>
        </div>
        {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" /></div>
        ) : buildings.length === 0 ? (
          <Card><CardContent><div className="text-center py-12"><Building2 size={48} className="mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No tiene edificios asignados</p></div></CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {buildings.map((b) => {
              const els = elevatorsByBuilding(b.id);
              return (
                <Card key={b.id}>
                  <CardContent>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">{b.name}</h3>
                        <p className="text-sm text-gray-500">{b.code}</p>
                        <div className="flex items-center gap-1 text-sm text-gray-600 mt-1"><MapPin size={14} /> {b.address}, {b.locality}</div>
                        <p className="text-sm text-gray-500 mt-2">{els.length} ascensor(es) asignado(s)</p>
                      </div>
                      <Link to={`/responsable/edificios/${b.id}`}><Button size="sm" variant="ghost"><Eye size={14} /></Button></Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
