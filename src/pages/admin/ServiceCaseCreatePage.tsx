import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/config/supabase';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { createServiceCase } from '@/services/serviceCases.service';
import { CASE_ORIGIN_LABELS } from '@/types/database';
import type { CaseOriginType, Client, Building, Elevator } from '@/types/database';
import { ArrowLeft, AlertCircle, Check } from 'lucide-react';

const ORIGIN_OPTIONS = Object.entries(CASE_ORIGIN_LABELS).map(([value, label]) => ({ value, label }));

export default function ServiceCaseCreatePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [originType, setOriginType] = useState<CaseOriginType>('direct_report');
  const [clientId, setClientId] = useState('');
  const [buildingId, setBuildingId] = useState('');
  const [elevatorId, setElevatorId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const [clients, setClients] = useState<Client[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [elevators, setElevators] = useState<Elevator[]>([]);

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (clientId) {
      loadBuildings(clientId);
      setBuildingId('');
      setElevatorId('');
    } else {
      setBuildings([]);
      setBuildingId('');
      setElevatorId('');
    }
  }, [clientId]);

  useEffect(() => {
    if (buildingId) {
      loadElevators(buildingId);
      setElevatorId('');
    } else {
      setElevators([]);
      setElevatorId('');
    }
  }, [buildingId]);

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
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const result = await createServiceCase({
        origin_type: originType,
        client_id: clientId || undefined,
        building_id: buildingId || undefined,
        elevator_id: elevatorId || undefined,
        title: title || undefined,
        description: description || undefined,
      });

      setSuccess(`Expediente ${result.numbering_mode === 'test' ? 'de prueba ' : ''}N.º ${result.case_number} creado correctamente`);
      setTimeout(() => {
        navigate(`/admin/expedientes/${result.id}`);
      }, 1500);
    } catch (err: any) {
      setError(err?.message || 'Error al crear expediente');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="admin" title="Nuevo Expediente">
      <div className="max-w-2xl mx-auto space-y-6">
        <button onClick={() => navigate('/admin/expedientes')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ArrowLeft size={18} /> Volver a expedientes
        </button>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Crear Nuevo Expediente</h2>
            <p className="text-sm text-gray-500">El número será asignado automáticamente.</p>
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

              <Select
                label="Origen *"
                options={ORIGIN_OPTIONS}
                value={originType}
                onChange={(e) => setOriginType(e.target.value as CaseOriginType)}
              />

              <Select
                label="Cliente"
                options={[
                  { value: '', label: 'Sin cliente' },
                  ...clients.map(c => ({ value: c.id, label: `${c.code} - ${c.name}` })),
                ]}
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
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
                <Button type="button" variant="outline" onClick={() => navigate('/admin/expedientes')}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Creando...' : 'Crear Expediente'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
