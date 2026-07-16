import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/config/supabase';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { createClaim } from '@/services/claims.service';
import { CLAIM_CHANNEL_LABELS, CLAIM_CATEGORY_LABELS, CLAIM_PRIORITY_LABELS } from '@/types/database';
import type { Client, Building, Elevator, Profile } from '@/types/database';
import { ArrowLeft, AlertCircle, Check } from 'lucide-react';

const CHANNEL_OPTS = Object.entries(CLAIM_CHANNEL_LABELS).map(([v, l]) => ({ value: v, label: l }));
const CATEGORY_OPTS = Object.entries(CLAIM_CATEGORY_LABELS).map(([v, l]) => ({ value: v, label: l }));
const PRIORITY_OPTS = Object.entries(CLAIM_PRIORITY_LABELS).map(([v, l]) => ({ value: v, label: l }));

export default function ClaimCreatePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [clientId, setClientId] = useState('');
  const [buildingId, setBuildingId] = useState('');
  const [elevatorId, setElevatorId] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [claimDate] = useState(new Date().toISOString().split('T')[0]);
  const [channel, setChannel] = useState('phone');
  const [category, setCategory] = useState('other');
  const [priority, setPriority] = useState('normal');
  const [claimantName, setClaimantName] = useState('');
  const [claimantPhone, setClaimantPhone] = useState('');
  const [claimantEmail] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [elevators, setElevators] = useState<Elevator[]>([]);
  const [technicians, setTechnicians] = useState<Profile[]>([]);

  useEffect(() => {
    supabase.from('clients').select('*').eq('active', true).order('name').then(({ data }) => setClients(data || []));
    supabase.from('profiles').select('*').eq('role', 'technician').eq('active', true).order('full_name').then(({ data }) => setTechnicians(data || []));
  }, []);

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
    if (!clientId || !buildingId || !subject.trim() || !description.trim()) { setError('Cliente, edificio, asunto y descripción son obligatorios'); return; }
    setError(''); setSuccess(''); setLoading(true);
    try {
      const result = await createClaim({
        client_id: clientId, building_id: buildingId, elevator_id: elevatorId || undefined,
        subject: subject.trim(), description: description.trim(), claim_date: claimDate,
        channel: channel as any, category: category as any, priority: priority as any,
        claimant_name: claimantName || undefined, claimant_phone: claimantPhone || undefined,
        claimant_email: claimantEmail || undefined, internal_notes: internalNotes || undefined,
        assigned_to: assignedTo || undefined,
      });
      setSuccess(`Reclamo ${result.numbering_mode === 'test' ? 'de prueba ' : ''}N.º ${result.case_number} creado`);
      setTimeout(() => navigate(`/admin/reclamos/${result.claim_id}`), 1500);
    } catch (err: any) { setError(err?.message || 'Error al crear reclamo'); } finally { setLoading(false); }
  };

  return (
    <DashboardLayout role="admin" title="Nuevo Reclamo">
      <div className="max-w-3xl mx-auto space-y-6">
        <button onClick={() => navigate('/admin/reclamos')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900"><ArrowLeft size={18} /> Volver</button>
        <Card><CardHeader><h2 className="text-lg font-semibold">Crear Reclamo</h2></CardHeader><CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm flex items-center gap-2"><AlertCircle size={16} /> {error}</div>}
            {success && <div className="p-3 bg-success/10 border border-success/30 rounded text-success text-sm flex items-center gap-2"><Check size={16} /> {success}</div>}
            <div className="grid grid-cols-3 gap-4">
              <Select label="Cliente *" options={[{ value: '', label: 'Seleccionar' }, ...clients.map(c => ({ value: c.id, label: c.name }))]} value={clientId} onChange={(e) => setClientId(e.target.value)} />
              <Select label="Edificio *" options={[{ value: '', label: 'Seleccionar' }, ...buildings.map(b => ({ value: b.id, label: b.name }))]} value={buildingId} onChange={(e) => setBuildingId(e.target.value)} />
              <Select label="Ascensor" options={[{ value: '', label: 'Sin ascensor' }, ...elevators.map(el => ({ value: el.id, label: el.code }))]} value={elevatorId} onChange={(e) => setElevatorId(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Nombre del reclamante" value={claimantName} onChange={(e) => setClaimantName(e.target.value)} />
              <Input label="Teléfono" value={claimantPhone} onChange={(e) => setClaimantPhone(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Select label="Canal" options={CHANNEL_OPTS} value={channel} onChange={(e) => setChannel(e.target.value)} />
              <Select label="Categoría" options={CATEGORY_OPTS} value={category} onChange={(e) => setCategory(e.target.value)} />
              <Select label="Prioridad" options={PRIORITY_OPTS} value={priority} onChange={(e) => setPriority(e.target.value)} />
            </div>
            <Input label="Asunto *" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Resumen del reclamo" />
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Descripción *</label><textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <Select label="Técnico asignado" options={[{ value: '', label: 'Sin asignar' }, ...technicians.map(t => ({ value: t.id, label: t.full_name }))]} value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} />
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Notas internas</label><textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" rows={2} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} /></div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => navigate('/admin/reclamos')}>Cancelar</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Creando...' : 'Crear Reclamo'}</Button>
            </div>
          </form>
        </CardContent></Card>
      </div>
    </DashboardLayout>
  );
}
