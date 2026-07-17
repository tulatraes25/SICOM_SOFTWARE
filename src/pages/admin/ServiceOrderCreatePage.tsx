import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/config/supabase';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { createServiceOrder } from '@/services/serviceOrders.service';
import { SERVICE_ORDER_TYPE_LABELS, CLAIM_PRIORITY_LABELS } from '@/types/database';
import type { Client, Building, Elevator } from '@/types/database';
import { ArrowLeft, AlertCircle, Check } from 'lucide-react';

const TYPE_OPTS = Object.entries(SERVICE_ORDER_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }));
const PRIORITY_OPTS = Object.entries(CLAIM_PRIORITY_LABELS).map(([v, l]) => ({ value: v, label: l }));

export default function ServiceOrderCreatePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [clientId, setClientId] = useState('');
  const [buildingId, setBuildingId] = useState('');
  const [elevatorId, setElevatorId] = useState('');
  const [subject, setSubject] = useState('');
  const [workRequested, setWorkRequested] = useState('');
  const [orderType, setOrderType] = useState('other');
  const [priority, setPriority] = useState('normal');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [elevators, setElevators] = useState<Elevator[]>([]);

  useEffect(() => { supabase.from('clients').select('*').eq('active', true).order('name').then(({ data }) => setClients(data || [])); }, []);

  useEffect(() => {
    if (clientId) { supabase.from('buildings').select('*').eq('client_id', clientId).eq('active', true).order('name').then(({ data }) => setBuildings(data || [])); setBuildingId(''); setElevatorId(''); }
    else { setBuildings([]); setBuildingId(''); setElevatorId(''); }
  }, [clientId]);

  useEffect(() => {
    if (buildingId) { supabase.from('elevators').select('*').eq('building_id', buildingId).eq('active', true).order('code').then(({ data }) => setElevators(data || [])); setElevatorId(''); }
    else { setElevators([]); setElevatorId(''); }
  }, [buildingId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !buildingId || !subject.trim() || !workRequested.trim()) { setError('Cliente, edificio, asunto y trabajo solicitado son obligatorios'); return; }
    setError(''); setSuccess(''); setLoading(true);
    try {
      const result = await createServiceOrder({
        client_id: clientId, building_id: buildingId, elevator_id: elevatorId || undefined,
        subject: subject.trim(), work_requested: workRequested.trim(),
        order_type: orderType as any, priority,
        scheduled_date: scheduledDate || undefined, scheduled_time: scheduledTime || undefined,
      });
      setSuccess(`Orden ${result.numbering_mode === 'test' ? 'de prueba ' : ''}N.º ${result.case_number} creada`);
      setTimeout(() => navigate(`/admin/ordenes-servicio/${result.order_id}`), 1500);
    } catch (err: any) { setError(err?.message || 'Error'); } finally { setLoading(false); }
  };

  return (
    <DashboardLayout role="admin" title="Nueva Orden de Servicio">
      <div className="max-w-3xl mx-auto space-y-6">
        <button onClick={() => navigate('/admin/ordenes-servicio')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900"><ArrowLeft size={18} /> Volver</button>
        <Card><CardHeader><h2 className="text-lg font-semibold">Crear Orden de Servicio</h2></CardHeader><CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}
            {success && <div className="p-3 bg-success/10 border border-success/30 rounded text-success text-sm flex items-center gap-2"><Check size={16} /> {success}</div>}
            <div className="grid grid-cols-3 gap-4">
              <Select label="Cliente *" options={[{ value: '', label: 'Seleccionar' }, ...clients.map(c => ({ value: c.id, label: c.name }))]} value={clientId} onChange={(e) => setClientId(e.target.value)} />
              <Select label="Edificio *" options={[{ value: '', label: 'Seleccionar' }, ...buildings.map(b => ({ value: b.id, label: b.name }))]} value={buildingId} onChange={(e) => setBuildingId(e.target.value)} />
              <Select label="Ascensor" options={[{ value: '', label: 'Sin ascensor' }, ...elevators.map(el => ({ value: el.id, label: el.code }))]} value={elevatorId} onChange={(e) => setElevatorId(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select label="Tipo" options={TYPE_OPTS} value={orderType} onChange={(e) => setOrderType(e.target.value)} />
              <Select label="Prioridad" options={PRIORITY_OPTS} value={priority} onChange={(e) => setPriority(e.target.value)} />
            </div>
            <Input label="Asunto *" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Resumen de la orden" />
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Trabajo solicitado *</label><textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" rows={4} value={workRequested} onChange={(e) => setWorkRequested(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Fecha programada" type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
              <Input label="Hora programada" type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => navigate('/admin/ordenes-servicio')}>Cancelar</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Creando...' : 'Crear Orden'}</Button>
            </div>
          </form>
        </CardContent></Card>
      </div>
    </DashboardLayout>
  );
}
