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

export type ElevatorType =
  | 'hidraulico'
  | 'electrico'
  | 'traccion'
  | 'sin_cabina'
  | 'otro';

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
