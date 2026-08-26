import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Select from '@/components/ui/Select';
import { getServiceCase, transitionServiceCaseStatus, formatCaseNumber, getCaseEvents } from '@/services/serviceCases.service';
import { CASE_ORIGIN_LABELS, CASE_STATUS_LABELS } from '@/types/database';
import type { ServiceCase, ServiceCaseEvent, CaseStatus } from '@/types/database';
import { ArrowLeft, X, CheckCircle, User, Building2, Wrench, Calendar, AlertCircle, Edit2, RotateCcw, RefreshCw, Play } from 'lucide-react';
import CaseDocumentsSection from '@/components/cases/CaseDocumentsSection';
import { supabase } from '@/config/supabase';

const STATUS_BADGE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  open: 'info',
  assigned: 'warning',
  in_progress: 'warning',
  completed: 'success',
  closed: 'default',
  cancelled: 'danger',
};

const EVENT_LABELS: Record<string, string> = {
  case_created: 'Expediente creado',
  case_updated: 'Expediente actualizado',
  status_changed: 'Estado cambiado',
  assigned: 'Técnico asignado',
  case_unassigned: 'Asignación retirada',
  closed: 'Expediente cerrado',
  cancelled: 'Expediente anulado',
  case_reopened: 'Expediente reabierto',
  case_reactivated: 'Expediente reactivado',
  production_numbering_activated: 'Numeración productiva activada',
};

