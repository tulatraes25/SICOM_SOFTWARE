import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { listBuildingRecipients, createBuildingRecipient, updateBuildingRecipient, deactivateBuildingRecipient } from '@/services/buildingRecipients.service';
import type { BuildingRecipient } from '@/types/database';
import { Users, Plus, Edit2, Trash2, AlertCircle, Check } from 'lucide-react';

interface RecipientsSectionProps {
  buildingId: string;
  elevators?: Array<{ id: string; code: string }>;
}

export default function RecipientsSection({ buildingId, elevators = [] }: RecipientsSectionProps) {
  const [recipients, setRecipients] = useState<BuildingRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [roleLabel, setRoleLabel] = useState('');
  const [elevatorScope, setElevatorScope] = useState('');
  const [receivesOrders, setReceivesOrders] = useState(true);
  const [receivesReports, setReceivesReports] = useState(true);

  useEffect(() => { loadRecipients(); }, [buildingId]);

  const loadRecipients = async () => {
    try {
      const data = await listBuildingRecipients(buildingId);
      setRecipients(data);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const resetForm = () => {
    setName(''); setEmail(''); setPhone(''); setRoleLabel('');
    setElevatorScope(''); setReceivesOrders(true); setReceivesReports(true);
    setEditingId(null); setShowForm(false); setError('');
  };

  const handleEdit = (r: BuildingRecipient) => {
    setEditingId(r.id);
    setName(r.full_name);
    setEmail(r.email);
    setPhone(r.phone || '');
    setRoleLabel(r.role_label || '');
    setElevatorScope(r.elevator_id || '');
    setReceivesOrders(r.receives_service_orders);
    setReceivesReports(r.receives_monthly_reports);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !email.trim()) { setError('Nombre y correo son obligatorios'); return; }
    setError('');
    try {
      if (editingId) {
        await updateBuildingRecipient(editingId, {
          full_name: name.trim(), email: email.trim().toLowerCase(), phone: phone || undefined,
          role_label: roleLabel || undefined, elevator_id: elevatorScope || undefined,
          receives_service_orders: receivesOrders, receives_monthly_reports: receivesReports,
        });
        setSuccess('Destinatario actualizado');
      } else {
        await createBuildingRecipient({
          building_id: buildingId, full_name: name.trim(), email: email.trim().toLowerCase(),
          phone: phone || undefined, role_label: roleLabel || undefined,
          elevator_id: elevatorScope || undefined,
          receives_service_orders: receivesOrders, receives_monthly_reports: receivesReports,
        });
        setSuccess('Destinatario creado');
      }
      resetForm();
      await loadRecipients();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      if (err?.message?.includes('duplicate')) setError('Ya existe un contacto con ese correo en este alcance');
      else setError(err?.message || 'Error');
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row justify-between items-center">
        <h3 className="font-semibold flex items-center gap-2"><Users size={18} /> Destinatarios</h3>
        {!showForm && <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}><Plus size={14} className="mr-1" /> Nuevo</Button>}
      </CardHeader>
      <CardContent>
        {error && <div className="p-2 bg-danger/10 border border-danger/30 rounded text-danger text-sm flex items-center gap-2 mb-3"><AlertCircle size={14} /> {error}</div>}
        {success && <div className="p-2 bg-success/10 border border-success/30 rounded text-success text-sm flex items-center gap-2 mb-3"><Check size={14} /> {success}</div>}

        {showForm && (
          <div className="p-3 border rounded-lg mb-4 space-y-3 bg-gray-50">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Nombre *" value={name} onChange={(e) => setName(e.target.value)} />
              <Input label="Correo *" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Input label="Cargo" value={roleLabel} onChange={(e) => setRoleLabel(e.target.value)} />
              <Input label="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <Select label="Alcance" options={[{ value: '', label: 'Todo el edificio' }, ...elevators.map(e => ({ value: e.id, label: e.code }))]} value={elevatorScope} onChange={(e) => setElevatorScope(e.target.value)} />
            </div>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={receivesOrders} onChange={(e) => setReceivesOrders(e.target.checked)} /> Órdenes de Servicio</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={receivesReports} onChange={(e) => setReceivesReports(e.target.checked)} /> Informes mensuales</label>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave}>{editingId ? 'Actualizar' : 'Guardar'}</Button>
              <Button size="sm" variant="outline" onClick={resetForm}>Cancelar</Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-4"><div className="w-6 h-6 border-4 border-secondary border-t-transparent rounded-full animate-spin" /></div>
        ) : recipients.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">No hay destinatarios configurados.</p>
        ) : (
          <div className="space-y-2">
            {recipients.map((r) => (
              <div key={r.id} className="flex items-center gap-3 p-2 border rounded hover:bg-gray-50">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{r.full_name}</span>
                    <Badge variant={r.active ? 'success' : 'danger'}>{r.active ? 'Activo' : 'Inactivo'}</Badge>
                  </div>
                  <p className="text-xs text-gray-500">{r.email}{r.role_label ? ` — ${r.role_label}` : ''}</p>
                  <p className="text-xs text-gray-400">
                    {r.elevator_id ? 'Ascensor específico' : 'Todo el edificio'}
                    {r.receives_service_orders ? ' · Órdenes' : ''}
                    {r.receives_monthly_reports ? ' · Informes' : ''}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(r)}><Edit2 size={14} /></Button>
                  <Button variant="ghost" size="sm" onClick={async () => {
                    if (confirm('¿Desactivar este destinatario?')) {
                      await deactivateBuildingRecipient(r.id);
                      await loadRecipients();
                    }
                  }}><Trash2 size={14} className="text-danger" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
