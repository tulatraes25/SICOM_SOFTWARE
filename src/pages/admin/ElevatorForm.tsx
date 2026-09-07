import { useState, useEffect } from 'react';
import { listClients } from '@/services/clients.service';
import { getBuildingsByClient } from '@/services/buildings.service';
import { createElevator, updateElevator } from '@/services/elevators.service';
import type { ElevatorWithTechnical } from '@/services/elevators.service';
import { createAuditLog } from '@/services/audit.service';
import RecipientsManager from './RecipientsManager';
import {
  OPERATIONAL_STATUS_LABELS,
  CONSERVATION_STATUS_LABELS,
  CONTRACTUAL_STATUS_LABELS,
  ELEVATOR_TYPE_LABELS,
  EQUIPMENT_CATEGORY_LABELS,
  MOTRICITY_TYPE_LABELS,
  START_TYPE_LABELS,
} from '@/types/elevators';
import type { Client, Building } from '@/types/database';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';

interface ElevatorFormProps {
  elevator?: ElevatorWithTechnical | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const BOOL_OPTIONS = [
  { value: 'true', label: 'Sí' },
  { value: 'false', label: 'No' },
];

function boolToForm(value?: boolean): string {
  if (value === true) return 'true';
  if (value === false) return 'false';
  return '';
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h4 className="font-semibold text-gray-800">{title}</h4>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </section>
  );
}