export default function ServiceCaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [serviceCase, setServiceCase] = useState<ServiceCase | null>(null);
  const [events, setEvents] = useState<ServiceCaseEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [transitionTarget, setTransitionTarget] = useState<CaseStatus>('open');
  const [reason, setReason] = useState('');
  const [selectedTechnician, setSelectedTechnician] = useState('');
  const [technicians, setTechnicians] = useState<Array<{ id: string; full_name: string }>>([]);
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

  const loadTechnicians = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name').eq('active', true).in('role', ['technician', 'supervisor']).order('full_name');
    setTechnicians(data || []);
  };

  const handleTransition = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await transitionServiceCaseStatus({
        case_id: id,
        target_status: transitionTarget,
        reason: reason || undefined,
        assigned_to: selectedTechnician || undefined,
      });
      closeAllModals();
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Error al cambiar estado');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!id || !selectedTechnician) return;
    setActionLoading(true);
    try {
      await transitionServiceCaseStatus({
        case_id: id,
        target_status: 'assigned',
        assigned_to: selectedTechnician,
      });
      closeAllModals();
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Error al asignar');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!id || !reason.trim()) return;
    setActionLoading(true);
    try {
      await transitionServiceCaseStatus({
        case_id: id,
        target_status: 'cancelled',
        reason,
      });
      closeAllModals();
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Error al anular');
    } finally {
      setActionLoading(false);
    }
  };

  const closeAllModals = () => {
    setShowCancelModal(false);
    setShowReopenModal(false);
    setShowReactivateModal(false);
    setShowAssignModal(false);
    setShowTransitionModal(false);
    setReason('');
    setSelectedTechnician('');
  };

  const openAssignModal = async () => {
    await loadTechnicians();
    setShowAssignModal(true);
  };

  const openTransitionModal = (target: CaseStatus) => {
    setTransitionTarget(target);
    if (target === 'assigned') {
      loadTechnicians();
    }
    setShowTransitionModal(true);
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

  const canEdit = ['open', 'assigned', 'in_progress', 'completed'].includes(serviceCase.status);

  const formatEventType = (evt: ServiceCaseEvent): string => {
    const base = EVENT_LABELS[evt.event_type] || evt.event_type;
    if (evt.event_type === 'status_changed') {
      const oldStatus = evt.details?.old_status as CaseStatus | undefined;
      const newStatus = evt.details?.new_status as CaseStatus | undefined;
      if (oldStatus && newStatus) {
        return `${base}: ${CASE_STATUS_LABELS[oldStatus] || oldStatus} → ${CASE_STATUS_LABELS[newStatus] || newStatus}`;
      }
    }
    return base;
  };

  const formatEventDetails = (evt: ServiceCaseEvent): string | null => {
    if (evt.event_type === 'cancelled' && evt.details?.reason) {
      return `Motivo: ${evt.details.reason}`;
    }
    if (evt.event_type === 'case_reopened' && evt.details?.reason) {
      return `Motivo: ${evt.details.reason}`;
    }
    if (evt.event_type === 'case_reactivated' && evt.details?.reason) {
      return `Motivo: ${evt.details.reason}`;
    }
    if (evt.event_type === 'case_updated' && evt.details?.changes) {
      const changes = evt.details.changes as Record<string, { old: unknown; new: unknown }>;
      const fields = Object.keys(changes);
      if (fields.length > 0) {
        return `Campos modificados: ${fields.join(', ')}`;
      }
    }
    if (evt.event_type === 'assigned' && evt.details?.assigned_to) {
      return 'Ver panel de Asociaciones';
    }
    return null;
  };

  return (
    <DashboardLayout role="admin" title={`Expediente ${formatCaseNumber(serviceCase.case_number, serviceCase.numbering_mode)}`}>
      <div className="space-y-4 2xl:space-y-6">
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
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <Button variant="outline" onClick={() => navigate(`/admin/expedientes/${id}/editar`)} disabled={actionLoading}>
                <Edit2 size={16} className="mr-2" /> Editar
              </Button>
            )}
            {serviceCase.status === 'open' && (
              <>
                <Button variant="outline" onClick={openAssignModal} disabled={actionLoading}>
                  <User size={16} className="mr-2" /> Asignar
                </Button>
                <Button variant="outline" onClick={() => openTransitionModal('in_progress')} disabled={actionLoading}>
                  <Play size={16} className="mr-2" /> Iniciar
                </Button>
              </>
            )}
            {serviceCase.status === 'assigned' && (
              <>
                <Button variant="outline" onClick={openAssignModal} disabled={actionLoading}>
                  <User size={16} className="mr-2" /> Cambiar asignación
                </Button>
                <Button variant="outline" onClick={() => openTransitionModal('open')} disabled={actionLoading}>
                  <X size={16} className="mr-2" /> Quitar asignación
                </Button>
                <Button variant="outline" onClick={() => openTransitionModal('in_progress')} disabled={actionLoading}>
                  <Play size={16} className="mr-2" /> Iniciar
                </Button>
              </>
            )}
            {serviceCase.status === 'in_progress' && (
              <>
                <Button variant="outline" onClick={openAssignModal} disabled={actionLoading}>
                  <User size={16} className="mr-2" /> Cambiar asignación
                </Button>
                <Button variant="outline" onClick={() => openTransitionModal('completed')} disabled={actionLoading}>
                  <CheckCircle size={16} className="mr-2" /> Marcar completado
                </Button>
              </>
            )}
            {serviceCase.status === 'completed' && (
              <Button variant="outline" onClick={() => openTransitionModal('in_progress')} disabled={actionLoading}>
                <RefreshCw size={16} className="mr-2" /> Volver a En curso
              </Button>
            )}
            {['open', 'assigned', 'in_progress', 'completed'].includes(serviceCase.status) && (
              <Button variant="outline" onClick={() => openTransitionModal('closed')} disabled={actionLoading}>
                <CheckCircle size={16} className="mr-2" /> Cerrar
              </Button>
            )}
            {['open', 'assigned', 'in_progress', 'completed'].includes(serviceCase.status) && (
              <Button variant="danger" onClick={() => setShowCancelModal(true)} disabled={actionLoading}>
                <X size={16} className="mr-2" /> Anular
              </Button>
            )}
            {serviceCase.status === 'closed' && (
              <Button variant="outline" onClick={() => setShowReopenModal(true)} disabled={actionLoading}>
                <RefreshCw size={16} className="mr-2" /> Reabrir
              </Button>
            )}
            {serviceCase.status === 'cancelled' && (
              <Button variant="outline" onClick={() => setShowReactivateModal(true)} disabled={actionLoading}>
                <RotateCcw size={16} className="mr-2" /> Reactivar
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 2xl:gap-6">
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

            {/* Documents */}
            <CaseDocumentsSection serviceCaseId={serviceCase.id} />

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
                        <div className="flex-1">
                          <p className="text-gray-900">{formatEventType(evt)}</p>
                          {formatEventDetails(evt) && (
                            <p className="text-gray-500 text-xs">{formatEventDetails(evt)}</p>
                          )}
                          <p className="text-gray-400 text-xs">
                            {evt.performer?.full_name || 'Sistema'} — {new Date(evt.created_at).toLocaleString('es-AR')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Info note */}
            <div className="p-3 bg-info/10 border border-info/30 rounded text-info text-sm">
              Los expedientes numerados no se eliminan físicamente. Si se cargaron por error, pueden corregirse o anularse. La anulación conserva el número y el historial. Un Administrador puede reactivar una anulación accidental.
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4 2xl:space-y-6">
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
              El expediente conservará su número y su historial. Ingrese el motivo de la anulación.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none"
              rows={3}
              placeholder="Motivo de anulación..."
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={closeAllModals}>Cancelar</Button>
              <Button variant="danger" onClick={handleCancel} disabled={!reason.trim() || actionLoading}>
                {actionLoading ? 'Anulando...' : 'Anular Expediente'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reopen modal */}
      {showReopenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Reabrir Expediente</h3>
            <p className="text-sm text-gray-600 mb-4">
              ¿Reabrir este expediente cerrado? Indique el motivo.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none"
              rows={3}
              placeholder="Motivo de reapertura..."
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={closeAllModals}>Cancelar</Button>
              <Button onClick={handleTransition} disabled={!reason.trim() || actionLoading}>
                {actionLoading ? 'Reabriendo...' : 'Reabrir Expediente'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reactivate modal */}
      {showReactivateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Reactivar Expediente</h3>
            <p className="text-sm text-gray-600 mb-4">
              ¿Reactivar este expediente anulado? Indique el motivo.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none"
              rows={3}
              placeholder="Motivo de reactivación..."
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={closeAllModals}>Cancelar</Button>
              <Button onClick={handleTransition} disabled={!reason.trim() || actionLoading}>
                {actionLoading ? 'Reactivando...' : 'Reactivar Expediente'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Assign modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">
              {serviceCase.status === 'assigned' ? 'Cambiar Asignación' : 'Asignar Técnico'}
            </h3>
            <Select
              label="Técnico"
              options={[
                { value: '', label: 'Seleccionar técnico...' },
                ...technicians.map(t => ({ value: t.id, label: t.full_name })),
              ]}
              value={selectedTechnician}
              onChange={(e) => setSelectedTechnician(e.target.value)}
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={closeAllModals}>Cancelar</Button>
              <Button onClick={handleAssign} disabled={!selectedTechnician || actionLoading}>
                {actionLoading ? 'Guardando...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Generic transition modal */}
      {showTransitionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">
              {transitionTarget === 'closed' && 'Cerrar Expediente'}
              {transitionTarget === 'in_progress' && (serviceCase.status === 'completed' ? 'Volver a En curso' : 'Iniciar Expediente')}
              {transitionTarget === 'completed' && 'Marcar Completado'}
              {transitionTarget === 'open' && 'Quitar Asignación'}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {transitionTarget === 'closed' && '¿Cerrar este expediente? Permanecerá disponible para consulta.'}
              {transitionTarget === 'in_progress' && serviceCase.status === 'completed' && 'El expediente volverá a estado En curso.'}
              {transitionTarget === 'in_progress' && serviceCase.status !== 'completed' && 'El expediente pasará a estado En curso.'}
              {transitionTarget === 'completed' && 'El expediente será marcado como completado.'}
              {transitionTarget === 'open' && 'Se retirará la asignación actual.'}
            </p>
            {(transitionTarget === 'closed' || (transitionTarget === 'open' && serviceCase.status === 'assigned')) && (
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none mb-4"
                rows={3}
                placeholder="Motivo (requerido)..."
              />
            )}
            {transitionTarget === 'assigned' && (
              <Select
                label="Técnico"
                options={[
                  { value: '', label: 'Seleccionar técnico...' },
                  ...technicians.map(t => ({ value: t.id, label: t.full_name })),
                ]}
                value={selectedTechnician}
                onChange={(e) => setSelectedTechnician(e.target.value)}
              />
            )}
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={closeAllModals}>Cancelar</Button>
              <Button
                onClick={handleTransition}
                disabled={actionLoading || (transitionTarget === 'closed' && !reason.trim())}
              >
                {actionLoading ? 'Procesando...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
