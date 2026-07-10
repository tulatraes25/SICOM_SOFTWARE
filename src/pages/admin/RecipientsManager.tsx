import { useState, useEffect } from 'react';
import {
  listRecipientsByElevator,
  createRecipient,
  updateRecipient,
  deleteRecipient,
} from '@/services/reportRecipients.service';
import { createAuditLog } from '@/services/audit.service';
import type { ReportRecipient } from '@/types/database';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Plus, Edit, Trash2, User } from 'lucide-react';

interface RecipientsManagerProps {
  elevatorId: string;
  onClose?: () => void;
}

export default function RecipientsManager({ elevatorId }: RecipientsManagerProps) {
  const [recipients, setRecipients] = useState<ReportRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<ReportRecipient | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', role: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadRecipients();
  }, [elevatorId]);

  const loadRecipients = async () => {
    try {
      setLoading(true);
      const data = await listRecipientsByElevator(elevatorId);
      setRecipients(data);
    } catch (err: any) {
      console.error('Error loading recipients:', err);
      setError(err?.message || 'Error al cargar destinatarios');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!formData.email.trim()) {
      setError('El email es obligatorio');
      return;
    }
    if (!formData.name.trim()) {
      setError('El nombre es obligatorio');
      return;
    }

    setSaving(true);
    try {
      if (editingRecipient) {
        await updateRecipient(editingRecipient.id, formData);
        await createAuditLog({
          action: 'update',
          entity_type: 'report_recipient',
          entity_id: editingRecipient.id,
          new_data: formData,
        });
      } else {
        console.debug('Adding recipient', { elevatorId, name: formData.name, email: formData.email });
        await createRecipient({
          elevator_id: elevatorId,
          name: formData.name,
          email: formData.email,
          role: formData.role,
          active: true,
        });
        await createAuditLog({
          action: 'create',
          entity_type: 'report_recipient',
          new_data: formData,
        });
      }
      setShowForm(false);
      setEditingRecipient(null);
      setFormData({ name: '', email: '', role: '' });
      await loadRecipients();
    } catch (err: any) {
      console.error('Recipient save error:', err);
      setError(err?.message || 'Error al guardar destinatario');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (recipient: ReportRecipient) => {
    if (!confirm(`¿Eliminar destinatario "${recipient.name}"?`)) return;
    try {
      await deleteRecipient(recipient.id);
      await createAuditLog({
        action: 'delete',
        entity_type: 'report_recipient',
        entity_id: recipient.id,
      });
      await loadRecipients();
    } catch (err: any) {
      console.error('Error:', err);
      setError(err?.message || 'Error al eliminar');
    }
  };

  const startEdit = (recipient: ReportRecipient) => {
    setEditingRecipient(recipient);
    setFormData({
      name: recipient.name,
      email: recipient.email,
      role: recipient.role || '',
    });
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingRecipient(null);
    setFormData({ name: '', email: '', role: '' });
    setError('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-700">Destinatarios de Informes</h4>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
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
        <form onSubmit={handleSubmit} className="p-3 bg-gray-50 rounded-lg space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Nombre *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nombre completo"
              required
            />
            <Input
              label="Email *"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="correo@ejemplo.com"
              required
            />
            <Input
              label="Cargo / Función"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              placeholder="Ej: Director, Contador"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={cancelForm}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" loading={saving}>
              {editingRecipient ? 'Actualizar' : 'Agregar'}
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-4">
          <div className="w-6 h-6 border-2 border-secondary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : recipients.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">
          No hay destinatarios configurados para este ascensor.
        </p>
      ) : (
        <div className="space-y-2">
          {recipients.map((recipient) => (
            <div
              key={recipient.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-secondary/10 rounded-full flex items-center justify-center">
                  <User size={14} className="text-secondary" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{recipient.name}</p>
                  <p className="text-xs text-gray-500">{recipient.email}</p>
                  {recipient.role && (
                    <p className="text-xs text-gray-400">{recipient.role}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => startEdit(recipient)}>
                  <Edit size={14} />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(recipient)}
                  className="text-danger hover:text-danger"
                >
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
