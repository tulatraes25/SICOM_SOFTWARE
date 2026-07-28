import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { pdf } from '@react-pdf/renderer';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { getResponsibleElevators, getResponsibleBuildings, getResponsibleClients, getResponsibleVisitEntries, getResponsibleTechnicians, getErrorMessage } from '@/services/responsiblePortalService';
import type { ResponsibleElevator, ResponsibleBuilding, ResponsibleClient, ResponsibleVisitEntry, ResponsibleTechnician } from '@/services/responsiblePortalService';
import VisitBookPDF from '@/components/pdf/VisitBookPDF';
import { BookOpen, FileDown } from 'lucide-react';

function toDateInputValue(date: Date): string { const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0'); const d = String(date.getDate()).padStart(2, '0'); return `${y}-${m}-${d}`; }
function getCurrentMonthRange() { const now = new Date(); return { from: toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)), to: toDateInputValue(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }; }
function slugify(v: string) { return v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }

function buildPdfEntries(
  visitEntries: ResponsibleVisitEntry[],
  elevators: ResponsibleElevator[],
  technicians: ResponsibleTechnician[],
): ElevatorVisitEntry[] {
  const elevMap = new Map(elevators.map((e) => [e.id, e]));
  const techMap = new Map(technicians.map((t) => [t.id, t]));
  return visitEntries.map((v) => ({
    ...v,
    elevator: elevMap.get(v.elevator_id) ? { id: v.elevator_id, code: elevMap.get(v.elevator_id)!.code } : undefined,
    technician: v.technician_id ? { id: v.technician_id, full_name: techMap.get(v.technician_id)?.full_name || '-' } : undefined,
    service_case: v.service_case_id ? { id: v.service_case_id, case_number: v.case_number, numbering_mode: v.numbering_mode } : undefined,
  }));
}

interface ElevatorVisitEntry {
  id: string; elevator_id: string; service_case_id: string | null; service_record_id: string | null;
  service_order_id: string | null; entry_number: number; visit_date: string; entry_type: string;
  origin_type: string | null; title: string | null; description: string; work_performed: string | null;
  observations: string | null; recommendations: string | null; operational_status: string | null;
  conservation_status: string | null; technician_id: string | null; status: string;
  check_in_at: string | null; check_out_at: string | null; duration_minutes: number | null;
  duration_seconds: number | null; case_number: number | null; numbering_mode: string | null;
  elevator?: { id: string; code: string }; technician?: { id: string; full_name: string };
  service_case?: { id: string; case_number: number | null; numbering_mode: string | null };
  _serviceRecord?: unknown;
}

export default function ResponsibleVisitBookPage() {
  const [searchParams] = useSearchParams();
  const range = getCurrentMonthRange();
  const [buildings, setBuildings] = useState<ResponsibleBuilding[]>([]);
  const [elevators, setElevators] = useState<ResponsibleElevator[]>([]);
  const [clients, setClients] = useState<ResponsibleClient[]>([]);
  const [technicians, setTechnicians] = useState<ResponsibleTechnician[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState(searchParams.get('buildingId') || '');
  const [selectedElevator, setSelectedElevator] = useState('');
  const [dateFrom, setDateFrom] = useState(range.from);
  const [dateTo, setDateTo] = useState(range.to);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [blds, els, cls, tech] = await Promise.all([
        getResponsibleBuildings(), getResponsibleElevators(), getResponsibleClients(), getResponsibleTechnicians(),
      ]);
      setBuildings(blds); setElevators(els); setClients(cls); setTechnicians(tech);
    } catch (err: unknown) { setError(getErrorMessage(err)); }
  };

  const filteredElevators = useMemo(() => selectedBuilding ? elevators.filter((e) => e.building_id === selectedBuilding) : [], [selectedBuilding, elevators]);
  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const building = useMemo(() => buildings.find((b) => b.id === selectedBuilding), [buildings, selectedBuilding]);
  const clientName = building ? clientMap.get(building.client_id)?.name || '-' : '-';

  const handleBuildingChange = (id: string) => { setSelectedBuilding(id); setSelectedElevator(''); };

  const handleGenerate = async () => {
    if (!selectedBuilding) { setError('Seleccioná un edificio'); return; }
    if (!dateFrom || !dateTo) { setError('Indicá el período'); return; }
    if (dateFrom > dateTo) { setError('Fecha desde no puede ser posterior'); return; }
    setGenerating(true); setError('');
    try {
      const allowedIds = new Set(filteredElevators.map((e) => e.id));
      const visitEntries = await getResponsibleVisitEntries(selectedElevator || undefined, dateFrom, dateTo);
      const filtered = visitEntries.filter((v) => allowedIds.has(v.elevator_id));
      if (filtered.length === 0) { setError('No hay asientos aprobados para el período'); return; }
      const entries = buildPdfEntries(filtered, elevators, technicians) as unknown as import('@/types/database').ElevatorVisitEntry[];
      const sameMonth = dateFrom.slice(0, 7) === dateTo.slice(0, 7);
      const period = sameMonth ? dateFrom.slice(0, 7) : `${dateFrom}-a-${dateTo}`;
      if (selectedElevator) {
        const el = elevators.find((e) => e.id === selectedElevator);
        const blob = await pdf(<VisitBookPDF scope="elevator" elevatorCode={el?.code} buildingName={building?.name || '-'} clientName={clientName} dateFrom={dateFrom} dateTo={dateTo} entries={entries} />).toBlob();
        downloadBlob(blob, `libro-visitas-${slugify(el?.code || 'ascensor')}-${period}.pdf`);
      } else {
        const blob = await pdf(<VisitBookPDF scope="building" buildingName={building?.name || '-'} clientName={clientName} dateFrom={dateFrom} dateTo={dateTo} entries={entries} elevatorCount={filteredElevators.length} />).toBlob();
        downloadBlob(blob, `libro-visitas-edificio-${slugify(building?.name || 'edificio')}-${period}.pdf`);
      }
    } catch (err: unknown) { setError(getErrorMessage(err)); } finally { setGenerating(false); }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout role="responsible" title="Libro de Visitas">
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><BookOpen size={24} /> Libro Digital de Visitas</h2>
        <Card><CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="text-sm text-gray-600">Edificio *</label><select className="w-full border rounded px-3 py-2 text-sm" value={selectedBuilding} onChange={(e) => handleBuildingChange(e.target.value)}><option value="">Seleccionar edificio</option>{buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
            <div><label className="text-sm text-gray-600">Ascensor</label><select className="w-full border rounded px-3 py-2 text-sm" value={selectedElevator} onChange={(e) => setSelectedElevator(e.target.value)} disabled={!selectedBuilding}><option value="">Todos mis ascensores del edificio</option>{filteredElevators.map((el) => <option key={el.id} value={el.id}>{el.code}</option>)}</select></div>
          </div>
          {selectedBuilding && filteredElevators.length > 0 && <p className="text-xs text-gray-400">{selectedElevator ? '1 ascensor seleccionado' : `${filteredElevators.length} ascensores asignados en este edificio`}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="text-sm text-gray-600">Fecha desde</label><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" /></div>
            <div><label className="text-sm text-gray-600">Fecha hasta</label><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" /></div>
          </div>
          <p className="text-xs text-gray-400">Solo se incluyen asientos aprobados</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end"><Button onClick={handleGenerate} disabled={generating || !selectedBuilding}><FileDown size={16} className="mr-2" />{generating ? 'Generando...' : 'Generar y descargar'}</Button></div>
        </CardContent></Card>
      </div>
    </DashboardLayout>
  );
}
