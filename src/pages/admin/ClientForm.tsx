import { useState, useEffect } from 'react';
import { createClient, updateClient } from '@/services/clients.service';
import { createAuditLog } from '@/services/audit.service';
import type { Client } from '@/types/database';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface ClientFormProps {
  client?: Client | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ClientForm({ client, onSuccess, onCancel }: ClientFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    tax_id: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    address: '',
    locality: '',
    province: 'Chubut',
    active: true,
  });

  useEffect(() => {
    if (client) {
      setFormData({
        code: client.code || '',
        name: client.name || '',
        tax_id: client.tax_id || '',
        contact_name: client.contact_name || '',
        contact_email: client.contact_email || '',
        contact_phone: client.contact_phone || '',
        address: client.address || '',
        locality: client.locality || '',
        province: client.province || 'Chubut',
        active: client.active ?? true,
      });
    }
  }, [client]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (client) {
        await updateClient(client.id, formData);
        await createAuditLog({
          action: 'update',
          entity_type: 'client',
          entity_id: client.id,
          new_data: formData,
        });
      } else {
        const newClient = await createClient(formData);
        await createAuditLog({
          action: 'create',
          entity_type: 'client',
          entity_id: newClient.id,
          new_data: formData,
        });
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Código *"
          value={formData.code}
          onChange={(e) => setFormData({ ...formData, code: e.target.value })}
          required
          placeholder="Ej: CLI-001"
        />
        <Input
          label="Nombre *"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          placeholder="Nombre del cliente"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="CUIT"
          value={formData.tax_id}
          onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
          placeholder="XX-XXXXXXXX-X"
        />
        <Input
          label="Localidad"
          value={formData.locality}
          onChange={(e) => setFormData({ ...formData, locality: e.target.value })}
          placeholder="Ej: Comodoro Rivadavia"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Contacto"
          value={formData.contact_name}
          onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
          placeholder="Nombre del contacto"
        />
        <Input
          label="Teléfono"
          value={formData.contact_phone}
          onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
          placeholder="+54 299 XXX-XXXX"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Email"
          type="email"
          value={formData.contact_email}
          onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
          placeholder="contacto@empresa.com"
        />
        <Input
          label="Provincia"
          value={formData.province}
          onChange={(e) => setFormData({ ...formData, province: e.target.value })}
        />
      </div>

      <Input
        label="Dirección"
        value={formData.address}
        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
        placeholder="Dirección completa"
      />

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={loading}>
          {client ? 'Actualizar' : 'Crear Cliente'}
        </Button>
      </div>
    </form>
  );
}
