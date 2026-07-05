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
import { Plus, Edit, Trash2, X, Mail, User } from 'lucide-react';

interface RecipientsManagerProps {
  elevatorId: string;
  onClose: () => void;
}

export default function RecipientsManager({ elevatorId, onClose }: RecipientsManagerProps) {
  const [recipients, setRecipients] = useState<ReportRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<ReportRecipient | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadRecipients = async () => {
    try {
      setLoading(true);
      const data = await listRecipientsByElevator(elevatorId);
      setRecipients(data);
    } catch (err) {
      console.error('Error loading recipients:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecipients();
  }, [elevatorId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
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
        const newRecipient = await createRecipient({
          elevator_id: elevatorId,
          ...formData,
          active: true,
        });
        await createAuditLog({
          action: 'create',
          entity_type: 'report_recipient',
          entity_id: newRecipient.id,
          new_data: formData,
        });
      }
      setShowForm(false);
      setEditingRecipient(null);
      setFormData({ name: '', email: '', role: '' });
      loadRecipients();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
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
      loadRecipients();
    } catch (err) {
      console.error('Error:', err);
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
        <h3 className="text-lg font-semibold">Destinatarios de Informes</h3>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus size={16} className="mr-1" />
            Agregar
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X size={16} />
          </Button>
        </div>
      </div>

      {showForm && (
        <div className="p-4 bg-gray-50 rounded-lg">
          {error && (
            <div className="mb-3 p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input
                label="Nombre *"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="Nombre completo"
              />
              <Input
                label="Email *"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                placeholder="email@ejemplo.com"
              />
              <Input
                label="Rol / Descripción"
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
        </div>
      )}

      {loading ? (
        <div className="text-center py-4">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : recipients.length === 0 ? (
        <div className="text-center py-6 text-gray-500">
          <Mail size={32} className="mx-auto mb-2 text-gray-300" />
          <p>No hay destinatarios configurados</p>
          <p className="text-sm">Los informes mensuales se enviarán a los destinatarios agregados aquí.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {recipients.map((recipient) => (
            <div
              key={recipient.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <User size={16} className="text-primary" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{recipient.name}</p>
                  <p className="text-sm text-gray-600">{recipient.email}</p>
                  {recipient.role && (
                    <p className="text-xs text-gray-500">{recipient.role}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => startEdit(recipient)}
                >
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
