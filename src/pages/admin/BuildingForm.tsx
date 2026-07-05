import { useState, useEffect } from 'react';
import { listClients } from '@/services/clients.service';
import { createBuilding, updateBuilding } from '@/services/buildings.service';
import { createAuditLog } from '@/services/audit.service';
import type { Client, Building } from '@/types/database';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';

interface BuildingFormProps {
  building?: Building | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function BuildingForm({ building, onSuccess, onCancel }: BuildingFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    client_id: '',
    address: '',
    locality: '',
    province: 'Chubut',
    latitude: '',
    longitude: '',
    active: true,
  });

  useEffect(() => {
    loadClients();
    if (building) {
      setFormData({
        code: building.code || '',
        name: building.name || '',
        client_id: building.client_id || '',
        address: building.address || '',
        locality: building.locality || '',
        province: building.province || 'Chubut',
        latitude: building.latitude?.toString() || '',
        longitude: building.longitude?.toString() || '',
        active: building.active ?? true,
      });
    }
  }, [building]);

  const loadClients = async () => {
    try {
      const data = await listClients();
      setClients(data.filter(c => c.active));
    } catch (err) {
      console.error('Error loading clients:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const buildingData = {
        ...formData,
        latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
        longitude: formData.longitude ? parseFloat(formData.longitude) : undefined,
      };

      if (building) {
        await updateBuilding(building.id, buildingData);
        await createAuditLog({
          action: 'update',
          entity_type: 'building',
          entity_id: building.id,
          new_data: buildingData,
        });
      } else {
        const newBuilding = await createBuilding(buildingData);
        await createAuditLog({
          action: 'create',
          entity_type: 'building',
          entity_id: newBuilding.id,
          new_data: buildingData,
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
          placeholder="Ej: EDI-001"
        />
        <Input
          label="Nombre *"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          placeholder="Nombre del edificio"
        />
      </div>

      <Select
        label="Cliente *"
        value={formData.client_id}
        onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
        options={clients.map(c => ({ value: c.id, label: c.name }))}
        placeholder="Seleccionar cliente"
        required
      />

      <Input
        label="Dirección *"
        value={formData.address}
        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
        required
        placeholder="Dirección completa"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Localidad *"
          value={formData.locality}
          onChange={(e) => setFormData({ ...formData, locality: e.target.value })}
          required
          placeholder="Ej: Comodoro Rivadavia"
        />
        <Input
          label="Provincia"
          value={formData.province}
          onChange={(e) => setFormData({ ...formData, province: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Latitud"
          type="number"
          step="any"
          value={formData.latitude}
          onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
          placeholder="-45.8667"
        />
        <Input
          label="Longitud"
          type="number"
          step="any"
          value={formData.longitude}
          onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
          placeholder="-67.5000"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={loading}>
          {building ? 'Actualizar' : 'Crear Edificio'}
        </Button>
      </div>
    </form>
  );
}
