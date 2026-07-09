import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getServiceRecordById, submitServiceRecord } from '@/services/serviceRecords.service';
import { createAuditLog } from '@/services/audit.service';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import ServiceChecklist from '@/components/service/ServiceChecklist';
import ServicePhotoUpload from '@/components/service/ServicePhotoUpload';
import { SERVICE_STATUS_LABELS } from '@/config/constants';
import { OPERATIONAL_STATUS_LABELS, CONSERVATION_STATUS_LABELS } from '@/types/elevators';
import type { ServiceRecord } from '@/types/database';
import { Building2, Calendar, ArrowLeft, Edit, Send, AlertCircle } from 'lucide-react';

const STATUS_BADGE_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  draft: 'default',
  submitted: 'info',
  in_review: 'warning',
  approved: 'success',
  rejected: 'danger',
};

export default function ServiceRecordDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [record, setRecord] = useState<ServiceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) {
      setError('ID de registro no proporcionado');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      const recordData = await getServiceRecordById(id);
      setRecord(recordData);
    } catch (err: any) {
      console.error('Error loading record:', err);
      setError(err?.message || 'Error al cargar el registro de mantenimiento');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (!id) return;
    if (!confirm('¿Enviar este registro a revisión del supervisor?')) return;

    setSubmitting(true);
    setError('');

    try {
      await submitServiceRecord(id);
      await createAuditLog({
        action: 'submit',
        entity_type: 'service_record',
        entity_id: id,
      });
      loadData(); // Recargar para ver el nuevo estado
    } catch (err: any) {
      setError(err?.message || 'Error al enviar a revisión');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="technician" title="Detalle de Mantenimiento">
        <div className="text-center py-8">
          <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 mt-4">Cargando registro...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error && !record) {
    return (
      <DashboardLayout role="technician" title="Detalle de Mantenimiento">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => navigate('/tecnico')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft size={18} />
            Volver
          </button>
          <Card>
            <CardContent>
              <div className="text-center py-8">
                <AlertCircle size={48} className="mx-auto text-danger mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
                <p className="text-gray-600">{error}</p>
                <Button onClick={loadData} className="mt-4">
                  Reintentar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (!record) {
    return (
      <DashboardLayout role="technician" title="Detalle de Mantenimiento">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => navigate('/tecnico')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft size={18} />
            Volver
          </button>
          <Card>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-gray-500">Registro no encontrado</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const elevator = record.elevator as any;
  const building = elevator?.building;
  const checklist = (record as any).checklist || [];
  const photos = (record as any).photos || [];
  const canEdit = record.status === 'draft' || record.status === 'rejected';
  const canSubmit = record.status === 'draft';

  return (
    <DashboardLayout role="technician" title="Detalle de Mantenimiento">
      <div className="space-y-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <button
            onClick={() => navigate('/tecnico')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={18} />
            Volver
          </button>
          
          <Badge variant={STATUS_BADGE_VARIANT[record.status] || 'default'}>
            {SERVICE_STATUS_LABELS[record.status as keyof typeof SERVICE_STATUS_LABELS] || record.status}
          </Badge>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm">
            {error}
          </div>
        )}

        {/* Elevator info */}
        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <Building2 size={24} className="text-primary" />
              <div>
                <h2 className="font-mono font-bold text-xl">{elevator?.code || '-'}</h2>
                <p className="text-sm text-gray-600">
                  {elevator?.manufacturer} {elevator?.model}
                </p>
                {building && (
                  <p className="text-sm text-gray-500">
                    {building.name} - {building.address}, {building.locality}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Service data */}
        <Card>
          <CardContent>
            <h3 className="font-semibold text-gray-900 mb-4">Datos del Servicio</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <Calendar size={14} /> Fecha
                </p>
                <p className="font-medium">{new Date(record.service_date).toLocaleDateString('es-AR')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Tipo</p>
                <p className="font-medium capitalize">{record.service_type}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Estado operativo</p>
                <p className="font-medium">
                  {OPERATIONAL_STATUS_LABELS[record.operational_status_at_service as keyof typeof OPERATIONAL_STATUS_LABELS] || record.operational_status_at_service || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Estado conservación</p>
                <p className="font-medium">
                  {CONSERVATION_STATUS_LABELS[record.conservation_status_at_service as keyof typeof CONSERVATION_STATUS_LABELS] || record.conservation_status_at_service || '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Checklist */}
        {checklist.length > 0 && (
          <Card>
            <CardContent>
              <ServiceChecklist
                items={checklist.map((c: any) => ({
                  item_name: c.item_name,
                  status: c.status,
                  notes: c.notes || '',
                }))}
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
            {record.description && (
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-1">Descripción</p>
                <p className="text-gray-700">{record.description}</p>
              </div>
            )}
            {record.observations && (
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-1">Observaciones</p>
                <p className="text-gray-700">{record.observations}</p>
              </div>
            )}
            {record.technical_report && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Mini informe técnico</p>
                <p className="text-gray-700 whitespace-pre-wrap">{record.technical_report}</p>
              </div>
            )}
            {!record.description && !record.observations && !record.technical_report && (
              <p className="text-gray-500">No hay descripción registrada</p>
            )}
          </CardContent>
        </Card>

        {/* Photos */}
        {photos.length > 0 && (
          <Card>
            <CardContent>
              <ServicePhotoUpload
                serviceRecordId={record.id}
                photos={photos}
                onPhotosChange={() => {}}
                readOnly
              />
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        {(canEdit || canSubmit) && (
          <div className="flex flex-col sm:flex-row justify-end gap-3 pb-6">
            {canEdit && (
              <Button
                onClick={() => navigate(`/tecnico/mantenimientos/${record.id}/editar`)}
              >
                <Edit size={16} className="mr-2" />
                Editar
              </Button>
            )}
            {canSubmit && (
              <Button
                onClick={handleSubmitForReview}
                loading={submitting}
              >
                <Send size={16} className="mr-2" />
                Enviar a Revisión
              </Button>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
