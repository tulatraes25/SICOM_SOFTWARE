import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import type { ElevatorWithTechnical } from '@/services/elevators.service';
import {
  EQUIPMENT_CATEGORY_LABELS,
  MOTRICITY_TYPE_LABELS,
  START_TYPE_LABELS,
  ELEVATOR_TYPE_LABELS,
  OPERATIONAL_STATUS_LABELS,
  CONSERVATION_STATUS_LABELS,
  CONTRACTUAL_STATUS_LABELS,
} from '@/types/elevators';

interface ElevatorTechnicalSheetProps {
  elevator: ElevatorWithTechnical;
}

interface TechnicalItem {
  label: string;
  value: unknown;
}

function relationName(relation: unknown): string | undefined {
  if (typeof relation === 'object' && relation !== null && 'name' in relation) {
    const name = (relation as Record<string, unknown>).name;
    if (typeof name === 'string' && name.trim()) return name;
  }
  return undefined;
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

function yesNo(value: boolean | undefined): string | undefined {
  if (value === true) return 'Sí';
  if (value === false) return 'No';
  return undefined;
}

function valueOrUndefined(value: unknown): string | undefined {
  if (!hasValue(value)) return undefined;
  return String(value);
}

function Section({ title, items }: { title: string; items: TechnicalItem[] }) {
  const visible = items.filter(item => hasValue(item.value));
  return (
    <Card>
      <CardHeader>
        <h4 className="font-semibold text-gray-900">{title}</h4>
      </CardHeader>
      <CardContent>
        {visible.length === 0 ? (
          <p className="text-sm text-gray-500">Sin información registrada.</p>
        ) : (
          <dl className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-4">
            {visible.map(item => (
              <div key={item.label}>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{item.label}</dt>
                <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{String(item.value)}</dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

export default function ElevatorTechnicalSheet({ elevator }: ElevatorTechnicalSheetProps) {
  const clientName = relationName(elevator.client);
  const buildingName = relationName(elevator.building);

  const equipmentCategory = elevator.equipment_category
    ? EQUIPMENT_CATEGORY_LABELS[elevator.equipment_category]
    : undefined;
  const motricity = elevator.motricity_type
    ? MOTRICITY_TYPE_LABELS[elevator.motricity_type]
    : undefined;
  const startType = elevator.start_type
    ? START_TYPE_LABELS[elevator.start_type]
    : undefined;
  const legacyType = elevator.elevator_type && elevator.elevator_type in ELEVATOR_TYPE_LABELS
    ? ELEVATOR_TYPE_LABELS[elevator.elevator_type as keyof typeof ELEVATOR_TYPE_LABELS]
    : elevator.elevator_type;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500">Ficha técnica del equipo</p>
          <h3 className="text-xl font-bold text-gray-900 font-mono">{elevator.code}</h3>
          <p className="text-sm text-gray-600">{[clientName, buildingName].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="default">{OPERATIONAL_STATUS_LABELS[elevator.operational_status as keyof typeof OPERATIONAL_STATUS_LABELS] || elevator.operational_status}</Badge>
          <Badge variant="default">{CONSERVATION_STATUS_LABELS[elevator.conservation_status as keyof typeof CONSERVATION_STATUS_LABELS] || elevator.conservation_status}</Badge>
        </div>
      </div>

      <Section
        title="1. Datos generales"
        items={[
          { label: 'Cliente', value: clientName },
          { label: 'Edificio', value: buildingName },
          { label: 'Número de obra', value: elevator.work_number },
          { label: 'Tipo de equipo', value: equipmentCategory },
          { label: 'Clasificación anterior', value: legacyType },
          { label: 'Número de serie', value: elevator.serial_number },
          { label: 'Fabricante', value: elevator.manufacturer },
          { label: 'Modelo', value: elevator.model },
          { label: 'Capacidad', value: elevator.capacity_kg ? `${elevator.capacity_kg} kg` : undefined },
          { label: 'Pisos / niveles', value: elevator.floors_served },
          { label: 'Cantidad de paradas', value: elevator.stops_count },
          { label: 'Año de instalación', value: elevator.year_installed },
          { label: 'Observaciones del tipo de equipo', value: elevator.equipment_category_notes },
        ]}
      />

      <Section
        title="2. Sistema de tracción y motricidad"
        items={[
          { label: 'Motricidad', value: motricity },
          { label: 'Fabricante máquina / unidad', value: elevator.traction_machine_manufacturer },
          { label: 'Modelo máquina / unidad', value: elevator.traction_machine_model },
          { label: 'Potencia motor', value: elevator.motor_power_hp ? `${elevator.motor_power_hp} HP` : undefined },
          { label: 'Relación de suspensión', value: elevator.suspension_ratio },
          { label: 'Tipo de arranque', value: startType },
          { label: 'Variador / arrancador', value: elevator.drive_controller },
          { label: 'Cantidad de cables', value: elevator.cable_count },
          { label: 'Longitud de cables', value: elevator.cable_length_m ? `${elevator.cable_length_m} m` : undefined },
          { label: 'Resistencia hidráulica', value: yesNo(elevator.hydraulic_resistance) },
          { label: 'Cuadro de válvulas', value: elevator.hydraulic_valve_block },
          { label: 'Pistón', value: elevator.hydraulic_piston },
          { label: 'Número de retén', value: elevator.hydraulic_seal_number },
        ]}
      />

      <Section
        title="3. Maniobra y cuadro de control"
        items={[
          { label: 'Control de maniobras', value: elevator.control_system_brand },
          { label: 'Placa principal', value: elevator.main_control_board },
          { label: 'Fuente de alimentación', value: elevator.control_power_supply },
          { label: 'Optoacoplador', value: elevator.control_optocoupler },
          { label: 'Rescate de emergencia', value: yesNo(elevator.emergency_rescue) },
          { label: 'Sistema de rescate', value: elevator.emergency_rescue_system },
        ]}
      />

      <Section
        title="4. Cabina y accesos"
        items={[
          { label: 'Fabricante de cabina', value: elevator.cabin_manufacturer },
          { label: 'Tipo de puerta', value: elevator.door_type },
          { label: 'Apertura de puerta', value: elevator.door_opening_mm ? `${elevator.door_opening_mm} mm` : undefined },
          { label: 'Operador de puerta', value: elevator.door_operator },
          { label: 'Barrera de seguridad', value: elevator.safety_barrier },
          { label: 'Estado de barrera', value: elevator.safety_barrier_status },
          { label: 'Observaciones de puertas', value: elevator.door_notes },
          { label: 'Observaciones de cabina / accesos', value: elevator.cabin_access_notes },
        ]}
      />

      <Section
        title="5. Estado y observaciones"
        items={[
          { label: 'Estado operativo', value: OPERATIONAL_STATUS_LABELS[elevator.operational_status as keyof typeof OPERATIONAL_STATUS_LABELS] || elevator.operational_status },
          { label: 'Estado de conservación', value: CONSERVATION_STATUS_LABELS[elevator.conservation_status as keyof typeof CONSERVATION_STATUS_LABELS] || elevator.conservation_status },
          { label: 'Estado contractual', value: CONTRACTUAL_STATUS_LABELS[elevator.contractual_status as keyof typeof CONTRACTUAL_STATUS_LABELS] || elevator.contractual_status },
          { label: 'Observaciones operativas', value: elevator.operational_notes },
          { label: 'Observaciones técnicas generales', value: elevator.technical_notes },
          { label: 'Notas generales', value: elevator.notes },
          { label: 'Última actualización técnica', value: elevator.technical_data_updated_at ? new Date(elevator.technical_data_updated_at).toLocaleString('es-AR') : undefined },
          { label: 'Empresa conservadora', value: elevator.conservation_company },
          { label: 'Supervisor / representante técnico', value: elevator.supervisor_name },
          { label: 'Teléfono supervisor', value: elevator.supervisor_phone },
        ]}
      />
    </div>
  );
}
