import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { getServiceCase, closeServiceCase, cancelServiceCase, formatCaseNumber, getCaseEvents } from '@/services/serviceCases.service';
import { CASE_ORIGIN_LABELS, CASE_STATUS_LABELS } from '@/types/database';
import type { ServiceCase, ServiceCaseEvent } from '@/types/database';
import { ArrowLeft, X, CheckCircle, User, Building2, Wrench, Calendar, AlertCircle } from 'lucide-react';

const STATUS_BADGE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  open: 'info',
  assigned: 'warning',
  in_progress: 'warning',
  completed: 'success',
  closed: 'default',
  cancelled: 'danger',
};

export default function ServiceCaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [serviceCase, setServiceCase] = useState<ServiceCase | null>(null);
  const [events, setEvents] = useState<ServiceCaseEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    try {
      const [sc, evts] = await Promise.all([
        getServiceCase(id),
        getCaseEvents(id),
      ]);
      setServiceCase(sc);
      setEvents(evts);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar expediente');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    if (!id || !confirm('¿Cerrar este expediente?')) return;
    setActionLoading(true);
    try {
      await closeServiceCase(id);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Error al cerrar');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!id || !cancelReason.trim()) return;
    setActionLoading(true);
    try {
      await cancelServiceCase(id, cancelReason);
      setShowCancelModal(false);
      setCancelReason('');
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Error al anular');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="admin" title="Expediente">
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (error && !serviceCase) {
    return (
      <DashboardLayout role="admin" title="Expediente">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => navigate('/admin/expedientes')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
            <ArrowLeft size={18} /> Volver
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

  if (!serviceCase) return null;

  const isActive = !['closed', 'cancelled'].includes(serviceCase.status);

  return (
    <DashboardLayout role="admin" title={`Expediente ${formatCaseNumber(serviceCase.case_number, serviceCase.numbering_mode)}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <button onClick={() => navigate('/admin/expedientes')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2">
              <ArrowLeft size={18} /> Volver a expedientes
            </button>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900">
                {formatCaseNumber(serviceCase.case_number, serviceCase.numbering_mode)}
              </h2>
              <Badge variant={serviceCase.numbering_mode === 'test' ? 'warning' : 'success'}>
                {serviceCase.numbering_mode === 'test' ? 'PRUEBA' : 'PRODUCCIÓN'}
              </Badge>
              <Badge variant={STATUS_BADGE[serviceCase.status]}>
                {CASE_STATUS_LABELS[serviceCase.status]}
              </Badge>
            </div>
          </div>
          {isActive && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose} disabled={actionLoading}>
                <CheckCircle size={16} className="mr-2" /> Cerrar
              </Button>
              <Button variant="danger" onClick={() => setShowCancelModal(true)} disabled={actionLoading}>
                <X size={16} className="mr-2" /> Anular
              </Button>
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main info */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-gray-900">Información del Expediente</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Origen</p>
                    <p className="font-medium">{CASE_ORIGIN_LABELS[serviceCase.origin_type]}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Fecha de creación</p>
                    <p className="font-medium">{new Date(serviceCase.created_at).toLocaleDateString('es-AR')}</p>
                  </div>
                  {serviceCase.title && (
                    <div className="col-span-2">
                      <p className="text-sm text-gray-500">Título</p>
                      <p className="font-medium">{serviceCase.title}</p>
                    </div>
                  )}
                  {serviceCase.description && (
                    <div className="col-span-2">
                      <p className="text-sm text-gray-500">Descripción</p>
                      <p className="text-gray-700">{serviceCase.description}</p>
                    </div>
                  )}
                </div>
                {serviceCase.cancellation_reason && (
                  <div className="p-3 bg-danger/5 border border-danger/20 rounded">
                    <p className="text-sm text-danger font-medium">Motivo de anulación:</p>
                    <p className="text-sm text-gray-700">{serviceCase.cancellation_reason}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Events timeline */}
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-gray-900">Historial</h3>
              </CardHeader>
              <CardContent>
                {events.length === 0 ? (
                  <p className="text-gray-500 text-sm">Sin eventos registrados</p>
                ) : (
                  <div className="space-y-3">
                    {events.map((evt) => (
                      <div key={evt.id} className="flex gap-3 text-sm">
                        <div className="w-2 h-2 rounded-full bg-secondary mt-1.5 shrink-0" />
                        <div>
                          <p className="text-gray-900">
                            {evt.event_type === 'case_created' && 'Expediente creado'}
                            {evt.event_type === 'closed' && 'Expediente cerrado'}
                            {evt.event_type === 'cancelled' && `Expediente anulado${evt.details?.reason ? `: ${evt.details.reason}` : ''}`}
                            {evt.event_type === 'assigned' && 'Técnico asignado'}
                          </p>
                          <p className="text-gray-500 text-xs">
                            {new Date(evt.created_at).toLocaleString('es-AR')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Related entities */}
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-gray-900">Asociaciones</h3>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <User size={16} className="text-gray-400" />
                  <div>
                    <p className="text-gray-500">Creado por</p>
                    <p className="font-medium">{(serviceCase.created_user as any)?.full_name || 'N/D'}</p>
                  </div>
                </div>
                {serviceCase.assigned_user && (
                  <div className="flex items-center gap-3 text-sm">
                    <Wrench size={16} className="text-gray-400" />
                    <div>
                      <p className="text-gray-500">Asignado a</p>
                      <p className="font-medium">{(serviceCase.assigned_user as any)?.full_name}</p>
                    </div>
                  </div>
                )}
                {serviceCase.client && (
                  <div className="flex items-center gap-3 text-sm">
                    <Building2 size={16} className="text-gray-400" />
                    <div>
                      <p className="text-gray-500">Cliente</p>
                      <p className="font-medium">{(serviceCase.client as any)?.name}</p>
                    </div>
                  </div>
                )}
                {serviceCase.building && (
                  <div className="flex items-center gap-3 text-sm">
                    <Building2 size={16} className="text-gray-400" />
                    <div>
                      <p className="text-gray-500">Edificio</p>
                      <p className="font-medium">{(serviceCase.building as any)?.name}</p>
                    </div>
                  </div>
                )}
                {serviceCase.elevator && (
                  <div className="flex items-center gap-3 text-sm">
                    <Wrench size={16} className="text-gray-400" />
                    <div>
                      <p className="text-gray-500">Ascensor</p>
                      <p className="font-medium">{(serviceCase.elevator as any)?.code}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Dates */}
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-gray-900">Fechas</h3>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <Calendar size={16} className="text-gray-400" />
                  <div>
                    <p className="text-gray-500">Creado</p>
                    <p className="font-medium">{new Date(serviceCase.created_at).toLocaleString('es-AR')}</p>
                  </div>
                </div>
                {serviceCase.closed_at && (
                  <div className="flex items-center gap-3">
                    <CheckCircle size={16} className="text-gray-400" />
                    <div>
                      <p className="text-gray-500">Cerrado</p>
                      <p className="font-medium">{new Date(serviceCase.closed_at).toLocaleString('es-AR')}</p>
                    </div>
                  </div>
                )}
                {serviceCase.cancelled_at && (
                  <div className="flex items-center gap-3">
                    <X size={16} className="text-gray-400" />
                    <div>
                      <p className="text-gray-500">Anulado</p>
                      <p className="font-medium">{new Date(serviceCase.cancelled_at).toLocaleString('es-AR')}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Cancel modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Anular Expediente</h3>
            <p className="text-sm text-gray-600 mb-4">
              Ingrese el motivo de la anulación. Esta acción no se puede deshacer.
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none"
              rows={3}
              placeholder="Motivo de anulación..."
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => { setShowCancelModal(false); setCancelReason(''); }}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={handleCancel}
                disabled={!cancelReason.trim() || actionLoading}
              >
                {actionLoading ? 'Anulando...' : 'Anular Expediente'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
