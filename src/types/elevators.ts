export type OperationalStatus =
  | 'operativo'
  | 'operativo_con_observaciones'
  | 'no_operativo'
  | 'fuera_de_servicio_preventivo'
  | 'fuera_de_servicio_por_reparacion';

export type ConservationStatus =
  | 'conforme'
  | 'observado'
  | 'requiere_reparacion'
  | 'fuera_de_servicio'
  | 'pendiente_de_verificacion';

export type ContractualStatus =
  | 'activo'
  | 'stand_by'
  | 'servicio_suspendido'
  | 'baja_definitiva';

// Legacy field preserved for backward compatibility.
export type ElevatorType =
  | 'hidraulico'
  | 'electrico'
  | 'traccion'
  | 'sin_cabina'
  | 'otro';

export type EquipmentCategory =
  | 'passenger_elevator'
  | 'freight_elevator'
  | 'passenger_freight_elevator'
  | 'stretcher_elevator'
  | 'vehicle_lift'
  | 'stairlift'
  | 'escalator'
  | 'other';

export type MotricityType =
  | 'electromechanical'
  | 'hydraulic'
  | 'pneumatic'
  | 'other';

export type StartType =
  | 'direct'
  | 'star_delta'
  | 'softstarter'
  | 'frequency_drive'
  | 'other';

export interface ElevatorTechnicalFields {
  work_number?: string;
  equipment_category?: EquipmentCategory;
  equipment_category_notes?: string;
  stops_count?: number;
  door_type?: string;
  door_opening_mm?: number;
  door_notes?: string;
  operational_notes?: string;
  motricity_type?: MotricityType;
  traction_machine_manufacturer?: string;
  traction_machine_model?: string;
  motor_power_hp?: number;
  suspension_ratio?: string;
  start_type?: StartType;
  drive_controller?: string;
  cable_count?: number;
  cable_length_m?: number;
  hydraulic_resistance?: boolean;
  hydraulic_valve_block?: string;
  hydraulic_piston?: string;
  hydraulic_seal_number?: string;
  control_system_brand?: string;
  main_control_board?: string;
  control_power_supply?: string;
  control_optocoupler?: string;
  emergency_rescue?: boolean;
  emergency_rescue_system?: string;
  cabin_manufacturer?: string;
  door_operator?: string;
  safety_barrier?: string;
  safety_barrier_status?: string;
  cabin_access_notes?: string;
  technical_notes?: string;
  technical_data_updated_at?: string;
  technical_data_updated_by?: string;
}

export const OPERATIONAL_STATUS_LABELS: Record<OperationalStatus, string> = {
  operativo: 'Operativo',
  operativo_con_observaciones: 'Operativo con Observaciones',
  no_operativo: 'No Operativo',
  fuera_de_servicio_preventivo: 'Fuera de Servicio (Preventivo)',
  fuera_de_servicio_por_reparacion: 'Fuera de Servicio (Reparación)',
};

export const CONSERVATION_STATUS_LABELS: Record<ConservationStatus, string> = {
  conforme: 'Conforme',
  observado: 'Observado',
  requiere_reparacion: 'Requiere Reparación',
  fuera_de_servicio: 'Fuera de Servicio',
  pendiente_de_verificacion: 'Pendiente de Verificación',
};

export const CONTRACTUAL_STATUS_LABELS: Record<ContractualStatus, string> = {
  activo: 'Activo',
  stand_by: 'Stand By',
  servicio_suspendido: 'Servicio Suspendido',
  baja_definitiva: 'Baja Definitiva',
};

export const ELEVATOR_TYPE_LABELS: Record<ElevatorType, string> = {
  hidraulico: 'Hidráulico',
  electrico: 'Eléctrico',
  traccion: 'Tracción',
  sin_cabina: 'Sin Cabina',
  otro: 'Otro',
};

export const EQUIPMENT_CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  passenger_elevator: 'Ascensor de pasajeros',
  freight_elevator: 'Montacargas',
  passenger_freight_elevator: 'Ascensor montacargas',
  stretcher_elevator: 'Ascensor camillero',
  vehicle_lift: 'Montavehículo',
  stairlift: 'Salvaescaleras',
  escalator: 'Escalera mecánica',
  other: 'Otro',
};

export const MOTRICITY_TYPE_LABELS: Record<MotricityType, string> = {
  electromechanical: 'Electromecánico',
  hydraulic: 'Hidráulico',
  pneumatic: 'Neumático',
  other: 'Otro',
};

export const START_TYPE_LABELS: Record<StartType, string> = {
  direct: 'Directo',
  star_delta: 'Estrella-triángulo',
  softstarter: 'Soft Starter',
  frequency_drive: 'Variador de frecuencia',
  other: 'Otro',
};

export const STATUS_COLORS: Record<string, string> = {
  operativo: 'bg-success/15 text-success border-success/30',
  operativo_con_observaciones: 'bg-warning/15 text-warning border-warning/30',
  no_operativo: 'bg-danger/15 text-danger border-danger/30',
  fuera_de_servicio_preventivo: 'bg-info/15 text-info border-info/30',
  fuera_de_servicio_por_reparacion: 'bg-danger/15 text-danger border-danger/30',
  conforme: 'bg-success/15 text-success border-success/30',
  observado: 'bg-warning/15 text-warning border-warning/30',
  requiere_reparacion: 'bg-danger/15 text-danger border-danger/30',
  fuera_de_servicio: 'bg-danger/15 text-danger border-danger/30',
  pendiente_de_verificacion: 'bg-info/15 text-info border-info/30',
  activo: 'bg-success/15 text-success border-success/30',
  stand_by: 'bg-warning/15 text-warning border-warning/30',
  servicio_suspendido: 'bg-danger/15 text-danger border-danger/30',
  baja_definitiva: 'bg-gray-500/15 text-gray-500 border-gray-500/30',
};
