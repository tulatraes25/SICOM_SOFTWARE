import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getElevatorById } from '@/services/elevators.service';
import {
  createServiceRecord,
  updateServiceRecord,
  submitServiceRecord,
  createChecklistItems,
  deleteChecklistByServiceRecord,
} from '@/services/serviceRecords.service';
import { createAuditLog } from '@/services/audit.service';
import ServiceChecklist, { createDefaultChecklist } from '@/components/service/ServiceChecklist';
import ServicePhotoUpload from '@/components/service/ServicePhotoUpload';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { OPERATIONAL_STATUS_LABELS, CONSERVATION_STATUS_LABELS } from '@/types/elevators';
import type { ServiceType } from '@/types/database';
import { SERVICE_TYPE_LABELS } from '@/config/constants';
import type { Elevator } from '@/types/database';
import type { ServicePhoto } from '@/types/database';
import { Building2, Save, Send } from 'lucide-react';

export default function ServiceRecordForm() {
  const navigate = useNavigate();
  const { elevatorId } = useParams<{ elevatorId: string }>();
  const { user } = useAuth();
  
  const [elevator, setElevator] = useState<Elevator | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [checklist, setChecklist] = useState(createDefaultChecklist());
  const [photos, setPhotos] = useState<ServicePhoto[]>([]);
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<{
    service_date: string;
    service_type: ServiceType;
    operational_status_at_service: string;
    conservation_status_at_service: string;
    description: string;
    observations: string;
    technical_report: string;
  }>({
    service_date: new Date().toISOString().split('T')[0],
    service_type: 'preventivo',
    operational_status_at_service: '',
    conservation_status_at_service: '',
    description: '',
    observations: '',
    technical_report: '',
  });

  useEffect(() => {
    loadElevator();
  }, [elevatorId]);

  const loadElevator = async () => {
    if (!elevatorId) return;
    try {
      const data = await getElevatorById(elevatorId);
      setElevator(data);
      if (data) {
        setFormData(prev => ({
          ...prev,
          operational_status_at_service: data.operational_status,
          conservation_status_at_service: data.conservation_status,
        }));
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!elevator || !user) return;
    setError('');
    setSaving(true);

    try {
      let recordId = savedRecordId;

      if (recordId) {
        // Update existing draft
        await updateServiceRecord(recordId, formData);
        
        // Delete old checklist and create new
        await deleteChecklistByServiceRecord(recordId);
        await createChecklistItems(
          checklist.map(item => ({
            service_record_id: recordId!,
            ...item,
          }))
        );
      } else {
        // Create new record
        const record = await createServiceRecord({
          elevator_id: elevator.id,
          technician_id: user.id,
          ...formData,
        });
        recordId = record.id;
        setSavedRecordId(recordId);

        // Create checklist
        await createChecklistItems(
          checklist.map(item => ({
            service_record_id: recordId!,
            ...item,
          }))
        );

        await createAuditLog({
          action: 'create',
          entity_type: 'service_record',
          entity_id: recordId,
          new_data: formData,
        });
      }

      navigate('/tecnico');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (!elevator || !user) return;
    
    if (!confirm('¿Enviar este registro a revisión del supervisor?')) return;
    
    setError('');
    setSaving(true);

    try {
      let recordId = savedRecordId;

      if (!recordId) {
        // Create first
        const record = await createServiceRecord({
          elevator_id: elevator.id,
          technician_id: user.id,
          ...formData,
        });
        recordId = record.id;

        await createChecklistItems(
          checklist.map(item => ({
            service_record_id: recordId!,
            ...item,
          }))
        );
      }

      // Submit
      await submitServiceRecord(recordId);

      await createAuditLog({
        action: 'submit',
        entity_type: 'service_record',
        entity_id: recordId,
      });

      navigate('/tecnico');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="technician" title="Cargar Mantenimiento">
        <div className="text-center py-8">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </DashboardLayout>
    );
  }

  if (!elevator) {
    return (
      <DashboardLayout role="technician" title="Cargar Mantenimiento">
        <div className="text-center py-8">
          <p className="text-gray-500">Ascensor no encontrado</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="technician" title="Cargar Mantenimiento">
      <div className="space-y-6 max-w-3xl mx-auto">
        {/* Elevator info */}
        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <Building2 size={24} className="text-primary" />
              <div>
                <h2 className="font-mono font-bold text-xl">{elevator.code}</h2>
                <p className="text-sm text-gray-600">
                  {elevator.building?.name} - {elevator.building?.address}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm">
            {error}
          </div>
        )}

        {/* Service form */}
        <Card>
          <CardContent>
            <h3 className="font-semibold text-gray-900 mb-4">Datos del Servicio</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Fecha del servicio"
                type="date"
                value={formData.service_date}
                onChange={(e) => setFormData({ ...formData, service_date: e.target.value })}
              />
              
              <Select
                label="Tipo de servicio"
                value={formData.service_type}
                onChange={(e) => setFormData({ ...formData, service_type: e.target.value as ServiceType })}
                options={Object.entries(SERVICE_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <Select
                label="Estado operativo resultante"
                value={formData.operational_status_at_service}
                onChange={(e) => setFormData({ ...formData, operational_status_at_service: e.target.value })}
                options={Object.entries(OPERATIONAL_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
              />
              
              <Select
                label="Estado de conservación resultante"
                value={formData.conservation_status_at_service}
                onChange={(e) => setFormData({ ...formData, conservation_status_at_service: e.target.value })}
                options={Object.entries(CONSERVATION_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Checklist */}
        <Card>
          <CardContent>
            <ServiceChecklist
              items={checklist}
              onChange={setChecklist}
            />
          </CardContent>
        </Card>

        {/* Description */}
        <Card>
          <CardContent>
            <h3 className="font-semibold text-gray-900 mb-4">Descripción del Trabajo</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción general
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describa los trabajos realizados..."
                  className="w-full border border-gray-300 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observaciones
                </label>
                <textarea
                  value={formData.observations}
                  onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                  placeholder="Observaciones adicionales..."
                  className="w-full border border-gray-300 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mini informe técnico
                </label>
                <textarea
                  value={formData.technical_report}
                  onChange={(e) => setFormData({ ...formData, technical_report: e.target.value })}
                  placeholder="Resumen técnico del mantenimiento realizado..."
                  className="w-full border border-gray-300 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  rows={4}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Photos */}
        {savedRecordId && (
          <Card>
            <CardContent>
              <ServicePhotoUpload
                serviceRecordId={savedRecordId}
                photos={photos}
                onPhotosChange={setPhotos}
              />
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 pb-6">
          <Button
            variant="outline"
            onClick={() => navigate('/tecnico')}
          >
            Cancelar
          </Button>
          <Button
            variant="secondary"
            onClick={handleSaveDraft}
            loading={saving}
          >
            <Save size={16} className="mr-2" />
            Guardar Borrador
          </Button>
          <Button
            onClick={handleSubmitForReview}
            loading={saving}
          >
            <Send size={16} className="mr-2" />
            Enviar a Revisión
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
