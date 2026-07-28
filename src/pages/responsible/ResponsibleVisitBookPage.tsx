import { useState, useEffect } from 'react';
import { pdf } from '@react-pdf/renderer';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { getResponsibleElevators, getResponsibleBuildings, getResponsibleVisitEntries } from '@/services/responsiblePortalService';
import type { ResponsibleElevator, ResponsibleBuilding } from '@/services/responsiblePortalService';
import VisitBookPDF from '@/components/pdf/VisitBookPDF';
import { BookOpen, FileDown } from 'lucide-react';

function toDateInputValue(date: Date): string { const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0'); const d = String(date.getDate()).padStart(2, '0'); return `${y}-${m}-${d}`; }
function getCurrentMonthRange() { const now = new Date(); return { from: toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)), to: toDateInputValue(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }; }
function slugify(v: string) { return v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }

export default function ResponsibleVisitBookPage() {
  const range = getCurrentMonthRange();
  const [buildings, setBuildings] = useState<ResponsibleBuilding[]>([]);
  const [elevators, setElevators] = useState<ResponsibleElevator[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState('');
  const [selectedElevator, setSelectedElevator] = useState('');
  const [dateFrom, setDateFrom] = useState(range.from);
  const [dateTo, setDateTo] = useState(range.to);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [blds, els] = await Promise.all([getResponsibleBuildings(), getResponsibleElevators()]);
      setBuildings(blds); setElevators(els);
    } catch (err: any) { setError(err?.message || 'Error'); }
  };

  const filteredElevators = selectedBuilding ? elevators.filter((e) => e.building_id === selectedBuilding) : elevators;

  const handleGenerate = async () => {
    if (!dateFrom || !dateTo) { setError('Indicá el período'); return; }
    if (dateFrom > dateTo) { setError('Fecha desde no puede ser posterior'); return; }
    setGenerating(true); setError('');
    try {
      const visitEntries = await getResponsibleVisitEntries(selectedElevator || undefined, dateFrom, dateTo);
      if (visitEntries.length === 0) { setError('No hay asientos aprobados para el período'); return; }
      const building = buildings.find((b) => b.id === selectedBuilding);
      const elevator = elevators.find((e) => e.id === selectedElevator);
      const blob = await pdf(
        <VisitBookPDF scope={selectedElevator ? 'elevator' : 'building'} elevatorCode={elevator?.code} buildingName={building?.name || '-'} clientName="-" dateFrom={dateFrom} dateTo={dateTo} entries={visitEntries as any} elevatorCount={filteredElevators.length} />
      ).toBlob();
      const code = elevator?.code || building?.name || 'ascensor';
      const sameMonth = dateFrom.slice(0, 7) === dateTo.slice(0, 7);
      const period = sameMonth ? dateFrom.slice(0, 7) : `${dateFrom}-a-${dateTo}`;
      const filename = selectedElevator ? `libro-visitas-${slugify(code)}-${period}.pdf` : `libro-visitas-edificio-${slugify(code)}-${period}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (err: any) { setError(err?.message || 'Error al generar PDF'); } finally { setGenerating(false); }
  };

  return (
    <DashboardLayout role="responsible" title="Libro de Visitas">
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><BookOpen size={24} /> Libro Digital de Visitas</h2>
        <Card><CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="text-sm text-gray-600">Edificio</label><select className="w-full border rounded px-3 py-2 text-sm" value={selectedBuilding} onChange={(e) => { setSelectedBuilding(e.target.value); setSelectedElevator(''); }}><option value="">Todos mis edificios</option>{buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
            <div><label className="text-sm text-gray-600">Ascensor</label><select className="w-full border rounded px-3 py-2 text-sm" value={selectedElevator} onChange={(e) => setSelectedElevator(e.target.value)}><option value="">Todos los asignados</option>{filteredElevators.map((el) => <option key={el.id} value={el.id}>{el.code}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="text-sm text-gray-600">Fecha desde</label><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" /></div>
            <div><label className="text-sm text-gray-600">Fecha hasta</label><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" /></div>
          </div>
          <p className="text-xs text-gray-400">Solo se incluyen asientos aprobados</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end"><Button onClick={handleGenerate} disabled={generating}><FileDown size={16} className="mr-2" />{generating ? 'Generando...' : 'Generar y descargar'}</Button></div>
        </CardContent></Card>
      </div>
    </DashboardLayout>
  );
}
