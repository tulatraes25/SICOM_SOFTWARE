import { useState, useEffect } from 'react';
import { listByBuilding, createRecipient, updateRecipient, deleteRecipient } from '@/services/buildingReportRecipients.service';
import { createAuditLog } from '@/services/audit.service';
import type { BuildingRecipient } from '@/services/buildingReportRecipients.service';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Plus, Edit, Trash2, User } from 'lucide-react';

interface BuildingRecipientsManagerProps {
  buildingId: string;
}

export default function BuildingRecipientsManager({ buildingId }: BuildingRecipientsManagerProps) {
  const [recipients, setRecipients] = useState<BuildingRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<BuildingRecipient | null>(null);
  const [form, setForm] = useState({ name: '', email: '', role: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (buildingId) loadRecipients();
  }, [buildingId]);

  const loadRecipients = async () => {
    try {
      setLoading(true);
      const data = await listByBuilding(buildingId);
      setRecipients(data);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar destinatarios');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRecipient = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setError(null);

    if (!buildingId) {
      setError('No se encontró el ID del edificio.');
      return;
    }
    if (!form.name.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    if (!form.email.trim()) {
      setError('El email es obligatorio.');
      return;
    }

    setSaving(true);
    try {
      const created = await createRecipient(buildingId, {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role.trim() || undefined,
      });
      console.debug('[BuildingRecipients] Created:', created);
      await createAuditLog({ action: 'create', entity_type: 'building_recipient', new_data: form });
      setForm({ name: '', email: '', role: '' });
      setShowForm(false);
      setEditingRecipient(null);
      await loadRecipients();
    } catch (err: any) {
      console.error('[BuildingRecipients] Error:', err);
      setError(err?.message || 'Error al guardar destinatario');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setError(null);

    if (!editingRecipient) return;
    if (!form.name.trim() || !form.email.trim()) {
      setError('Nombre y email son obligatorios.');
      return;
    }

    setSaving(true);
    try {
      await updateRecipient(editingRecipient.id, {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role.trim() || undefined,
      });
      await createAuditLog({ action: 'update', entity_type: 'building_recipient', entity_id: editingRecipient.id });
      setForm({ name: '', email: '', role: '' });
      setShowForm(false);
      setEditingRecipient(null);
      await loadRecipients();
    } catch (err: any) {
      setError(err?.message || 'Error al actualizar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (recipient: BuildingRecipient) => {
    if (!confirm(`¿Eliminar "${recipient.name}"?`)) return;
    try {
      await deleteRecipient(recipient.id);
      await createAuditLog({ action: 'delete', entity_type: 'building_recipient', entity_id: recipient.id });
      await loadRecipients();
    } catch (err: any) {
      setError(err?.message || 'Error al eliminar');
    }
  };

  const startEdit = (recipient: BuildingRecipient) => {
    setEditingRecipient(recipient);
    setForm({ name: recipient.name, email: recipient.email, role: recipient.role || '' });
    setShowForm(true);
  };

  const openAddForm = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setEditingRecipient(null);
    setForm({ name: '', email: '', role: '' });
    setShowForm(true);
    setError(null);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingRecipient(null);
    setForm({ name: '', email: '', role: '' });
    setError(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-700">Destinatarios de Informes</h4>
        {!showForm && (
          <Button size="sm" type="button" onClick={openAddForm}>
            <Plus size={14} className="mr-1" /> Agregar
          </Button>
        )}
      </div>

      {error && (
        <div className="p-2 bg-danger/10 border border-danger/30 rounded text-danger text-sm">
          {error}
        </div>
      )}

      {showForm && (
        <div className="p-3 bg-gray-50 rounded-lg space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Nombre *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nombre completo"
              required
            />
            <Input
              label="Email *"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="correo@ejemplo.com"
              required
            />
            <Input
              label="Cargo"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              placeholder="Ej: Director"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={closeForm}>
              Cancelar
            </Button>
            <Button type="button" size="sm" loading={saving} onClick={editingRecipient ? handleEdit : handleAddRecipient}>
              {editingRecipient ? 'Actualizar' : 'Agregar'}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-4">
          <div className="w-6 h-6 border-2 border-secondary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : recipients.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">
          No hay destinatarios configurados para este edificio.
        </p>
      ) : (
        <div className="space-y-2">
          {recipients.map((r) => (
            <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-secondary/10 rounded-full flex items-center justify-center">
                  <User size={14} className="text-secondary" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{r.name}</p>
                  <p className="text-xs text-gray-500">{r.email}</p>
                  {r.role && <p className="text-xs text-gray-400">{r.role}</p>}
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" type="button" onClick={() => startEdit(r)}>
                  <Edit size={14} />
                </Button>
                <Button size="sm" variant="ghost" type="button" onClick={() => handleDelete(r)} className="text-danger hover:text-danger">
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
