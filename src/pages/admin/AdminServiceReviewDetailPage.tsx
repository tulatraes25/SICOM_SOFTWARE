import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getServiceRecordForReview, approveServiceRecord, rejectServiceRecord, updateElevatorStatusFromApprovedService } from '@/services/supervisor.service';
import { createAuditLog } from '@/services/audit.service';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import ServiceChecklist from '@/components/service/ServiceChecklist';
import { SERVICE_STATUS_LABELS } from '@/config/constants';
import { OPERATIONAL_STATUS_LABELS, CONSERVATION_STATUS_LABELS } from '@/types/elevators';
import type { ServiceRecord } from '@/types/database';
import { Building2, Calendar, ArrowLeft, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const STATUS_BADGE: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  draft: 'default',
  submitted: 'info',
  in_review: 'warning',
  approved: 'success',
  rejected: 'danger',
};

export default function AdminServiceReviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [record, setRecord] = useState<ServiceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [rejectNotes, setRejectNotes] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError('');
      const data = await getServiceRecordForReview(id);
      setRecord(data);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar el registro');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!id) return;
    if (!confirm('¿Aprobar este mantenimiento? Se actualizará el estado del ascensor.')) return;

    setSaving(true);
    setError('');

    try {
      await approveServiceRecord(id);
      await updateElevatorStatusFromApprovedService(id);
      await createAuditLog({
        action: 'approve',
        entity_type: 'service_record',
        entity_id: id,
      });
      loadData();
    } catch (err: any) {
      setError(err?.message || 'Error al aprobar');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!id || !rejectNotes.trim()) return;

    setSaving(true);
    setError('');

    try {
      await rejectServiceRecord(id, rejectNotes);
      await createAuditLog({
        action: 'reject',
        entity_type: 'service_record',
        entity_id: id,
        new_data: { reason: rejectNotes },
      });
      setShowRejectModal(false);
      setRejectNotes('');
      loadData();
    } catch (err: any) {
      setError(err?.message || 'Error al rechazar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="admin" title="Revisión de Mantenimiento">
        <div className="text-center py-8">
          <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </DashboardLayout>
    );
  }

  if (error && !record) {
    return (
      <DashboardLayout role="admin" title="Revisión de Mantenimiento">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => navigate('/admin/mantenimientos')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
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

  if (!record) {
    return (
      <DashboardLayout role="admin" title="Revisión de Mantenimiento">
        <div className="text-center py-8"><p className="text-gray-500">Registro no encontrado</p></div>
      </DashboardLayout>
    );
  }

  const elevator = record.elevator as any;
  const building = elevator?.building;
  const client = building?.client;
  const technician = record.technician as any;
  const checklist = (record as any).checklist || [];
  const canReview = record.status === 'submitted' || record.status === 'in_review';

  return (
    <DashboardLayout role="admin" title="Revisión de Mantenimiento">
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <button onClick={() => navigate('/admin/mantenimientos')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft size={18} /> Volver
          </button>
          <Badge variant={STATUS_BADGE[record.status] || 'default'}>
            {SERVICE_STATUS_LABELS[record.status as keyof typeof SERVICE_STATUS_LABELS] || record.status}
          </Badge>
        </div>

        {error && (
          <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm">{error}</div>
        )}

        {/* Info grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Elevator */}
          <Card>
            <CardContent>
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Building2 size={18} /> Ascensor
              </h3>
              <div className="space-y-2">
                <div><span className="text-sm text-gray-500">Código: </span><span className="font-mono font-bold">{elevator?.code || '-'}</span></div>
                <div><span className="text-sm text-gray-500">Edificio: </span><span>{building?.name || '-'}</span></div>
                <div><span className="text-sm text-gray-500">Dirección: </span><span>{building?.address || '-'}, {building?.locality || '-'}</span></div>
                <div><span className="text-sm text-gray-500">Cliente: </span><span>{client?.name || '-'}</span></div>
              </div>
            </CardContent>
          </Card>

          {/* Service */}
          <Card>
            <CardContent>
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Calendar size={18} /> Servicio
              </h3>
              <div className="space-y-2">
                <div><span className="text-sm text-gray-500">Técnico: </span><span>{technician?.full_name || '-'}</span></div>
                <div><span className="text-sm text-gray-500">Fecha: </span><span>{new Date(record.service_date).toLocaleDateString('es-AR')}</span></div>
                <div><span className="text-sm text-gray-500">Tipo: </span><span className="capitalize">{record.service_type}</span></div>
                <div><span className="text-sm text-gray-500">Estado operativo: </span><span>{OPERATIONAL_STATUS_LABELS[record.operational_status_at_service as keyof typeof OPERATIONAL_STATUS_LABELS] || '-'}</span></div>
                <div><span className="text-sm text-gray-500">Estado conservación: </span><span>{CONSERVATION_STATUS_LABELS[record.conservation_status_at_service as keyof typeof CONSERVATION_STATUS_LABELS] || '-'}</span></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Checklist */}
        {checklist.length > 0 && (
          <Card>
            <CardContent>
              <h3 className="font-semibold text-gray-900 mb-4">Checklist</h3>
              <ServiceChecklist
                items={checklist.map((c: any) => ({ item_name: c.item_name, status: c.status, notes: c.notes || '' }))}
                onChange={() => {}}
                readOnly
              />
            </CardContent>
          </Card>
        )}

        {/* Description */}
        <Card>
          <CardContent>
            <h3 className="font-semibold text-gray-900 mb-4">Descripción del Trabajo</h3>
            {record.description && <div className="mb-4"><p className="text-sm text-gray-500 mb-1">Descripción</p><p className="text-gray-700">{record.description}</p></div>}
            {record.observations && <div className="mb-4"><p className="text-sm text-gray-500 mb-1">Observaciones</p><p className="text-gray-700">{record.observations}</p></div>}
            {record.technical_report && <div><p className="text-sm text-gray-500 mb-1">Mini informe técnico</p><p className="text-gray-700 whitespace-pre-wrap">{record.technical_report}</p></div>}
            {!record.description && !record.observations && !record.technical_report && <p className="text-gray-500">No hay descripción</p>}
          </CardContent>
        </Card>

        {/* Actions */}
        {canReview && (
          <Card>
            <CardContent>
              <h3 className="font-semibold text-gray-900 mb-4">Acciones</h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={handleApprove} loading={saving}>
                  <CheckCircle size={16} className="mr-2" /> Aprobar
                </Button>
                <Button variant="danger" onClick={() => setShowRejectModal(true)} disabled={saving}>
                  <XCircle size={16} className="mr-2" /> Rechazar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reject modal */}
        {showRejectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold mb-4">Motivo de Rechazo</h3>
              <textarea
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="Describa el motivo del rechazo..."
                className="w-full border border-gray-300 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                rows={4}
              />
              <div className="flex justify-end gap-3 mt-4">
                <Button variant="outline" onClick={() => setShowRejectModal(false)}>Cancelar</Button>
                <Button variant="danger" onClick={handleReject} loading={saving} disabled={!rejectNotes.trim()}>Rechazar</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