export default function ElevatorForm({ elevator, onSuccess, onCancel }: ElevatorFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
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
    conservation_company: '',
    supervisor_name: '',
    supervisor_phone: '',
    notes: '',
    active: true,
    work_number: '',
    equipment_category: '',
    equipment_category_notes: '',
    stops_count: '',
    door_type: '',
    door_opening_mm: '',
    door_notes: '',
    operational_notes: '',
    motricity_type: '',
    traction_machine_manufacturer: '',
    traction_machine_model: '',
    motor_power_hp: '',
    suspension_ratio: '',
    start_type: '',
    drive_controller: '',
    cable_count: '',
    cable_length_m: '',
    hydraulic_resistance: '',
    hydraulic_valve_block: '',
    hydraulic_piston: '',
    hydraulic_seal_number: '',
    control_system_brand: '',
    main_control_board: '',
    control_power_supply: '',
    control_optocoupler: '',
    emergency_rescue: '',
    emergency_rescue_system: '',
    cabin_manufacturer: '',
    door_operator: '',
    safety_barrier: '',
    safety_barrier_status: '',
    cabin_access_notes: '',
    technical_notes: '',
  });

  const setField = (field: keyof typeof formData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

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
        conservation_company: elevator.conservation_company || '',
        supervisor_name: elevator.supervisor_name || '',
        supervisor_phone: elevator.supervisor_phone || '',
        notes: elevator.notes || '',
        active: elevator.active ?? true,
        work_number: elevator.work_number || '',
        equipment_category: elevator.equipment_category || '',
        equipment_category_notes: elevator.equipment_category_notes || '',
        stops_count: elevator.stops_count?.toString() || '',
        door_type: elevator.door_type || '',
        door_opening_mm: elevator.door_opening_mm?.toString() || '',
        door_notes: elevator.door_notes || '',
        operational_notes: elevator.operational_notes || '',
        motricity_type: elevator.motricity_type || '',
        traction_machine_manufacturer: elevator.traction_machine_manufacturer || '',
        traction_machine_model: elevator.traction_machine_model || '',
        motor_power_hp: elevator.motor_power_hp?.toString() || '',
        suspension_ratio: elevator.suspension_ratio || '',
        start_type: elevator.start_type || '',
        drive_controller: elevator.drive_controller || '',
        cable_count: elevator.cable_count?.toString() || '',
        cable_length_m: elevator.cable_length_m?.toString() || '',
        hydraulic_resistance: boolToForm(elevator.hydraulic_resistance),
        hydraulic_valve_block: elevator.hydraulic_valve_block || '',
        hydraulic_piston: elevator.hydraulic_piston || '',
        hydraulic_seal_number: elevator.hydraulic_seal_number || '',
        control_system_brand: elevator.control_system_brand || '',
        main_control_board: elevator.main_control_board || '',
        control_power_supply: elevator.control_power_supply || '',
        control_optocoupler: elevator.control_optocoupler || '',
        emergency_rescue: boolToForm(elevator.emergency_rescue),
        emergency_rescue_system: elevator.emergency_rescue_system || '',
        cabin_manufacturer: elevator.cabin_manufacturer || '',
        door_operator: elevator.door_operator || '',
        safety_barrier: elevator.safety_barrier || '',
        safety_barrier_status: elevator.safety_barrier_status || '',
        cabin_access_notes: elevator.cabin_access_notes || '',
        technical_notes: elevator.technical_notes || '',
      });
    }
  }, [elevator]);

  const loadInitialData = async () => {
    try {
      const clientsData = await listClients();
      setClients(clientsData.filter(c => c.active));
    } catch (err) {
      console.error('Error loading clients:', err);
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
    setFormData(prev => ({ ...prev, client_id: clientId, building_id: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const elevatorData = {
        code: formData.code.trim(),
        client_id: formData.client_id,
        building_id: formData.building_id,
        elevator_type: formData.elevator_type || undefined,
        serial_number: formData.serial_number.trim() || undefined,
        manufacturer: formData.manufacturer.trim() || undefined,
        model: formData.model.trim() || undefined,
        capacity_kg: formData.capacity_kg ? parseInt(formData.capacity_kg, 10) : undefined,
        floors_served: formData.floors_served.trim() || undefined,
        year_installed: formData.year_installed ? parseInt(formData.year_installed, 10) : undefined,
        operational_status: formData.operational_status,
        conservation_status: formData.conservation_status,
        contractual_status: formData.contractual_status,
        conservation_company: formData.conservation_company.trim() || undefined,
        supervisor_name: formData.supervisor_name.trim() || undefined,
        supervisor_phone: formData.supervisor_phone.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        active: formData.active,
        work_number: formData.work_number.trim() || undefined,
        equipment_category: formData.equipment_category || undefined,
        equipment_category_notes: formData.equipment_category_notes.trim() || undefined,
        stops_count: formData.stops_count ? parseInt(formData.stops_count, 10) : undefined,
        door_type: formData.door_type.trim() || undefined,
        door_opening_mm: formData.door_opening_mm ? parseInt(formData.door_opening_mm, 10) : undefined,
        door_notes: formData.door_notes.trim() || undefined,
        operational_notes: formData.operational_notes.trim() || undefined,
        motricity_type: formData.motricity_type || undefined,
        traction_machine_manufacturer: formData.traction_machine_manufacturer.trim() || undefined,
        traction_machine_model: formData.traction_machine_model.trim() || undefined,
        motor_power_hp: formData.motor_power_hp ? parseFloat(formData.motor_power_hp) : undefined,
        suspension_ratio: formData.suspension_ratio.trim() || undefined,
        start_type: formData.start_type || undefined,
        drive_controller: formData.drive_controller.trim() || undefined,
        cable_count: formData.cable_count ? parseInt(formData.cable_count, 10) : undefined,
        cable_length_m: formData.cable_length_m ? parseFloat(formData.cable_length_m) : undefined,
        hydraulic_resistance: formData.hydraulic_resistance === '' ? undefined : formData.hydraulic_resistance === 'true',
        hydraulic_valve_block: formData.hydraulic_valve_block.trim() || undefined,
        hydraulic_piston: formData.hydraulic_piston.trim() || undefined,
        hydraulic_seal_number: formData.hydraulic_seal_number.trim() || undefined,
        control_system_brand: formData.control_system_brand.trim() || undefined,
        main_control_board: formData.main_control_board.trim() || undefined,
        control_power_supply: formData.control_power_supply.trim() || undefined,
        control_optocoupler: formData.control_optocoupler.trim() || undefined,
        emergency_rescue: formData.emergency_rescue === '' ? undefined : formData.emergency_rescue === 'true',
        emergency_rescue_system: formData.emergency_rescue_system.trim() || undefined,
        cabin_manufacturer: formData.cabin_manufacturer.trim() || undefined,
        door_operator: formData.door_operator.trim() || undefined,
        safety_barrier: formData.safety_barrier.trim() || undefined,
        safety_barrier_status: formData.safety_barrier_status.trim() || undefined,
        cabin_access_notes: formData.cabin_access_notes.trim() || undefined,
        technical_notes: formData.technical_notes.trim() || undefined,
      };

      if (elevator) {
        await updateElevator(elevator.id, elevatorData);
        await createAuditLog({
          action: 'update',
          entity_type: 'elevator',
          entity_id: elevator.id,
          old_data: elevator as unknown as Record<string, unknown>,
          new_data: elevatorData as unknown as Record<string, unknown>,
        });
      } else {
        const newElevator = await createElevator(elevatorData);
        await createAuditLog({
          action: 'create',
          entity_type: 'elevator',
          entity_id: newElevator.id,
          new_data: elevatorData as unknown as Record<string, unknown>,
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

      <Section title="1. Identificación">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <Input label="Código *" value={formData.code} onChange={(e) => setField('code', e.target.value)} required placeholder="Ej: ASC-0001" />
          <Select label="Cliente *" value={selectedClientId} onChange={(e) => handleClientChange(e.target.value)} options={clients.map(c => ({ value: c.id, label: c.name }))} placeholder="Seleccionar cliente" required />
          <Select label="Edificio *" value={formData.building_id} onChange={(e) => setField('building_id', e.target.value)} options={buildings.map(b => ({ value: b.id, label: b.name }))} placeholder={selectedClientId ? 'Seleccionar edificio' : 'Primero seleccione un cliente'} required disabled={!selectedClientId} />
          <Input label="Número de Obra" value={formData.work_number} onChange={(e) => setField('work_number', e.target.value)} placeholder="Ej: 7055" />
          <div>
            <Input label="Número de Serie" value={formData.serial_number} onChange={(e) => setField('serial_number', e.target.value)} placeholder="Si está disponible" />
            <p className="text-xs text-gray-500 mt-1">Número identificatorio asignado por el fabricante, si se encuentra disponible.</p>
          </div>
          <Select label="Clasificación anterior (legado)" value={formData.elevator_type} onChange={(e) => setField('elevator_type', e.target.value)} options={Object.entries(ELEVATOR_TYPE_LABELS).map(([value, label]) => ({ value, label }))} placeholder="Sin informar" />
          <Input label="Fabricante" value={formData.manufacturer} onChange={(e) => setField('manufacturer', e.target.value)} placeholder="Ej: Otis, Schindler" />
          <Input label="Modelo" value={formData.model} onChange={(e) => setField('model', e.target.value)} placeholder="Modelo" />
          <Input label="Capacidad (kg)" type="number" value={formData.capacity_kg} onChange={(e) => setField('capacity_kg', e.target.value)} placeholder="Ej: 630" />
          <Input label="Pisos / niveles servidos" value={formData.floors_served} onChange={(e) => setField('floors_served', e.target.value)} placeholder="Ej: PB, 1, 2, 3" />
          <Input label="Año de Instalación" type="number" value={formData.year_installed} onChange={(e) => setField('year_installed', e.target.value)} placeholder="Ej: 2020" />
        </div>
      </Section>

      <Section title="2. Clasificación general">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <Select label="Tipo de equipo" value={formData.equipment_category} onChange={(e) => setField('equipment_category', e.target.value)} options={Object.entries(EQUIPMENT_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))} placeholder="Seleccionar" />
          <Input label="Cantidad de paradas" type="number" min="0" value={formData.stops_count} onChange={(e) => setField('stops_count', e.target.value)} placeholder="Ej: 2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones del tipo de equipo</label>
          <textarea value={formData.equipment_category_notes} onChange={(e) => setField('equipment_category_notes', e.target.value)} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y focus:ring-2 focus:ring-secondary focus:border-transparent" placeholder="Ej: cuenta con grupo electrógeno" />
        </div>
      </Section>

      <Section title="3. Motricidad y tracción">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <Select label="Motricidad" value={formData.motricity_type} onChange={(e) => setField('motricity_type', e.target.value)} options={Object.entries(MOTRICITY_TYPE_LABELS).map(([value, label]) => ({ value, label }))} placeholder="Seleccionar" />
          <Input label="Fabricante máquina / unidad" value={formData.traction_machine_manufacturer} onChange={(e) => setField('traction_machine_manufacturer', e.target.value)} placeholder="Fabricante" />
          <Input label="Modelo máquina / unidad" value={formData.traction_machine_model} onChange={(e) => setField('traction_machine_model', e.target.value)} placeholder="Modelo" />
          <Input label="Potencia motor (HP)" type="number" min="0" step="0.01" value={formData.motor_power_hp} onChange={(e) => setField('motor_power_hp', e.target.value)} placeholder="Ej: 10.5" />
          <Input label="Relación de suspensión" value={formData.suspension_ratio} onChange={(e) => setField('suspension_ratio', e.target.value)} placeholder="Ej: 2 a 1" />
          <Select label="Tipo de arranque" value={formData.start_type} onChange={(e) => setField('start_type', e.target.value)} options={Object.entries(START_TYPE_LABELS).map(([value, label]) => ({ value, label }))} placeholder="Seleccionar" />
          <Input label="Variador / arrancador" value={formData.drive_controller} onChange={(e) => setField('drive_controller', e.target.value)} placeholder="Marca / modelo si corresponde" />
        </div>

        {formData.motricity_type === 'electromechanical' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <Input label="Cantidad de cables" type="number" min="1" value={formData.cable_count} onChange={(e) => setField('cable_count', e.target.value)} />
            <Input label="Longitud de cables (m)" type="number" min="0" step="0.01" value={formData.cable_length_m} onChange={(e) => setField('cable_length_m', e.target.value)} />
          </div>
        )}

        {formData.motricity_type === 'hydraulic' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <Select label="Resistencia" value={formData.hydraulic_resistance} onChange={(e) => setField('hydraulic_resistance', e.target.value)} options={BOOL_OPTIONS} placeholder="Sin informar" />
            <Input label="Cuadro de válvulas" value={formData.hydraulic_valve_block} onChange={(e) => setField('hydraulic_valve_block', e.target.value)} placeholder="Ej: Blain EV10" />
            <Input label="Pistón" value={formData.hydraulic_piston} onChange={(e) => setField('hydraulic_piston', e.target.value)} />
            <Input label="Número de retén" value={formData.hydraulic_seal_number} onChange={(e) => setField('hydraulic_seal_number', e.target.value)} placeholder="Si está disponible" />
          </div>
        )}
      </Section>

      <Section title="4. Maniobra y cuadro de control">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <Input label="Control de maniobras" value={formData.control_system_brand} onChange={(e) => setField('control_system_brand', e.target.value)} placeholder="Ej: Cóndor" />
          <Input label="Placa principal" value={formData.main_control_board} onChange={(e) => setField('main_control_board', e.target.value)} placeholder="Ej: Wilcox HR30" />
          <Input label="Fuente de alimentación" value={formData.control_power_supply} onChange={(e) => setField('control_power_supply', e.target.value)} />
          <Input label="Optoacoplador" value={formData.control_optocoupler} onChange={(e) => setField('control_optocoupler', e.target.value)} />
          <Select label="Rescate de emergencia" value={formData.emergency_rescue} onChange={(e) => setField('emergency_rescue', e.target.value)} options={BOOL_OPTIONS} placeholder="Sin informar" />
          {formData.emergency_rescue === 'true' && (
            <Input label="Sistema de rescate / emergencia" value={formData.emergency_rescue_system} onChange={(e) => setField('emergency_rescue_system', e.target.value)} placeholder="Ej: UPS" />
          )}
        </div>
      </Section>

      <Section title="5. Cabina y accesos">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <Input label="Fabricante de cabina" value={formData.cabin_manufacturer} onChange={(e) => setField('cabin_manufacturer', e.target.value)} placeholder="Ej: Cóndor" />
          <Input label="Tipo de puerta" value={formData.door_type} onChange={(e) => setField('door_type', e.target.value)} placeholder="Ej: Automática" />
          <Input label="Apertura de puerta (mm)" type="number" min="1" value={formData.door_opening_mm} onChange={(e) => setField('door_opening_mm', e.target.value)} placeholder="Ej: 1000" />
          <Input label="Operador de puerta" value={formData.door_operator} onChange={(e) => setField('door_operator', e.target.value)} placeholder="Ej: Fermator VVF5" />
          <Input label="Barrera de seguridad" value={formData.safety_barrier} onChange={(e) => setField('safety_barrier', e.target.value)} placeholder="Ej: WECO" />
          <Input label="Estado de barrera" value={formData.safety_barrier_status} onChange={(e) => setField('safety_barrier_status', e.target.value)} placeholder="Ej: OK" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones de puertas</label>
            <textarea value={formData.door_notes} onChange={(e) => setField('door_notes', e.target.value)} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y focus:ring-2 focus:ring-secondary focus:border-transparent" placeholder="Ej: doble acceso" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones de cabina / accesos</label>
            <textarea value={formData.cabin_access_notes} onChange={(e) => setField('cabin_access_notes', e.target.value)} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y focus:ring-2 focus:ring-secondary focus:border-transparent" />
          </div>
        </div>
      </Section>

      <Section title="6. Estado y observaciones">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select label="Estado Operativo" value={formData.operational_status} onChange={(e) => setField('operational_status', e.target.value)} options={Object.entries(OPERATIONAL_STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
          <Select label="Estado Conservación" value={formData.conservation_status} onChange={(e) => setField('conservation_status', e.target.value)} options={Object.entries(CONSERVATION_STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
          <Select label="Estado Contractual" value={formData.contractual_status} onChange={(e) => setField('contractual_status', e.target.value)} options={Object.entries(CONTRACTUAL_STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones del estado operativo</label>
            <textarea value={formData.operational_notes} onChange={(e) => setField('operational_notes', e.target.value)} rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y focus:ring-2 focus:ring-secondary focus:border-transparent" placeholder="Situación operativa actual del equipo" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones técnicas generales</label>
            <textarea value={formData.technical_notes} onChange={(e) => setField('technical_notes', e.target.value)} rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y focus:ring-2 focus:ring-secondary focus:border-transparent" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notas generales existentes</label>
          <textarea value={formData.notes} onChange={(e) => setField('notes', e.target.value)} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y focus:ring-2 focus:ring-secondary focus:border-transparent" />
        </div>
      </Section>

      <Section title="7. Asignaciones">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado del responsable</label>
            {elevator?.responsible_user_id ? (
              <div className="space-y-2">
                <Badge variant="success">Asignado</Badge>
                <p className="text-sm text-gray-500">Este ascensor tiene un responsable asignado. Para modificarlo, utilizá Usuarios → Responsables de edificios.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Badge variant="default">Sin asignar</Badge>
                <p className="text-sm text-gray-500">El responsable se asigna después de crear el ascensor desde Usuarios → Responsables de edificios.</p>
              </div>
            )}
          </div>
          <Input label="Empresa Conservadora" value={formData.conservation_company} onChange={(e) => setField('conservation_company', e.target.value)} placeholder="Nombre de la empresa" />
          <Input label="Supervisor / Representante Técnico" value={formData.supervisor_name} onChange={(e) => setField('supervisor_name', e.target.value)} placeholder="Nombre del supervisor" />
          <Input label="Teléfono Supervisor" value={formData.supervisor_phone} onChange={(e) => setField('supervisor_phone', e.target.value)} placeholder="+54 299 XXX-XXXX" />
        </div>
      </Section>

      {elevator && (
        <Section title="8. Destinatarios">
          <RecipientsManager elevatorId={elevator.id} onClose={() => {}} />
        </Section>
      )}

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" loading={loading}>{elevator ? 'Actualizar' : 'Crear Ascensor'}</Button>
      </div>
    </form>
  );
}
