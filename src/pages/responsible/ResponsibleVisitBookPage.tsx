import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { pdf } from '@react-pdf/renderer';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { getResponsibleElevators, getResponsibleBuildings, getResponsibleClients, getResponsibleVisitEntries, getResponsibleTechnicians, getResponsibleServiceRecords, getResponsibleServiceOrders, getErrorMessage } from '@/services/responsiblePortalService';
import type { ResponsibleElevator, ResponsibleBuilding, ResponsibleClient, ResponsibleVisitEntry, ResponsibleTechnician, ResponsibleServiceRecord, ResponsibleServiceOrder } from '@/services/responsiblePortalService';
import VisitBookPDF, { type VisitBookEntryData } from '@/components/pdf/VisitBookPDF';
import { BookOpen, FileDown } from 'lucide-react';

function toDateInputValue(date: Date): string { const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0'); const d = String(date.getDate()).padStart(2, '0'); return `${y}-${m}-${d}`; }
function getCurrentMonthRange() { const now = new Date(); return { from: toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)), to: toDateInputValue(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }; }
function slugify(v: string) { return v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
const naturalSort = new Intl.Collator('es', { numeric: true, sensitivity: 'base' }).compare;

function buildPdfEntries(
  visitEntries: ResponsibleVisitEntry[],
  elevMap: Map<string, ResponsibleElevator>,
  techMap: Map<string, ResponsibleTechnician>,
  srMap: Map<string, ResponsibleServiceRecord>,
  soMap: Map<string, ResponsibleServiceOrder>,
): VisitBookEntryData[] {
  return visitEntries.map((v) => {
    const elevator = elevMap.get(v.elevator_id);
    if (!elevator) throw new Error(`No se pudo identificar el ascensor del asiento N.º ${v.entry_number}`);
    return {
      id: v.id,
      entry_number: v.entry_number,
      visit_date: v.visit_date,
      origin_type: v.origin_type ?? undefined,
      title: v.title ?? undefined,
      description: v.description,
      work_performed: v.work_performed ?? undefined,
      observations: v.observations ?? undefined,
      status: v.status,
      check_in_at: v.check_in_at ?? undefined,
      check_out_at: v.check_out_at ?? undefined,
      duration_minutes: v.duration_minutes ?? undefined,
      duration_seconds: v.duration_seconds ?? undefined,
      service_order_id: v.service_order_id ?? undefined,
      service_record_id: v.service_record_id ?? undefined,
      elevator: { id: elevator.id, code: elevator.code },
      technician: v.technician_id ? { id: v.technician_id, full_name: techMap.get(v.technician_id)?.full_name } : undefined,
      service_case: v.service_case_id ? { id: v.service_case_id, case_number: v.case_number ?? null, numbering_mode: v.numbering_mode ?? null } : undefined,
      _serviceRecord: v.service_record_id ? srMap.get(v.service_record_id) || null : null,
      _serviceOrder: v.service_order_id ? soMap.get(v.service_order_id) || null : null,
    };
  });
}

function sortVisitEntries(entries: ResponsibleVisitEntry[], elevMap: Map<string, ResponsibleElevator>, scope: 'elevator' | 'building') {
  return [...entries].sort((a, b) => {
    const dateCmp = a.visit_date.localeCompare(b.visit_date);
    if (dateCmp !== 0) return dateCmp;
    if (scope === 'building') {
      const aCode = elevMap.get(a.elevator_id)?.code || '';
      const bCode = elevMap.get(b.elevator_id)?.code || '';
      const codeCmp = naturalSort(aCode, bCode);
      if (codeCmp !== 0) return codeCmp;
    }
    return a.entry_number - b.entry_number;
  });
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
      if (searchParams.get('buildingId') && !blds.find((b) => b.id === searchParams.get('buildingId'))) {
        setError('No tiene permiso para consultar este edificio');
        setSelectedBuilding('');
      }
    } catch (err: unknown) { setError(getErrorMessage(err)); }
  };

  const filteredElevators = useMemo(() => selectedBuilding ? elevators.filter((e) => e.building_id === selectedBuilding) : [], [selectedBuilding, elevators]);
  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const building = useMemo(() => buildings.find((b) => b.id === selectedBuilding), [buildings, selectedBuilding]);
  const client = building ? clientMap.get(building.client_id) : null;

  const handleBuildingChange = (id: string) => { setSelectedBuilding(id); setSelectedElevator(''); setError(''); };

  const handleGenerate = async () => {
    if (!selectedBuilding) { setError('Seleccioná un edificio'); return; }
    if (!building) { setError('Edificio no encontrado'); return; }
    if (!client) { setError('No se pudo identificar el cliente del edificio'); return; }
    if (filteredElevators.length === 0) { setError('No hay ascensores asignados en este edificio'); return; }
    if (selectedElevator && !filteredElevators.find((e) => e.id === selectedElevator)) { setError('El ascensor seleccionado no pertenece a este edificio'); return; }
    if (!dateFrom || !dateTo) { setError('Indicá el período'); return; }
    if (dateFrom > dateTo) { setError('Fecha desde no puede ser posterior'); return; }
    setGenerating(true); setError('');
    try {
      const allowedIds = new Set(filteredElevators.map((e) => e.id));
      const [visitEntries, srData, soData] = await Promise.all([
        getResponsibleVisitEntries(selectedElevator || undefined, dateFrom, dateTo),
        getResponsibleServiceRecords(selectedElevator || undefined),
        getResponsibleServiceOrders(selectedElevator || undefined),
      ]);
      const filtered = visitEntries.filter((v) => allowedIds.has(v.elevator_id));
      if (filtered.length === 0) { setError('No hay asientos aprobados para el período'); return; }

      const elevMap = new Map(elevators.map((e) => [e.id, e]));
      const techMap = new Map(technicians.map((t) => [t.id, t]));
      const srMap = new Map(srData.map((r) => [r.id, r]));
      const soMap = new Map(soData.map((o) => [o.id, o]));

      const scope = selectedElevator ? 'elevator' as const : 'building' as const;
      const sorted = sortVisitEntries(filtered, elevMap, scope);
      const entries = buildPdfEntries(sorted, elevMap, techMap, srMap, soMap);

      const sameMonth = dateFrom.slice(0, 7) === dateTo.slice(0, 7);
      const period = sameMonth ? dateFrom.slice(0, 7) : `${dateFrom}-a-${dateTo}`;
      if (selectedElevator) {
        const el = elevMap.get(selectedElevator);
        const blob = await pdf(<VisitBookPDF scope="elevator" elevatorCode={el?.code} buildingName={building.name} clientName={client.name} dateFrom={dateFrom} dateTo={dateTo} entries={entries} />).toBlob();
        downloadBlob(blob, `libro-visitas-${slugify(el?.code || 'ascensor')}-${period}.pdf`);
      } else {
        const blob = await pdf(<VisitBookPDF scope="building" buildingName={building.name} clientName={client.name} dateFrom={dateFrom} dateTo={dateTo} entries={entries} elevatorCount={filteredElevators.length} />).toBlob();
        downloadBlob(blob, `libro-visitas-edificio-${slugify(building.name)}-${period}.pdf`);
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
