import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getServiceRecordById, getChecklistByServiceRecord, getPhotosByServiceRecord } from '@/services/serviceRecords.service';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import ServiceChecklist from '@/components/service/ServiceChecklist';
import ServicePhotoUpload from '@/components/service/ServicePhotoUpload';
import { SERVICE_STATUS_LABELS } from '@/config/constants';
import { OPERATIONAL_STATUS_LABELS, CONSERVATION_STATUS_LABELS } from '@/types/elevators';
import type { ServiceRecord, ServiceChecklistItem, ServicePhoto } from '@/types/database';
import { Building2, Calendar, ArrowLeft, Edit } from 'lucide-react';

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
  const [checklist, setChecklist] = useState<ServiceChecklistItem[]>([]);
  const [photos, setPhotos] = useState<ServicePhoto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    try {
      const [recordData, checklistData, photosData] = await Promise.all([
        getServiceRecordById(id),
        getChecklistByServiceRecord(id),
        getPhotosByServiceRecord(id),
      ]);
      setRecord(recordData);
      setChecklist(checklistData);
      setPhotos(photosData);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="technician" title="Detalle de Mantenimiento">
        <div className="text-center py-8">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </DashboardLayout>
    );
  }

  if (!record) {
    return (
      <DashboardLayout role="technician" title="Detalle de Mantenimiento">
        <div className="text-center py-8">
          <p className="text-gray-500">Registro no encontrado</p>
        </div>
      </DashboardLayout>
    );
  }

  const canEdit = record.status === 'draft' || record.status === 'rejected';
  const elevator = record.elevator as any;

  return (
    <DashboardLayout role="technician" title="Detalle de Mantenimiento">
      <div className="space-y-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/tecnico')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={18} />
            Volver
          </button>
          
          <Badge variant={STATUS_BADGE_VARIANT[record.status] || 'default'}>
            {SERVICE_STATUS_LABELS[record.status] || record.status}
          </Badge>
        </div>

        {/* Elevator info */}
        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <Building2 size={24} className="text-primary" />
              <div>
                <h2 className="font-mono font-bold text-xl">{elevator?.code || '-'}</h2>
                <p className="text-sm text-gray-600">
                  {elevator?.building?.name} - {elevator?.building?.address}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Service info */}
        <Card>
          <CardContent>
            <h3 className="font-semibold text-gray-900 mb-4">Datos del Servicio</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Fecha</p>
                <p className="font-medium flex items-center gap-2">
                  <Calendar size={14} />
                  {new Date(record.service_date).toLocaleDateString('es-AR')}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Tipo</p>
                <p className="font-medium capitalize">{record.service_type}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Estado operativo</p>
                <Badge>{OPERATIONAL_STATUS_LABELS[record.operational_status_at_service as keyof typeof OPERATIONAL_STATUS_LABELS] || record.operational_status_at_service}</Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Estado conservación</p>
                <Badge>{CONSERVATION_STATUS_LABELS[record.conservation_status_at_service as keyof typeof CONSERVATION_STATUS_LABELS] || record.conservation_status_at_service}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Checklist */}
        <Card>
          <CardContent>
            <ServiceChecklist
              items={checklist.map(c => ({
                item_name: c.item_name,
                status: c.status as any,
                notes: c.notes || '',
              }))}
              onChange={() => {}}
              readOnly
            />
          </CardContent>
        </Card>

        {/* Description */}
        <Card>
          <CardContent>
            <h3 className="font-semibold text-gray-900 mb-4">Descripción</h3>
            
            {record.description && (
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-1">Descripción general</p>
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
          </CardContent>
        </Card>

        {/* Photos */}
        <Card>
          <CardContent>
            <ServicePhotoUpload
              serviceRecordId={record.id}
              photos={photos}
              onPhotosChange={setPhotos}
              readOnly={!canEdit}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        {canEdit && (
          <div className="flex justify-end gap-3 pb-6">
            <Button
              onClick={() => navigate(`/tecnico/mantenimientos/${record.id}/editar`)}
            >
              <Edit size={16} className="mr-2" />
              Editar
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
