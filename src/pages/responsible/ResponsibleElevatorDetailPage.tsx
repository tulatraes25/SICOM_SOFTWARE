import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { getResponsibleElevators, getResponsibleServiceRecords, getResponsibleServiceOrders, getResponsibleVisitEntries, getResponsibleMonthlyReports, getResponsibleTechnicians, getResponsibleChecklistItems, getErrorMessage } from '@/services/responsiblePortalService';
import type { ResponsibleElevator, ResponsibleServiceRecord, ResponsibleServiceOrder, ResponsibleVisitEntry, ResponsibleMonthlyReport, ResponsibleTechnician, ResponsibleChecklistItem } from '@/services/responsiblePortalService';
import { OPERATIONAL_STATUS_LABELS, CONSERVATION_STATUS_LABELS, STATUS_COLORS } from '@/types/elevators';
import { ArrowLeft, AlertCircle, Clock, FileText, Wrench, CheckCircle } from 'lucide-react';

function formatDateOnly(v?: string | null): string { if (!v) return '-'; const [y, m, d] = v.slice(0, 10).split('-'); return `${Number(d)}/${Number(m)}/${y}`; }
function formatTime(ts?: string | null): string { if (!ts) return '-'; return new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }); }
function formatDuration(e: { duration_seconds?: number | null; duration_minutes?: number | null; check_in_at?: string | null; check_out_at?: string | null }): string {
  if (e.duration_seconds !== null && e.duration_seconds !== undefined && e.duration_seconds > 0) {
    if (e.duration_seconds < 60) return '<1 min';
    if (e.duration_seconds < 3600) return `${Math.floor(e.duration_seconds / 60)} min`;
    const h = Math.floor(e.duration_seconds / 3600); const m = Math.floor((e.duration_seconds % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  if (e.duration_minutes) return `${e.duration_minutes} min`;
  return '-';
}
const CHECKLIST_LABELS: Record<string, string> = { ok: 'Correcto', needs_attention: 'Requiere atención', failed: 'Falló', na: 'No aplica' };

export default function ResponsibleElevatorDetailPage() {
  const { elevatorId } = useParams<{ elevatorId: string }>();
  const navigate = useNavigate();
  const [elevator, setElevator] = useState<ResponsibleElevator | null>(null);
  const [records, setRecords] = useState<ResponsibleServiceRecord[]>([]);
  const [orders, setOrders] = useState<ResponsibleServiceOrder[]>([]);
  const [visits, setVisits] = useState<ResponsibleVisitEntry[]>([]);
  const [reports, setReports] = useState<ResponsibleMonthlyReport[]>([]);
  const [technicians, setTechnicians] = useState<ResponsibleTechnician[]>([]);
  const [checklist, setChecklist] = useState<ResponsibleChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { if (elevatorId) loadData(); }, [elevatorId]);

  const loadData = async () => {
    setLoading(true); setError('');
    try {
      const [els, rec, ord, vis, rep, tech] = await Promise.all([
        getResponsibleElevators(), getResponsibleServiceRecords(elevatorId),
        getResponsibleServiceOrders(elevatorId), getResponsibleVisitEntries(elevatorId),
        getResponsibleMonthlyReports(elevatorId), getResponsibleTechnicians(),
      ]);
      const el = els.find((e) => e.id === elevatorId);
      if (!el) { setError('No tiene permiso para consultar este recurso'); setLoading(false); return; }
      setElevator(el); setRecords(rec); setOrders(ord); setVisits(vis); setReports(rep); setTechnicians(tech);
      const recordIds = rec.map((r) => r.id);
      const cl = await getResponsibleChecklistItems(recordIds);
      setChecklist(cl);
    } catch (err: unknown) { setError(getErrorMessage(err)); } finally { setLoading(false); }
  };

  const techName = (id: string) => technicians.find((t) => t.id === id)?.full_name || '-';
  const checklistByRecord = useMemo(() => {
    const map = new Map<string, ResponsibleChecklistItem[]>();
    checklist.forEach((item) => { const arr = map.get(item.service_record_id) || []; arr.push(item); map.set(item.service_record_id, arr); });
    return map;
  }, [checklist]);

  if (loading) return <DashboardLayout role="responsible" title="Ascensor"><div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" /></div></DashboardLayout>;
  if (error) return <DashboardLayout role="responsible" title="Ascensor"><div className="max-w-2xl mx-auto"><button onClick={() => navigate('/responsable/ascensores')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"><ArrowLeft size={18} /> Volver</button><Card><CardContent><div className="text-center py-8"><AlertCircle size={48} className="mx-auto text-danger mb-4" /><p className="text-gray-600">{error}</p></div></CardContent></Card></div></DashboardLayout>;
  if (!elevator) return null;

  return (
    <DashboardLayout role="responsible" title={elevator.code}>
      <div className="space-y-6">
        <button onClick={() => navigate('/responsable/ascensores')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900"><ArrowLeft size={18} /> Volver</button>
        <div className="flex items-center gap-3"><h2 className="text-xl font-bold text-gray-900">{elevator.code}</h2><Badge className={elevator.operational_status ? STATUS_COLORS[elevator.operational_status] || '' : ''}>{elevator.operational_status ? OPERATIONAL_STATUS_LABELS[elevator.operational_status as keyof typeof OPERATIONAL_STATUS_LABELS] || '-' : '-'}</Badge></div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><p className="text-gray-500">Fabricante</p><p className="font-medium">{elevator.manufacturer || '-'}</p></div>
          <div><p className="text-gray-500">Modelo</p><p className="font-medium">{elevator.model || '-'}</p></div>
          <div><p className="text-gray-500">Tipo</p><p className="font-medium">{elevator.elevator_type || '-'}</p></div>
          <div><p className="text-gray-500">Capacidad</p><p className="font-medium">{elevator.capacity_kg ? `${elevator.capacity_kg} kg` : '-'}</p></div>
          <div><p className="text-gray-500">Pisos</p><p className="font-medium">{elevator.floors_served || '-'}</p></div>
          <div><p className="text-gray-500">Año instalación</p><p className="font-medium">{elevator.year_installed || '-'}</p></div>
          <div><p className="text-gray-500">Conservación</p><p className="font-medium">{elevator.conservation_status ? CONSERVATION_STATUS_LABELS[elevator.conservation_status as keyof typeof CONSERVATION_STATUS_LABELS] || '-' : '-'}</p></div>
          <div><p className="text-gray-500">Contrato</p><p className="font-medium">{elevator.contractual_status || '-'}</p></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card><CardHeader><h3 className="font-semibold text-gray-900 flex items-center gap-2"><Wrench size={16} /> Mantenimientos ({records.length})</h3></CardHeader><CardContent className="space-y-3">
            {records.length === 0 ? <p className="text-gray-500">No hay mantenimientos</p> : records.map((r) => (
              <div key={r.id} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2"><span className="text-sm font-semibold">{formatDateOnly(r.service_date)}</span><Badge variant="info" className="text-xs">{r.service_type}</Badge></div>
                <p className="text-xs text-gray-600 mt-1">{techName(r.technician_id)}</p>
                {r.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{r.description}</p>}
                {checklistByRecord.has(r.id) && (
                  <div className="mt-2 space-y-1">
                    {checklistByRecord.get(r.id)!.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 text-xs">
                        <CheckCircle size={12} className={item.status === 'ok' ? 'text-green-500' : item.status === 'failed' ? 'text-red-500' : 'text-yellow-500'} />
                        <span className="text-gray-600">{item.item_name}</span>
                        <span className="text-gray-400">— {CHECKLIST_LABELS[item.status] || item.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent></Card>

          <Card><CardHeader><h3 className="font-semibold text-gray-900 flex items-center gap-2"><FileText size={16} /> Órdenes ({orders.length})</h3></CardHeader><CardContent className="space-y-3">
            {orders.length === 0 ? <p className="text-gray-500">No hay órdenes</p> : orders.map((o) => (
              <div key={o.id} className="p-3 bg-gray-50 rounded-lg"><p className="text-sm font-semibold">{o.subject}</p><p className="text-xs text-gray-600">{o.order_type} · {o.reviewed_at ? formatDateOnly(o.reviewed_at) : '-'}</p>{o.completion_summary && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{o.completion_summary}</p>}</div>
            ))}
          </CardContent></Card>

          <Card><CardHeader><h3 className="font-semibold text-gray-900 flex items-center gap-2"><Clock size={16} /> Visitas ({visits.length})</h3></CardHeader><CardContent className="space-y-3">
            {visits.length === 0 ? <p className="text-gray-500">No hay visitas</p> : visits.slice(0, 10).map((v) => (
              <div key={v.id} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2"><span className="text-sm font-semibold">{formatDateOnly(v.visit_date)}</span>{v.case_number && <span className="text-xs text-gray-400">N.º {v.case_number}</span>}</div>
                <p className="text-xs text-gray-600 mt-1">{v.title || v.description}</p>
                <p className="text-xs text-gray-400">{formatDuration(v)} · {formatTime(v.check_in_at)} – {formatTime(v.check_out_at)}</p>
              </div>
            ))}
          </CardContent></Card>

          <Card><CardHeader><h3 className="font-semibold text-gray-900 flex items-center gap-2"><FileText size={16} /> Informes ({reports.length})</h3></CardHeader><CardContent className="space-y-3">
            {reports.length === 0 ? <p className="text-gray-500">No hay informes</p> : reports.map((r) => (
              <div key={r.id} className="p-3 bg-gray-50 rounded-lg"><p className="text-sm font-semibold">{r.period}</p><p className="text-xs text-gray-600">{r.status} · {r.has_pdf ? 'PDF disponible' : 'Sin PDF'}</p></div>
            ))}
          </CardContent></Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
