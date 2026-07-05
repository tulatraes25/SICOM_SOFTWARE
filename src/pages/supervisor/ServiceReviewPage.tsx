import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getServiceRecordForReview,
  markInReview,
  generateAIReportDraft,
  saveSupervisorReportDraft,
  approveServiceRecord,
  rejectServiceRecord,
  updateElevatorStatusFromApprovedService,
  createOrUpdateMonthlyReport,
} from '@/services/supervisor.service';
import { getChecklistByServiceRecord, getPhotosByServiceRecord } from '@/services/serviceRecords.service';
import { createAuditLog } from '@/services/audit.service';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import ServiceChecklist from '@/components/service/ServiceChecklist';
import ServicePhotoUpload from '@/components/service/ServicePhotoUpload';
import { SERVICE_STATUS_LABELS } from '@/config/constants';
import { OPERATIONAL_STATUS_LABELS } from '@/types/elevators';
import type { ServiceRecord, ServiceChecklistItem, ServicePhoto } from '@/types/database';
import {
  ArrowLeft, Clock, FileText, CheckCircle, XCircle,
  Sparkles, Save, Building2, User, Calendar
} from 'lucide-react';

export default function ServiceReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [record, setRecord] = useState<ServiceRecord | null>(null);
  const [checklist, setChecklist] = useState<ServiceChecklistItem[]>([]);
  const [photos, setPhotos] = useState<ServicePhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [reportContent, setReportContent] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    try {
      const [recordData, checklistData, photosData] = await Promise.all([
        getServiceRecordForReview(id),
        getChecklistByServiceRecord(id),
        getPhotosByServiceRecord(id),
      ]);
      setRecord(recordData);
      setChecklist(checklistData);
      setPhotos(photosData);
      setReportContent(recordData?.ai_generated_report || recordData?.supervisor_notes || '');
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkInReview = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await markInReview(id);
      await createAuditLog({
        action: 'mark_in_review',
        entity_type: 'service_record',
        entity_id: id,
      });
      loadData();
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateAI = async () => {
    if (!id) return;
    setGeneratingAI(true);
    try {
      const report = await generateAIReportDraft(id);
      setReportContent(report);
      await saveSupervisorReportDraft(id, report);
      await createAuditLog({
        action: 'generate_ai_report',
        entity_type: 'service_record',
        entity_id: id,
      });
    } catch (err) {
      console.error('Error generating AI report:', err);
      alert('Error al generar informe con IA');
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await saveSupervisorReportDraft(id, reportContent);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!id || !confirm('¿Aprobar este informe? El estado del ascensor se actualizará.')) return;
    setSaving(true);
    try {
      await approveServiceRecord(id, reportContent);
      await updateElevatorStatusFromApprovedService(id);
      await createOrUpdateMonthlyReport(id);
      await createAuditLog({
        action: 'approve',
        entity_type: 'service_record',
        entity_id: id,
      });
      navigate('/supervisor');
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!id || !rejectReason.trim()) return;
    setSaving(true);
    try {
      await rejectServiceRecord(id, rejectReason);
      await createAuditLog({
        action: 'reject',
        entity_type: 'service_record',
        entity_id: id,
        new_data: { reason: rejectReason },
      });
      setShowRejectModal(false);
      navigate('/supervisor');
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="supervisor" title="Revisión">
        <div className="text-center py-8">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </DashboardLayout>
    );
  }

  if (!record) {
    return (
      <DashboardLayout role="supervisor" title="Revisión">
        <div className="text-center py-8">
          <p className="text-gray-500">Registro no encontrado</p>
        </div>
      </DashboardLayout>
    );
  }

  const elevator = record.elevator as any;
  const technician = record.technician as any;
  const client = elevator?.building?.client;

  return (
    <DashboardLayout role="supervisor" title="Revisión de Mantenimiento">
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <button
            onClick={() => navigate('/supervisor')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={18} />
            Volver
          </button>
          
          <div className="flex items-center gap-2">
            <Badge variant={
              record.status === 'submitted' ? 'info' :
              record.status === 'in_review' ? 'warning' :
              record.status === 'rejected' ? 'danger' : 'default'
            }>
              {SERVICE_STATUS_LABELS[record.status as keyof typeof SERVICE_STATUS_LABELS] || record.status}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Service data */}
          <div className="lg:col-span-2 space-y-6">
            {/* Elevator info */}
            <Card>
              <CardContent>
                <div className="flex items-start gap-4">
                  <Building2 size={24} className="text-primary mt-1" />
                  <div className="flex-1">
                    <h2 className="font-mono font-bold text-xl mb-1">{elevator?.code || '-'}</h2>
                    <p className="text-gray-600">{elevator?.building?.name}</p>
                    <p className="text-sm text-gray-500">{elevator?.building?.address}, {elevator?.building?.locality}</p>
                    <p className="text-sm text-gray-500">Cliente: {client?.name || '-'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Service data */}
            <Card>
              <CardContent>
                <h3 className="font-semibold text-gray-900 mb-4">Datos del Servicio</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <Calendar size={14} /> Fecha
                    </p>
                    <p className="font-medium">{new Date(record.service_date).toLocaleDateString('es-AR')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Tipo</p>
                    <p className="font-medium capitalize">{record.service_type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <User size={14} /> Técnico
                    </p>
                    <p className="font-medium">{technician?.full_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Estado operativo</p>
                    <Badge>{OPERATIONAL_STATUS_LABELS[record.operational_status_at_service as keyof typeof OPERATIONAL_STATUS_LABELS] || '-'}</Badge>
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
          </div>

          {/* Right column - Report editor */}
          <div className="space-y-6">
            {/* Actions */}
            <Card>
              <CardContent>
                <h3 className="font-semibold text-gray-900 mb-4">Acciones</h3>
                <div className="space-y-3">
                  {record.status === 'submitted' && (
                    <Button
                      onClick={handleMarkInReview}
                      loading={saving}
                      className="w-full"
                      variant="secondary"
                    >
                      <Clock size={16} className="mr-2" />
                      Marcar en Revisión
                    </Button>
                  )}
                  
                  <Button
                    onClick={handleGenerateAI}
                    loading={generatingAI}
                    className="w-full"
                    variant="outline"
                  >
                    <Sparkles size={16} className="mr-2" />
                    {generatingAI ? 'Generando...' : 'Generar Informe con IA'}
                  </Button>

                  <Button
                    onClick={handleSaveDraft}
                    loading={saving}
                    className="w-full"
                    variant="outline"
                  >
                    <Save size={16} className="mr-2" />
                    Guardar Borrador
                  </Button>

                  <div className="border-t pt-3 mt-3">
                    <Button
                      onClick={handleApprove}
                      loading={saving}
                      className="w-full"
                    >
                      <CheckCircle size={16} className="mr-2" />
                      Aprobar Informe
                    </Button>
                    
                    <Button
                      onClick={() => setShowRejectModal(true)}
                      className="w-full mt-2"
                      variant="danger"
                    >
                      <XCircle size={16} className="mr-2" />
                      Rechazar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Report editor */}
            <Card>
              <CardContent>
                <h3 className="font-semibold text-gray-900 mb-4">
                  <FileText size={18} className="inline mr-2" />
                  Informe
                </h3>
                <textarea
                  value={reportContent}
                  onChange={(e) => setReportContent(e.target.value)}
                  placeholder="El informe se generará con IA o podrá editarlo manualmente..."
                  className="w-full h-96 border border-gray-300 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Reject modal */}
        {showRejectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold mb-4">Motivo de Rechazo</h3>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Describa el motivo del rechazo..."
                className="w-full border border-gray-300 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                rows={4}
              />
              <div className="flex justify-end gap-3 mt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowRejectModal(false)}
                >
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  onClick={handleReject}
                  loading={saving}
                  disabled={!rejectReason.trim()}
                >
                  Rechazar
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
