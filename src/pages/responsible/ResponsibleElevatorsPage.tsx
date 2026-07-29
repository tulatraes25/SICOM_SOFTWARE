import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { getResponsibleElevators, getResponsibleBuildings, getErrorMessage } from '@/services/responsiblePortalService';
import type { ResponsibleElevator, ResponsibleBuilding } from '@/services/responsiblePortalService';
import { OPERATIONAL_STATUS_LABELS, CONSERVATION_STATUS_LABELS, STATUS_COLORS } from '@/types/elevators';
import { Building2, Eye, AlertCircle, RefreshCw } from 'lucide-react';

const naturalSort = new Intl.Collator('es', { numeric: true, sensitivity: 'base' }).compare;

function formatManufacturerModel(m: string | null, mo: string | null): string {
  if (m && mo) return `${m} ${mo}`;
  if (m) return m;
  if (mo) return mo;
  return '-';
}

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
    } catch (err: unknown) { setError(getErrorMessage(err)); } finally { setLoading(false); }
  };

  const buildingMap = useMemo(() => new Map(buildings.map((b) => [b.id, b])), [buildings]);

  const sortedElevators = useMemo(() => {
    return [...elevators].sort((a, b) => {
      const aName = buildingMap.get(a.building_id)?.name;
      const bName = buildingMap.get(b.building_id)?.name;
      if (aName && !bName) return -1;
      if (!aName && bName) return 1;
      if (aName && bName) {
        const nc = naturalSort(aName, bName);
        if (nc !== 0) return nc;
      }
      const cc = naturalSort(a.code, b.code);
      if (cc !== 0) return cc;
      return naturalSort(a.id, b.id);
    });
  }, [elevators, buildingMap]);

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
        ) : sortedElevators.length === 0 ? (
          <Card><CardContent><div className="text-center py-12"><Building2 size={48} className="mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No tiene ascensores asignados</p></div></CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedElevators.map((e) => (
              <div key={e.id} data-testid={`responsible-elevator-${e.id}`}>
              <Card>
                <CardContent>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-mono font-bold text-lg">{e.code}</p>
                      <p className="text-sm text-gray-600">{buildingMap.get(e.building_id)?.name || '-'}</p>
                      <p className="text-sm text-gray-500">{formatManufacturerModel(e.manufacturer, e.model)}</p>
                      <div className="flex gap-2 mt-2">
                        <Badge className={e.operational_status ? STATUS_COLORS[e.operational_status] || '' : ''}>{e.operational_status ? OPERATIONAL_STATUS_LABELS[e.operational_status as keyof typeof OPERATIONAL_STATUS_LABELS] || '-' : '-'}</Badge>
                        <Badge className={e.conservation_status ? STATUS_COLORS[e.conservation_status] || '' : ''}>{e.conservation_status ? CONSERVATION_STATUS_LABELS[e.conservation_status as keyof typeof CONSERVATION_STATUS_LABELS] || '-' : '-'}</Badge>
                      </div>
                    </div>
                    <Link to={`/responsable/ascensores/${e.id}`} aria-label={`Ver ascensor ${e.code}`}><Button size="sm" variant="ghost"><Eye size={14} /></Button></Link>
                  </div>
                </CardContent>
              </Card>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
