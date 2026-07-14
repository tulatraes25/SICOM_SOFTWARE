import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/config/supabase';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { createBudget } from '@/services/budgets.service';
import type { Client, Building, Elevator } from '@/types/database';
import { ArrowLeft, AlertCircle, Check } from 'lucide-react';

export default function BudgetCreatePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [clientId, setClientId] = useState('');
  const [buildingId, setBuildingId] = useState('');
  const [elevatorId, setElevatorId] = useState('');
  const [subject, setSubject] = useState('');
  const [budgetDate, setBudgetDate] = useState(new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState('');

  const [clients, setClients] = useState<Client[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [elevators, setElevators] = useState<Elevator[]>([]);

  useEffect(() => { loadClients(); }, []);

  useEffect(() => {
    if (clientId) {
      loadBuildings(clientId);
      setBuildingId(''); setElevatorId('');
    } else { setBuildings([]); setBuildingId(''); setElevatorId(''); }
  }, [clientId]);

  useEffect(() => {
    if (buildingId) {
      loadElevators(buildingId);
      setElevatorId('');
    } else { setElevators([]); setElevatorId(''); }
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
    if (!clientId || !subject.trim()) { setError('Cliente y asunto son obligatorios'); return; }
    setError(''); setSuccess(''); setLoading(true);
    try {
      const result = await createBudget({
        client_id: clientId,
        building_id: buildingId || undefined,
        elevator_id: elevatorId || undefined,
        subject: subject.trim(),
        budget_date: budgetDate,
        valid_until: validUntil || undefined,
      });
      setSuccess(`Presupuesto N.º ${result.case_number} creado`);
      setTimeout(() => navigate(`/admin/presupuestos/${result.budget_id}`), 1500);
    } catch (err: any) {
      setError(err?.message || 'Error al crear presupuesto');
    } finally { setLoading(false); }
  };

  return (
    <DashboardLayout role="admin" title="Nuevo Presupuesto">
      <div className="max-w-2xl mx-auto space-y-6">
        <button onClick={() => navigate('/admin/presupuestos')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ArrowLeft size={18} /> Volver
        </button>
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Crear Presupuesto</h2>
            <p className="text-sm text-gray-500">El número será asignado automáticamente desde el expediente.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}
              {success && <div className="p-3 bg-success/10 border border-success/30 rounded text-success text-sm flex items-center gap-2"><Check size={16} /> {success}</div>}

              <Select
                label="Cliente *"
                options={[{ value: '', label: 'Seleccionar cliente' }, ...clients.map(c => ({ value: c.id, label: `${c.code} - ${c.name}` }))]}
                value={clientId} onChange={(e) => setClientId(e.target.value)}
              />
              {clientId && (
                <Select
                  label="Edificio"
                  options={[{ value: '', label: 'Sin edificio' }, ...buildings.map(b => ({ value: b.id, label: `${b.code} - ${b.name}` }))]}
                  value={buildingId} onChange={(e) => setBuildingId(e.target.value)}
                />
              )}
              {buildingId && (
                <Select
                  label="Ascensor"
                  options={[{ value: '', label: 'Sin ascensor' }, ...elevators.map(el => ({ value: el.id, label: el.code }))]}
                  value={elevatorId} onChange={(e) => setElevatorId(e.target.value)}
                />
              )}
              <Input label="Asunto *" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ej: Mantenimiento preventivo semestral" />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Fecha" type="date" value={budgetDate} onChange={(e) => setBudgetDate(e.target.value)} />
                <Input label="Válido hasta" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => navigate('/admin/presupuestos')}>Cancelar</Button>
                <Button type="submit" disabled={loading}>{loading ? 'Creando...' : 'Crear Presupuesto'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
