import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { getResponsibleMonthlyReports, getResponsibleElevators, getResponsibleBuildings } from '@/services/responsiblePortalService';
import type { ResponsibleMonthlyReport, ResponsibleElevator, ResponsibleBuilding } from '@/services/responsiblePortalService';
import { FileText, AlertCircle, RefreshCw } from 'lucide-react';

export default function ResponsibleReportsPage() {
  const [reports, setReports] = useState<ResponsibleMonthlyReport[]>([]);
  const [elevators, setElevators] = useState<ResponsibleElevator[]>([]);
  const [buildings, setBuildings] = useState<ResponsibleBuilding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true); setError('');
    try {
      const [rep, els, blds] = await Promise.all([getResponsibleMonthlyReports(), getResponsibleElevators(), getResponsibleBuildings()]);
      setReports(rep); setElevators(els); setBuildings(blds);
    } catch (err: any) { setError(err?.message || 'Error'); } finally { setLoading(false); }
  };

  const elevatorInfo = (id: string) => {
    const el = elevators.find((e) => e.id === id);
    if (!el) return { code: '-', building: '-' };
    const bld = buildings.find((b) => b.id === el.building_id);
    return { code: el.code, building: bld?.name || '-' };
  };

  return (
    <DashboardLayout role="responsible" title="Informes Mensuales">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Informes Mensuales</h2>
          <Button variant="outline" onClick={loadData} disabled={loading}><RefreshCw size={14} className="mr-1" /> Actualizar</Button>
        </div>
        {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" /></div>
        ) : reports.length === 0 ? (
          <Card><CardContent><div className="text-center py-12"><FileText size={48} className="mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No hay informes disponibles</p></div></CardContent></Card>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => {
              const info = elevatorInfo(r.elevator_id);
              return (
                <Card key={r.id}>
                  <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2"><p className="font-semibold text-gray-900">{info.code}</p><Badge variant={r.status === 'approved' ? 'success' : 'info'}>{r.status}</Badge></div>
                      <p className="text-sm text-gray-600">{info.building} — {r.period}</p>
                      {r.general_status && <p className="text-xs text-gray-500">Estado: {r.general_status}</p>}
                    </div>
                    <div>
                      {r.has_pdf ? (
                        <Button size="sm" variant="outline" disabled>Descarga segura pendiente de habilitación</Button>
                      ) : (
                        <span className="text-sm text-gray-400">Sin PDF</span>
                      )}
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
