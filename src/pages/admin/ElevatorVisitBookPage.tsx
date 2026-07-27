import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { pdf } from '@react-pdf/renderer';
import { supabase } from '@/config/supabase';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { listEntriesByElevator } from '@/services/elevatorVisitBook.service';
import { VISIT_ENTRY_TYPE_LABELS, VISIT_ENTRY_STATUS_LABELS } from '@/types/database';
import type { ElevatorVisitEntry } from '@/types/database';
import VisitBookPDF from '@/components/pdf/VisitBookPDF';
import { Plus, Search, Eye, BookOpen, ArrowLeft, FileDown } from 'lucide-react';

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

const STATUS_BADGE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  draft: 'default',
  in_progress: 'info',
  submitted: 'info',
  changes_requested: 'warning',
  approved: 'success',
  rectified: 'warning',
  cancelled: 'danger',
};

const TYPE_OPTIONS = [
  { value: '', label: 'Todos los tipos' },
  ...Object.entries(VISIT_ENTRY_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l })),
];

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  ...Object.entries(VISIT_ENTRY_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l })),
];

export default function ElevatorVisitBookPage() {
  const { elevatorId } = useParams<{ elevatorId: string }>();
  const [elevator, setElevator] = useState<{ code: string; building?: any } | null>(null);
  const [entries, setEntries] = useState<ElevatorVisitEntry[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfDateFrom, setPdfDateFrom] = useState('');
  const [pdfDateTo, setPdfDateTo] = useState('');
  const [pdfStatus, setPdfStatus] = useState('approved');
  const [pdfGenerating, setPdfGenerating] = useState(false);

  useEffect(() => {
    if (elevatorId) loadElevator();
  }, [elevatorId]);

  useEffect(() => {
    if (elevatorId) loadEntries();
  }, [elevatorId, search, filterType, filterStatus]);

  const loadElevator = async () => {
    if (!elevatorId) return;
    const { data } = await supabase
      .from('elevators')
      .select('id, code, building:buildings(name, address, client:clients(name))')
      .eq('id', elevatorId)
      .single();
    setElevator(data);
  };

  const loadEntries = async () => {
    if (!elevatorId) return;
    setLoading(true);
    try {
      const result = await listEntriesByElevator(elevatorId, {
        search: search || undefined,
        entry_type: filterType || undefined,
        status: filterStatus || undefined,
      });
      setEntries(result.data);
      setCount(result.count);
    } catch (err) {
      console.error('Error loading visit entries:', err);
    } finally {
      setLoading(false);
    }
  };

  const [pdfError, setPdfError] = useState('');

  const handleGeneratePDF = async () => {
    if (!elevator || !elevatorId) return;
    setPdfError('');

    if (!pdfDateFrom || !pdfDateTo) {
      setPdfError('Indicá el período del informe');
      return;
    }
    if (pdfDateFrom > pdfDateTo) {
      setPdfError('La fecha desde no puede ser posterior a la fecha hasta');
      return;
    }

    setPdfGenerating(true);
    try {
      let query = supabase.from('elevator_visit_entries')
        .select(`
          *,
          elevator:elevators(id, code, building:buildings(name, client:clients(name))),
          technician:profiles!elevator_visit_entries_technician_id_fkey(full_name),
          service_case:service_cases(id, case_number, numbering_mode)
        `)
        .eq('elevator_id', elevatorId)
        .order('visit_date', { ascending: true })
        .order('entry_number', { ascending: true });

      if (pdfStatus) query = query.eq('status', pdfStatus);
      query = query.gte('visit_date', pdfDateFrom).lte('visit_date', pdfDateTo);

      const { data: pdfEntries, error: pdfEntriesError } = await query;
      if (pdfEntriesError) throw pdfEntriesError;
      if (!pdfEntries || pdfEntries.length === 0) {
        setPdfError('No hay asientos para el período seleccionado');
        return;
      }

      const building = (elevator as any).building;
      const client = building?.client;

      const blob = await pdf(
        <VisitBookPDF
          elevatorCode={elevator.code}
          buildingName={building?.name || '-'}
          clientName={client?.name || '-'}
          dateFrom={pdfDateFrom}
          dateTo={pdfDateTo}
          entries={pdfEntries}
        />
      ).toBlob();

      const normalizedCode = elevator.code.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      const sameMonth = pdfDateFrom.slice(0, 7) === pdfDateTo.slice(0, 7);
      const filename = sameMonth
        ? `libro-visitas-${normalizedCode}-${pdfDateFrom.slice(0, 7)}.pdf`
        : `libro-visitas-${normalizedCode}-${pdfDateFrom}-a-${pdfDateTo}.pdf`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShowPdfModal(false);
    } catch (err) {
      console.error('Error generating PDF:', err);
      setPdfError('Error al generar el PDF');
    } finally {
      setPdfGenerating(false);
    }
  };

  return (
    <DashboardLayout role="admin" title="Libro de Visitas">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Link to={`/admin/ascensores`} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2">
              <ArrowLeft size={18} /> Volver a ascensores
            </Link>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BookOpen size={24} />
              Libro de Visitas — {elevator?.code || '...'}
            </h2>
            <p className="text-gray-500">
              {(elevator?.building as any)?.name || '...'} — {count} asiento(s)
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { const range = getCurrentMonthRange(); setPdfDateFrom(range.from); setPdfDateTo(range.to); setPdfStatus('approved'); setPdfError(''); setShowPdfModal(true); }}>
              <FileDown size={16} className="mr-2" /> Generar PDF
            </Button>
            <Link to={`/admin/ascensores/${elevatorId}/libro/nuevo`}>
              <Button>
                <Plus size={16} className="mr-2" />
                Nuevo Asiento
              </Button>
            </Link>
          </div>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select options={TYPE_OPTIONS} value={filterType} onChange={(e) => setFilterType(e.target.value)} />
              <Select options={STATUS_OPTIONS} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">No hay asientos en el libro de visitas</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Asiento</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Fecha Visita</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Tipo</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Expediente</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Técnico</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Estado</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono font-semibold text-gray-900">
                          N.º {entry.entry_number}
                          {entry.is_rectification && (
                            <Badge variant="warning" className="ml-2 text-xs">Rectificación</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {entry.visit_date?.slice(0, 10).split('-').reverse().join('/') || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {VISIT_ENTRY_TYPE_LABELS[entry.entry_type]}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {entry.service_case
                            ? `N.º ${(entry.service_case as any).case_number}`
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {(entry.technician as any)?.full_name || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={STATUS_BADGE[entry.status]}>
                            {VISIT_ENTRY_STATUS_LABELS[entry.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Link to={`/admin/ascensores/${elevatorId}/libro/${entry.id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye size={14} />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {showPdfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Generar Libro de Visitas PDF</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-600">Fecha desde</label>
                  <input type="date" value={pdfDateFrom} onChange={(e) => setPdfDateFrom(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Fecha hasta</label>
                  <input type="date" value={pdfDateTo} onChange={(e) => setPdfDateTo(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-600">Estado</label>
                <select className="w-full border rounded px-3 py-2 text-sm" value={pdfStatus} onChange={(e) => setPdfStatus(e.target.value)}>
                  <option value="">Todos</option>
                  {Object.entries(VISIT_ENTRY_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            {pdfError && <p className="text-sm text-danger mt-2">{pdfError}</p>}
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowPdfModal(false)}>Cancelar</Button>
              <Button onClick={handleGeneratePDF} disabled={pdfGenerating}>
                {pdfGenerating ? 'Generando...' : 'Generar y descargar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
