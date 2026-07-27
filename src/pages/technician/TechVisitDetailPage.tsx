import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { getVisitEntry } from '@/services/elevatorVisitBook.service';
import { VISIT_ENTRY_TYPE_LABELS, VISIT_ENTRY_STATUS_LABELS, VISIT_ORIGIN_LABELS } from '@/types/database';
import type { ElevatorVisitEntry } from '@/types/database';
import { ArrowLeft, AlertCircle, User, Calendar, Wrench, Clock, ExternalLink } from 'lucide-react';

const STATUS_BADGE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  draft: 'default', in_progress: 'info', submitted: 'info',
  changes_requested: 'warning', approved: 'success', rectified: 'warning', cancelled: 'danger',
};

function formatDateOnly(value?: string | null): string {
  if (!value) return '-';
  const [year, month, day] = value.slice(0, 10).split('-');
  if (!year || !month || !day) return value;
  return `${Number(day)}/${Number(month)}/${year}`;
}

function formatVisitDuration(entry: any): string {
  if (entry.duration_seconds !== null && entry.duration_seconds !== undefined && entry.duration_seconds > 0) {
    if (entry.duration_seconds < 60) return '<1 min';
    if (entry.duration_seconds < 120) return '1 min';
    if (entry.duration_seconds < 3600) return `${Math.floor(entry.duration_seconds / 60)} min`;
    const h = Math.floor(entry.duration_seconds / 3600);
    const m = Math.floor((entry.duration_seconds % 3600) / 60);
    return m > 0 ? `${h} h ${m} min` : `${h} h`;
  }
  if (entry.duration_minutes !== null && entry.duration_minutes !== undefined && entry.duration_minutes > 0) {
    if (entry.duration_minutes < 60) return `${entry.duration_minutes} min`;
    const h = Math.floor(entry.duration_minutes / 60);
    const m = entry.duration_minutes % 60;
    return m > 0 ? `${h} h ${m} min` : `${h} h`;
  }
  if (entry.check_in_at && entry.check_out_at) {
    const diff = Math.floor((new Date(entry.check_out_at).getTime() - new Date(entry.check_in_at).getTime()) / 1000);
    if (diff < 60) return '<1 min';
    if (diff < 120) return '1 min';
    if (diff < 3600) return `${Math.floor(diff / 60)} min`;
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    return m > 0 ? `${h} h ${m} min` : `${h} h`;
  }
  return '-';
}

export default function TechVisitDetailPage() {
  const { entryId } = useParams<{ entryId: string }>();
  const navigate = useNavigate();
  const [entry, setEntry] = useState<ElevatorVisitEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { if (entryId) loadEntry(); }, [entryId]);

  const loadEntry = async () => {
    if (!entryId) return;
    try {
      const data = await getVisitEntry(entryId);
      setEntry(data);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar asiento');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (ts: string | null | undefined) => {
    if (!ts) return 'No informado';
    return new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  if (loading) {
    return (
      <DashboardLayout role="technician" title="Detalle de Visita">
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (error && !entry) {
    return (
      <DashboardLayout role="technician" title="Detalle de Visita">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => navigate('/tecnico/visitas')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
            <ArrowLeft size={18} /> Volver a Mis Visitas
          </button>
          <Card>
            <CardContent>
              <div className="text-center py-8">
                <AlertCircle size={48} className="mx-auto text-danger mb-4" />
                <p className="text-gray-600">{error}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (!entry) return null;

  return (
    <DashboardLayout role="technician" title={`Asiento N.º ${entry.entry_number}`}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <button onClick={() => navigate('/tecnico/visitas')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2">
              <ArrowLeft size={18} /> Volver a Mis Visitas
            </button>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900">Asiento N.º {entry.entry_number}</h2>
              <Badge variant={STATUS_BADGE[entry.status]}>
                {VISIT_ENTRY_STATUS_LABELS[entry.status]}
              </Badge>
            </div>
          </div>
          {entry.service_order_id && (
            <Link to={`/tecnico/ordenes/${entry.service_order_id}`}>
              <Button>
                <ExternalLink size={16} className="mr-2" /> Abrir orden de servicio
              </Button>
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-gray-900">Información del Asiento</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Tipo de visita</p>
                    <p className="font-medium">{VISIT_ENTRY_TYPE_LABELS[entry.entry_type]}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Fecha de visita</p>
                    <p className="font-medium">{formatDateOnly(entry.visit_date)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Origen</p>
                    <p className="font-medium">{VISIT_ORIGIN_LABELS[entry.origin_type || ''] || entry.origin_type || 'No informado'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Fecha de registro</p>
                    <p className="font-medium">{new Date(entry.registered_at).toLocaleString('es-AR')}</p>
                  </div>
                </div>
                {entry.title && (
                  <div>
                    <p className="text-sm text-gray-500">{entry.service_order_id ? 'Asunto de la orden' : 'Título'}</p>
                    <p className="font-medium">{entry.title}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-500">Descripción</p>
                  <p className="text-gray-700">{entry.description}</p>
                </div>
                {entry.work_performed && (
                  <div>
                    <p className="text-sm text-gray-500">Trabajo realizado</p>
                    <p className="text-gray-700">{entry.work_performed}</p>
                  </div>
                )}
                {entry.observations && (
                  <div>
                    <p className="text-sm text-gray-500">Observaciones</p>
                    <p className="text-gray-700">{entry.observations}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Clock size={18} /> Horarios y Duración
                </h3>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Hora de ingreso</p>
                    <p className="font-medium">{formatTime(entry.check_in_at)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Hora de salida</p>
                    <p className="font-medium">{formatTime(entry.check_out_at)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Duración</p>
                    <p className="font-medium">{formatVisitDuration(entry)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-gray-900">Información</h3>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <User size={16} className="text-gray-400" />
                  <div>
                    <p className="text-gray-500">Técnico</p>
                    <p className="font-medium">{(entry.technician as any)?.full_name || 'N/D'}</p>
                  </div>
                </div>
                {entry.service_case && (
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar size={16} className="text-gray-400" />
                    <div>
                      <p className="text-gray-500">Expediente</p>
                      <p className="font-medium">
                        {(entry.service_case as any).numbering_mode === 'test'
                          ? `PRUEBA N.º ${(entry.service_case as any).case_number}`
                          : `N.º ${(entry.service_case as any).case_number}`}
                      </p>
                    </div>
                  </div>
                )}
                {(entry as any).elevator && (
                  <div className="flex items-center gap-3 text-sm">
                    <Wrench size={16} className="text-gray-400" />
                    <div>
                      <p className="text-gray-500">Ascensor / Edificio</p>
                      <p className="font-medium">{(entry as any).elevator.code} — {((entry as any).elevator as any).building?.name || '-'}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
