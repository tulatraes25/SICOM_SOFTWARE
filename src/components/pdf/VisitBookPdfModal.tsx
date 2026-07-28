import { useState, useEffect } from 'react';
import { pdf } from '@react-pdf/renderer';
import { supabase } from '@/config/supabase';
import Button from '@/components/ui/Button';
import VisitBookPDF from '@/components/pdf/VisitBookPDF';
import { VISIT_ENTRY_STATUS_LABELS } from '@/types/database';

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCurrentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: toDateInputValue(firstDay), to: toDateInputValue(lastDay) };
}

function slugify(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

interface VisitBookPdfModalProps {
  initialClientId?: string;
  initialBuildingId?: string;
  initialElevatorId?: string;
  allowBuildingScope?: boolean;
  initialScope?: 'elevator' | 'building';
  onClose: () => void;
}

export default function VisitBookPdfModal({
  initialClientId, initialBuildingId, initialElevatorId,
  allowBuildingScope = false, initialScope, onClose,
}: VisitBookPdfModalProps) {
  const range = getCurrentMonthRange();

  const [clients, setClients] = useState<any[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [elevators, setElevators] = useState<any[]>([]);

  const [clientId, setClientId] = useState(initialClientId || '');
  const [buildingId, setBuildingId] = useState(initialBuildingId || '');
  const [elevatorId, setElevatorId] = useState(initialElevatorId || '');
  const [scope, setScope] = useState<'elevator' | 'building'>(initialScope || (initialElevatorId ? 'elevator' : 'elevator'));

  const [dateFrom, setDateFrom] = useState(range.from);
  const [dateTo, setDateTo] = useState(range.to);
  const [status, setStatus] = useState('approved');
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    supabase.from('clients').select('id, name').eq('active', true).order('name').then(({ data }) => setClients(data || []));
  }, []);

  useEffect(() => {
    if (!clientId) { setBuildings([]); return; }
    supabase.from('buildings').select('id, name, client_id').eq('client_id', clientId).eq('active', true).order('name').then(({ data }) => setBuildings(data || []));
  }, [clientId]);

  useEffect(() => {
    if (!buildingId) { setElevators([]); return; }
    supabase.from('elevators').select('id, code, building_id').eq('building_id', buildingId).eq('active', true).order('code').then(({ data }) => setElevators(data || []));
  }, [buildingId]);

  useEffect(() => {
    if (elevators.length === 1 && !elevatorId) setElevatorId(elevators[0].id);
  }, [elevators, elevatorId]);

  // Auto-resolve clientId from buildingId
  useEffect(() => {
    if (buildingId && !clientId) {
      const b = buildings.find((b: any) => b.id === buildingId);
      if (b?.client_id) setClientId(b.client_id);
    }
  }, [buildingId, clientId, buildings]);

  const handleGenerate = async () => {
    setError('');
    if (!dateFrom || !dateTo) { setError('Indicá el período del informe'); return; }
    if (dateFrom > dateTo) { setError('La fecha desde no puede ser posterior a la fecha hasta'); return; }
    if (scope === 'elevator' && !elevatorId) { setError('Seleccioná un ascensor'); return; }
    if (!buildingId) { setError('Seleccioná un edificio'); return; }

    setGenerating(true);
    try {
      let query = supabase.from('elevator_visit_entries')
        .select(`
          *,
          elevator:elevators(id, code, building:buildings(name, client:clients(name))),
          technician:profiles!elevator_visit_entries_technician_id_fkey(full_name),
          service_case:service_cases(id, case_number, numbering_mode)
        `)
        .order('visit_date', { ascending: true })
        .order('entry_number', { ascending: true });

      if (status) query = query.eq('status', status);
      query = query.gte('visit_date', dateFrom).lte('visit_date', dateTo);

      if (scope === 'elevator') {
        query = query.eq('elevator_id', elevatorId);
      } else {
        const elevatorIds = elevators.map((e: any) => e.id);
        if (elevatorIds.length === 0) { setError('No hay ascensores en este edificio'); return; }
        query = query.in('elevator_id', elevatorIds);
      }

      const { data: entries, error: entriesError } = await query;
      if (entriesError) throw entriesError;
      if (!entries || entries.length === 0) { setError('No hay asientos para el período seleccionado'); return; }

      // Enrich
      const enriched = await Promise.all(entries.map(async (entry: any) => {
        if (entry.service_record_id) {
          const { data: sr, error: srErr } = await supabase.from('service_records')
            .select('service_type, service_date, description, technical_report, observations, final_report_text')
            .eq('id', entry.service_record_id).maybeSingle();
          if (srErr) console.error('Error loading service record:', srErr);
          entry._serviceRecord = sr;
        }
        if (entry.service_order_id) {
          const { data: so, error: soErr } = await supabase.from('service_orders')
            .select('completion_summary')
            .eq('id', entry.service_order_id).maybeSingle();
          if (soErr) console.error('Error loading service order:', soErr);
          entry._serviceOrder = so;
          const { data: prog, error: progErr } = await supabase.from('service_order_progress')
            .select('note, progress_type')
            .eq('service_order_id', entry.service_order_id)
            .order('created_at', { ascending: true });
          if (progErr) console.error('Error loading progress:', progErr);
          entry._progress = prog;
        }
        return entry;
      }));

      // Sort for building scope: date → elevator code → entry number
      if (scope === 'building') {
        enriched.sort((a: any, b: any) => {
          const dateCmp = String(a.visit_date).localeCompare(String(b.visit_date));
          if (dateCmp !== 0) return dateCmp;
          const elevCmp = String(a.elevator?.code || '').localeCompare(String(b.elevator?.code || ''), 'es', { numeric: true });
          if (elevCmp !== 0) return elevCmp;
          return Number(a.entry_number) - Number(b.entry_number);
        });
      }

      const firstElevator = (enriched[0] as any)?.elevator;
      const buildingName = firstElevator?.building?.name || '-';
      const clientName = firstElevator?.building?.client?.name || '-';
      const elevatorCode = firstElevator?.code || 'ascensor';

      const blob = await pdf(
        <VisitBookPDF
          scope={scope}
          elevatorCode={scope === 'elevator' ? elevatorCode : undefined}
          buildingName={buildingName}
          clientName={clientName}
          dateFrom={dateFrom}
          dateTo={dateTo}
          entries={enriched}
          elevatorCount={scope === 'building' ? elevators.length : undefined}
        />
      ).toBlob();

      const sameMonth = dateFrom.slice(0, 7) === dateTo.slice(0, 7);
      const period = sameMonth ? dateFrom.slice(0, 7) : `${dateFrom}-a-${dateTo}`;
      const filename = scope === 'building'
        ? `libro-visitas-edificio-${slugify(buildingName)}-${period}.pdf`
        : `libro-visitas-${slugify(elevatorCode)}-${period}.pdf`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onClose();
    } catch (err) {
      console.error('Error generating PDF:', err);
      setError('Error al generar el PDF');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">Generar Libro de Visitas PDF</h3>

        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-600">Cliente</label>
            <select className="w-full border rounded px-3 py-2 text-sm" value={clientId} onChange={(e) => { setClientId(e.target.value); setBuildingId(''); setElevatorId(''); }}>
              <option value="">Todos</option>
              {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-600">Edificio</label>
            <select className="w-full border rounded px-3 py-2 text-sm" value={buildingId} onChange={(e) => { setBuildingId(e.target.value); setElevatorId(''); }} disabled={!clientId}>
              <option value="">Seleccionar edificio</option>
              {buildings.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          {allowBuildingScope && (
            <div>
              <label className="text-sm text-gray-600">Alcance</label>
              <select className="w-full border rounded px-3 py-2 text-sm" value={scope} onChange={(e) => setScope(e.target.value as any)}>
                <option value="elevator">Un ascensor</option>
                <option value="building">Todos los ascensores del edificio</option>
              </select>
            </div>
          )}

          {scope === 'elevator' ? (
            <div>
              <label className="text-sm text-gray-600">Ascensor</label>
              <select className="w-full border rounded px-3 py-2 text-sm" value={elevatorId} onChange={(e) => setElevatorId(e.target.value)} disabled={!buildingId}>
                <option value="">Seleccionar ascensor</option>
                {elevators.map((el: any) => <option key={el.id} value={el.id}>{el.code}</option>)}
              </select>
            </div>
          ) : buildingId && elevators.length > 0 ? (
            <p className="text-sm text-gray-500">Se incluirán {elevators.length === 1 ? '1 ascensor activo' : `${elevators.length} ascensores activos`}</p>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-600">Fecha desde</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-sm text-gray-600">Fecha hasta</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-600">Estado</label>
            <select className="w-full border rounded px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(VISIT_ENTRY_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        {error && <p className="text-sm text-danger mt-3">{error}</p>}

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? 'Generando...' : 'Generar y descargar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
