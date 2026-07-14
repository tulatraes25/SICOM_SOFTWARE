import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { createVisitEntry } from '@/services/elevatorVisitBook.service';
import { VISIT_ENTRY_TYPE_LABELS } from '@/types/database';
import type { VisitEntryType } from '@/types/database';
import { ArrowLeft, AlertCircle, Check } from 'lucide-react';

const TYPE_OPTIONS = Object.entries(VISIT_ENTRY_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }));

export default function VisitEntryCreatePage() {
  const { elevatorId } = useParams<{ elevatorId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryType, setEntryType] = useState<VisitEntryType>('scheduled_service');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [workPerformed, setWorkPerformed] = useState('');
  const [observations, setObservations] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [operationalStatus, setOperationalStatus] = useState('');
  const [conservationStatus, setConservationStatus] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!elevatorId) return;
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const result = await createVisitEntry({
        elevator_id: elevatorId,
        visit_date: visitDate,
        entry_type: entryType,
        description,
        title: title || undefined,
        work_performed: workPerformed || undefined,
        observations: observations || undefined,
        recommendations: recommendations || undefined,
        operational_status: operationalStatus || undefined,
        conservation_status: conservationStatus || undefined,
      });

      setSuccess(`Asiento N.º ${result.entry_number} creado correctamente`);
      setTimeout(() => {
        navigate(`/admin/ascensores/${elevatorId}/libro/${result.id}`);
      }, 1500);
    } catch (err: any) {
      setError(err?.message || 'Error al crear asiento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="admin" title="Nuevo Asiento del Libro">
      <div className="max-w-2xl mx-auto space-y-6">
        <button onClick={() => navigate(`/admin/ascensores/${elevatorId}/libro`)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ArrowLeft size={18} /> Volver al libro
        </button>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Crear Nuevo Asiento</h2>
            <p className="text-sm text-gray-500">El número de asiento será asignado automáticamente.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm flex items-center gap-2">
                  <AlertCircle size={16} /> {error}
                </div>
              )}

              {success && (
                <div className="p-3 bg-success/10 border border-success/30 rounded text-success text-sm flex items-center gap-2">
                  <Check size={16} /> {success}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Fecha de visita *"
                  type="date"
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                />
                <Select
                  label="Tipo de visita *"
                  options={TYPE_OPTIONS}
                  value={entryType}
                  onChange={(e) => setEntryType(e.target.value as VisitEntryType)}
                />
              </div>

              <Input
                label="Título"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Resumen breve"
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                  rows={3}
                  placeholder="Descripción de la visita..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trabajos realizados</label>
                <textarea
                  value={workPerformed}
                  onChange={(e) => setWorkPerformed(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                  rows={3}
                  placeholder="Detalle de trabajos..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                <textarea
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                  rows={2}
                  placeholder="Observaciones..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recomendaciones</label>
                <textarea
                  value={recommendations}
                  onChange={(e) => setRecommendations(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                  rows={2}
                  placeholder="Recomendaciones..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Estado operativo"
                  value={operationalStatus}
                  onChange={(e) => setOperationalStatus(e.target.value)}
                  placeholder="Ej: Operativo"
                />
                <Input
                  label="Estado de conservación"
                  value={conservationStatus}
                  onChange={(e) => setConservationStatus(e.target.value)}
                  placeholder="Ej: Conforme"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => navigate(`/admin/ascensores/${elevatorId}/libro`)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Creando...' : 'Crear Asiento'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
