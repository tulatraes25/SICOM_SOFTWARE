import { useState, useEffect } from 'react';
import { listClients } from '@/services/clients.service';
import { getBuildingsByClient } from '@/services/buildings.service';
import { listResponsible } from '@/services/profiles.service';
import { createElevator, updateElevator } from '@/services/elevators.service';
import { createAuditLog } from '@/services/audit.service';
import RecipientsManager from './RecipientsManager';
import {
  OPERATIONAL_STATUS_LABELS,
  CONSERVATION_STATUS_LABELS,
  CONTRACTUAL_STATUS_LABELS,
  ELEVATOR_TYPE_LABELS,
} from '@/types/elevators';
import type { Client, Building, Elevator } from '@/types/database';
import type { Profile } from '@/types/roles';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';

interface ElevatorFormProps {
  elevator?: Elevator | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ElevatorForm({ elevator, onSuccess, onCancel }: ElevatorFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [responsibleUsers, setResponsibleUsers] = useState<Profile[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [formData, setFormData] = useState({
    code: '',
    client_id: '',
    building_id: '',
    elevator_type: '',
    serial_number: '',
    manufacturer: '',
    model: '',
    capacity_kg: '',
    floors_served: '',
    year_installed: '',
    operational_status: 'operativo',
    conservation_status: 'conforme',
    contractual_status: 'activo',
    responsible_user_id: '',
    conservation_company: '',
    supervisor_name: '',
    supervisor_phone: '',
    notes: '',
    active: true,
  });

  useEffect(() => {
    loadInitialData();
    if (elevator) {
      setSelectedClientId(elevator.client_id || '');
      setFormData({
        code: elevator.code || '',
        client_id: elevator.client_id || '',
        building_id: elevator.building_id || '',
        elevator_type: elevator.elevator_type || '',
        serial_number: elevator.serial_number || '',
        manufacturer: elevator.manufacturer || '',
        model: elevator.model || '',
        capacity_kg: elevator.capacity_kg?.toString() || '',
        floors_served: elevator.floors_served || '',
        year_installed: elevator.year_installed?.toString() || '',
        operational_status: elevator.operational_status || 'operativo',
        conservation_status: elevator.conservation_status || 'conforme',
        contractual_status: elevator.contractual_status || 'activo',
        responsible_user_id: elevator.responsible_user_id || '',
        conservation_company: elevator.conservation_company || '',
        supervisor_name: elevator.supervisor_name || '',
        supervisor_phone: elevator.supervisor_phone || '',
        notes: elevator.notes || '',
        active: elevator.active ?? true,
      });
    }
  }, [elevator]);

  const loadInitialData = async () => {
    try {
      const [clientsData, responsibleData] = await Promise.all([
        listClients(),
        listResponsible(),
      ]);
      setClients(clientsData.filter(c => c.active));
      setResponsibleUsers(responsibleData);
    } catch (err) {
      console.error('Error loading data:', err);
    }
  };

  useEffect(() => {
    if (selectedClientId) {
      loadBuildings(selectedClientId);
    } else {
      setBuildings([]);
    }
  }, [selectedClientId]);

  const loadBuildings = async (clientId: string) => {
    try {
      const data = await getBuildingsByClient(clientId);
      setBuildings(data);
    } catch (err) {
      console.error('Error loading buildings:', err);
    }
  };

  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId);
    setFormData({ ...formData, client_id: clientId, building_id: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const elevatorData = {
        ...formData,
        capacity_kg: formData.capacity_kg ? parseInt(formData.capacity_kg) : undefined,
        year_installed: formData.year_installed ? parseInt(formData.year_installed) : undefined,
      };

      if (elevator) {
        await updateElevator(elevator.id, elevatorData);
        await createAuditLog({
          action: 'update',
          entity_type: 'elevator',
          entity_id: elevator.id,
          new_data: elevatorData,
        });
      } else {
        const newElevator = await createElevator(elevatorData);
        await createAuditLog({
          action: 'create',
          entity_type: 'elevator',
          entity_id: newElevator.id,
          new_data: elevatorData,
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
          placeholder="Ej: ASC-0001"
        />
        <Select
          label="Cliente *"
          value={selectedClientId}
          onChange={(e) => handleClientChange(e.target.value)}
          options={clients.map(c => ({ value: c.id, label: c.name }))}
          placeholder="Seleccionar cliente"
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label="Edificio *"
          value={formData.building_id}
          onChange={(e) => setFormData({ ...formData, building_id: e.target.value })}
          options={buildings.map(b => ({ value: b.id, label: b.name }))}
          placeholder={selectedClientId ? "Seleccionar edificio" : "Primero seleccione un cliente"}
          required
          disabled={!selectedClientId}
        />
        <Select
          label="Tipo de Elevador"
          value={formData.elevator_type}
          onChange={(e) => setFormData({ ...formData, elevator_type: e.target.value })}
          options={Object.entries(ELEVATOR_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
          placeholder="Seleccionar tipo"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input
          label="Número de Serie"
          value={formData.serial_number}
          onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
          placeholder="Número de serie"
        />
        <Input
          label="Fabricante"
          value={formData.manufacturer}
          onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
          placeholder="Ej: Otis, Schindler"
        />
        <Input
          label="Modelo"
          value={formData.model}
          onChange={(e) => setFormData({ ...formData, model: e.target.value })}
          placeholder="Modelo"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input
          label="Capacidad (kg)"
          type="number"
          value={formData.capacity_kg}
          onChange={(e) => setFormData({ ...formData, capacity_kg: e.target.value })}
          placeholder="Ej: 630"
        />
        <Input
          label="Pisos"
          value={formData.floors_served}
          onChange={(e) => setFormData({ ...formData, floors_served: e.target.value })}
          placeholder="Ej: PB,1,2,3"
        />
        <Input
          label="Año Instalación"
          type="number"
          value={formData.year_installed}
          onChange={(e) => setFormData({ ...formData, year_installed: e.target.value })}
          placeholder="Ej: 2020"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Select
          label="Estado Operativo"
          value={formData.operational_status}
          onChange={(e) => setFormData({ ...formData, operational_status: e.target.value })}
          options={Object.entries(OPERATIONAL_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <Select
          label="Estado Conservación"
          value={formData.conservation_status}
          onChange={(e) => setFormData({ ...formData, conservation_status: e.target.value })}
          options={Object.entries(CONSERVATION_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <Select
          label="Estado Contractual"
          value={formData.contractual_status}
          onChange={(e) => setFormData({ ...formData, contractual_status: e.target.value })}
          options={Object.entries(CONTRACTUAL_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
        />
      </div>

      <div className="border-t pt-4 mt-4">
        <h4 className="font-medium text-gray-700 mb-3">Asignaciones</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Responsable Autorizado"
            value={formData.responsible_user_id}
            onChange={(e) => setFormData({ ...formData, responsible_user_id: e.target.value })}
            options={responsibleUsers.map(u => ({ value: u.id, label: u.full_name }))}
            placeholder="Sin asignar"
          />
          <Input
            label="Empresa Conservadora"
            value={formData.conservation_company}
            onChange={(e) => setFormData({ ...formData, conservation_company: e.target.value })}
            placeholder="Nombre de la empresa"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Input
            label="Supervisor / Representante Técnico"
            value={formData.supervisor_name}
            onChange={(e) => setFormData({ ...formData, supervisor_name: e.target.value })}
            placeholder="Nombre del supervisor"
          />
          <Input
            label="Teléfono Supervisor"
            value={formData.supervisor_phone}
            onChange={(e) => setFormData({ ...formData, supervisor_phone: e.target.value })}
            placeholder="+54 299 XXX-XXXX"
          />
        </div>
      </div>

      {/* Destinatarios de informes - solo al editar */}
      {elevator && (
        <div className="border-t pt-4 mt-4">
          <RecipientsManager
            elevatorId={elevator.id}
            onClose={() => {}}
          />
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={loading}>
          {elevator ? 'Actualizar' : 'Crear Ascensor'}
        </Button>
      </div>
    </form>
  );
}
