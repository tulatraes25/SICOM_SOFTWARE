import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { getVisitEntry, submitVisitEntry, approveVisitEntry, cancelVisitEntry } from '@/services/elevatorVisitBook.service';
import { VISIT_ENTRY_TYPE_LABELS, VISIT_ENTRY_STATUS_LABELS } from '@/types/database';
import type { ElevatorVisitEntry } from '@/types/database';
import { ArrowLeft, X, CheckCircle, Send, AlertCircle, User, Calendar, Wrench } from 'lucide-react';

const STATUS_BADGE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  draft: 'default',
  submitted: 'info',
  approved: 'success',
  rectified: 'warning',
  cancelled: 'danger',
};

export default function VisitEntryDetailPage() {
  const { elevatorId, entryId } = useParams<{ elevatorId: string; entryId: string }>();
  const navigate = useNavigate();
  const [entry, setEntry] = useState<ElevatorVisitEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    if (entryId) loadEntry();
  }, [entryId]);

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

  const handleAction = async (action: () => Promise<void>) => {
    setActionLoading(true);
    setError('');
    try {
      await action();
      await loadEntry();
    } catch (err: any) {
      setError(err?.message || 'Error en la acción');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmit = () => handleAction(() => submitVisitEntry(entryId!));
  const handleApprove = () => {
    if (!confirm('¿Aprobar este asiento?')) return;
    return handleAction(() => approveVisitEntry(entryId!));
  };
  const handleCancel = () => {
    if (!cancelReason.trim()) return;
    return handleAction(() => cancelVisitEntry(entryId!, cancelReason)).then(() => {
      setShowCancelModal(false);
      setCancelReason('');
    });
  };

  if (loading) {
    return (
      <DashboardLayout role="admin" title="Asiento del Libro">
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (error && !entry) {
    return (
      <DashboardLayout role="admin" title="Asiento del Libro">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => navigate(`/admin/ascensores/${elevatorId}/libro`)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
            <ArrowLeft size={18} /> Volver al libro
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

  const isActive = !['cancelled', 'rectified'].includes(entry.status);
  const canSubmit = entry.status === 'draft';
  const canApprove = entry.status === 'submitted';

  return (
    <DashboardLayout role="admin" title={`Asiento N.º ${entry.entry_number}`}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <button onClick={() => navigate(`/admin/ascensores/${elevatorId}/libro`)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2">
              <ArrowLeft size={18} /> Volver al libro
            </button>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900">Asiento N.º {entry.entry_number}</h2>
              <Badge variant={STATUS_BADGE[entry.status]}>
                {VISIT_ENTRY_STATUS_LABELS[entry.status]}
              </Badge>
              {entry.is_rectification && (
                <Badge variant="warning">Rectificación</Badge>
              )}
            </div>
          </div>
          {isActive && (
            <div className="flex gap-2">
              {canSubmit && (
                <Button onClick={handleSubmit} disabled={actionLoading}>
                  <Send size={16} className="mr-2" /> Enviar a revisión
                </Button>
              )}
              {canApprove && (
                <Button onClick={handleApprove} disabled={actionLoading}>
                  <CheckCircle size={16} className="mr-2" /> Aprobar
                </Button>
              )}
              <Button variant="danger" onClick={() => setShowCancelModal(true)} disabled={actionLoading}>
                <X size={16} className="mr-2" /> Anular
              </Button>
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

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
                    <p className="font-medium">{new Date(entry.visit_date).toLocaleDateString('es-AR')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Fecha de registro</p>
                    <p className="font-medium">{new Date(entry.registered_at).toLocaleString('es-AR')}</p>
                  </div>
                  {entry.title && (
                    <div className="col-span-2">
                      <p className="text-sm text-gray-500">Título</p>
                      <p className="font-medium">{entry.title}</p>
                    </div>
                  )}
                </div>
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
                {entry.recommendations && (
                  <div>
                    <p className="text-sm text-gray-500">Recomendaciones</p>
                    <p className="text-gray-700">{entry.recommendations}</p>
                  </div>
                )}
                {entry.cancellation_reason && (
                  <div className="p-3 bg-danger/5 border border-danger/20 rounded">
                    <p className="text-sm text-danger font-medium">Motivo de anulación:</p>
                    <p className="text-sm text-gray-700">{entry.cancellation_reason}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-gray-900">Asociaciones</h3>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <User size={16} className="text-gray-400" />
                  <div>
                    <p className="text-gray-500">Registrado por</p>
                    <p className="font-medium">{(entry.registered_user as any)?.full_name || 'N/D'}</p>
                  </div>
                </div>
                {entry.technician && (
                  <div className="flex items-center gap-3 text-sm">
                    <Wrench size={16} className="text-gray-400" />
                    <div>
                      <p className="text-gray-500">Técnico</p>
                      <p className="font-medium">{(entry.technician as any)?.full_name}</p>
                    </div>
                  </div>
                )}
                {entry.service_case && (
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar size={16} className="text-gray-400" />
                    <div>
                      <p className="text-gray-500">Expediente</p>
                      <p className="font-medium">
                        N.º {(entry.service_case as any).case_number}
                        {(entry.service_case as any).numbering_mode === 'test' && (
                          <span className="text-warning ml-1">(PRUEBA)</span>
                        )}
                      </p>
                    </div>
                  </div>
                )}
                {entry.reviewed_by && (
                  <div className="flex items-center gap-3 text-sm">
                    <CheckCircle size={16} className="text-gray-400" />
                    <div>
                      <p className="text-gray-500">Revisado por</p>
                      <p className="font-medium">{(entry.reviewer as any)?.full_name}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="font-semibold text-gray-900">Estados</h3>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {entry.operational_status && (
                  <div>
                    <p className="text-gray-500">Estado operativo</p>
                    <p className="font-medium">{entry.operational_status}</p>
                  </div>
                )}
                {entry.conservation_status && (
                  <div>
                    <p className="text-gray-500">Estado de conservación</p>
                    <p className="font-medium">{entry.conservation_status}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Anular Asiento</h3>
            <p className="text-sm text-gray-600 mb-4">
              Ingrese el motivo de la anulación.
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none"
              rows={3}
              placeholder="Motivo..."
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => { setShowCancelModal(false); setCancelReason(''); }}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={handleCancel} disabled={!cancelReason.trim() || actionLoading}>
                {actionLoading ? 'Anulando...' : 'Anular'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
