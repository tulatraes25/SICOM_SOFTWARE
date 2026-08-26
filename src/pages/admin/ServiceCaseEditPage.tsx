import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/config/supabase';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import { getServiceCase, updateServiceCase, formatCaseNumber } from '@/services/serviceCases.service';
import { CASE_ORIGIN_LABELS, CASE_STATUS_LABELS } from '@/types/database';
import type { CaseOriginType, Client, Building, Elevator, ServiceCase } from '@/types/database';
import { ArrowLeft, AlertCircle, Check } from 'lucide-react';

const ORIGIN_OPTIONS = Object.entries(CASE_ORIGIN_LABELS).map(([value, label]) => ({ value, label }));

export default function ServiceCaseEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [serviceCase, setServiceCase] = useState<ServiceCase | null>(null);

  const [originType, setOriginType] = useState<CaseOriginType>('direct_report');
  const [clientId, setClientId] = useState('');
  const [buildingId, setBuildingId] = useState('');
  const [elevatorId, setElevatorId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const [clients, setClients] = useState<Client[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [elevators, setElevators] = useState<Elevator[]>([]);

  const isCompleted = serviceCase?.status === 'completed';
  const isClosedOrCancelled = serviceCase?.status === 'closed' || serviceCase?.status === 'cancelled';

  useEffect(() => {
    if (id) loadCase();
  }, [id]);

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (clientId) {
      loadBuildings(clientId);
      if (!serviceCase || serviceCase.client_id !== clientId) {
        setBuildingId('');
        setElevatorId('');
      }
    } else {
      setBuildings([]);
      setBuildingId('');
      setElevatorId('');
    }
  }, [clientId]);

  useEffect(() => {
    if (buildingId) {
      loadElevators(buildingId);
      if (!serviceCase || serviceCase.building_id !== buildingId) {
        setElevatorId('');
      }
    } else {
      setElevators([]);
      setElevatorId('');
    }
  }, [buildingId]);

  const loadCase = async () => {
    if (!id) return;
    try {
      const sc = await getServiceCase(id);
      if (!sc) {
        setError('Expediente no encontrado');
        return;
      }
      setServiceCase(sc);
      setOriginType(sc.origin_type);
      setClientId(sc.client_id || '');
      setBuildingId(sc.building_id || '');
      setElevatorId(sc.elevator_id || '');
      setTitle(sc.title || '');
      setDescription(sc.description || '');

      if (sc.client_id) await loadBuildings(sc.client_id);
      if (sc.building_id) await loadElevators(sc.building_id);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar expediente');
    } finally {
      setLoading(false);
    }
  };

  const loadClients = async () => {
    const { data } = await supabase.from('clients').select('*').eq('active', true).order('name');
    setClients(data || []);
  };

  const loadBuildings = async (cid: string) => {
    const { data } = await supabase.from('buildings').select('*').eq('client_id', cid).eq('active', true).order('name');
    setBuildings(data || []);
  };

  const loadElevators = async (bid: string) => {
    const { data } = await supabase.from('elevators').select('*').eq('building_id', bid).eq('active', true).order('code');
    setElevators(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      await updateServiceCase({
        case_id: id,
        origin_type: originType,
        client_id: clientId || undefined,
        building_id: buildingId || undefined,
        elevator_id: elevatorId || undefined,
        title: title || undefined,
        description: description || undefined,
      });

      setSuccess('Expediente actualizado correctamente');
      setTimeout(() => {
        navigate(`/admin/expedientes/${id}`);
      }, 1200);
    } catch (err: any) {
      setError(err?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="admin" title="Editar Expediente">
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (isClosedOrCancelled) {
    return (
      <DashboardLayout role="admin" title="Editar Expediente">
        <div className="max-w-2xl mx-auto space-y-4">
          <button onClick={() => navigate(`/admin/expedientes/${id}`)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft size={18} /> Volver al expediente
          </button>
          <Card>
            <CardContent className="text-center py-8">
              <AlertCircle size={48} className="mx-auto text-warning mb-4" />
              <p className="text-gray-700 font-medium">
                {serviceCase?.status === 'closed'
                  ? 'Los expedientes cerrados deben reabrirse antes de ser editados.'
                  : 'Los expedientes anulados deben reactivarse antes de ser editados.'}
              </p>
              <Button className="mt-4" onClick={() => navigate(`/admin/expedientes/${id}`)}>
                Volver al expediente
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (!serviceCase) return null;

  return (
    <DashboardLayout role="admin" title={`Editar ${formatCaseNumber(serviceCase.case_number, serviceCase.numbering_mode)}`}>
      <div className="max-w-2xl mx-auto space-y-4 2xl:space-y-6">
        <button onClick={() => navigate(`/admin/expedientes/${id}`)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ArrowLeft size={18} /> Volver al expediente
        </button>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">Editar Expediente</h2>
              <Badge variant={serviceCase.numbering_mode === 'test' ? 'warning' : 'success'}>
                {serviceCase.numbering_mode === 'test' ? 'PRUEBA' : 'PRODUCCIÓN'}
              </Badge>
              <Badge variant="info">
                {CASE_STATUS_LABELS[serviceCase.status]}
              </Badge>
            </div>
            <p className="text-sm text-gray-500">
              {formatCaseNumber(serviceCase.case_number, serviceCase.numbering_mode)} — Solo lectura: número, modo y estado.
            </p>
          </CardHeader>
          <CardContent>
            {isCompleted && (
              <div className="p-3 bg-warning/10 border border-warning/30 rounded text-warning text-sm mb-4">
                En estado Completado solo puede modificar título y descripción. Para editar otros campos, vuelva a En curso.
              </div>
            )}

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

              <Select
                label="Origen *"
                options={ORIGIN_OPTIONS}
                value={originType}
                onChange={(e) => setOriginType(e.target.value as CaseOriginType)}
                disabled={isCompleted}
              />

              <Select
                label="Cliente"
                options={[
                  { value: '', label: 'Sin cliente' },
                  ...clients.map(c => ({ value: c.id, label: `${c.code} - ${c.name}` })),
                ]}
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                disabled={isCompleted}
              />

              {clientId && (
                <Select
                  label="Edificio"
                  options={[
                    { value: '', label: 'Sin edificio' },
                    ...buildings.map(b => ({ value: b.id, label: `${b.code} - ${b.name}` })),
                  ]}
                  value={buildingId}
                  onChange={(e) => setBuildingId(e.target.value)}
                  disabled={isCompleted}
                />
              )}

              {buildingId && (
                <Select
                  label="Ascensor"
                  options={[
                    { value: '', label: 'Sin ascensor' },
                    ...elevators.map(el => ({ value: el.id, label: el.code })),
                  ]}
                  value={elevatorId}
                  onChange={(e) => setElevatorId(e.target.value)}
                  disabled={isCompleted}
                />
              )}

              <Input
                label="Título"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Resumen breve del expediente"
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                  rows={4}
                  placeholder="Detalles del expediente..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => navigate(`/admin/expedientes/${id}`)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
