export const APP_NAME = 'SICOM QR Ascensores';
export const APP_DESCRIPTION = 'Sistema de trazabilidad y mantenimiento de ascensores';
export const COMPANY_NAME = 'SICOM Patagonia SRL';
export const COMPANY_SLOGAN = 'Mantenimiento, reparación, modernización y asistencia técnica de ascensores.';
export const COMPANY_WEBSITE = 'https://sicompatagonia.com/';
export const COMPANY_PHONE = '+54 297 421-4430';
export const COMPANY_EMAIL = 'info@sicompatagonia.com';
export const COMPANY_ADDRESS = 'Comodoro Rivadavia, Chubut, Argentina';

export const ROUTES = {
  // Públicos
  PUBLIC_ELEVATOR: '/s/ascensor/:token',

  // Auth
  LOGIN: '/login',

  // Admin
  ADMIN_DASHBOARD: '/admin',
  ADMIN_CLIENTS: '/admin/clientes',
  ADMIN_BUILDINGS: '/admin/edificios',
  ADMIN_ELEVATORS: '/admin/ascensores',
  ADMIN_USERS: '/admin/usuarios',
  ADMIN_SETTINGS: '/admin/configuracion',
  ADMIN_SERVICE_CASES: '/admin/expedientes',
  ADMIN_SERVICE_CASE_NEW: '/admin/expedientes/nuevo',
  ADMIN_SERVICE_CASE_DETAIL: '/admin/expedientes/:id',
  ADMIN_NUMBERING_CONFIG: '/admin/configuracion/numeracion',

  // Technician
  TECH_DASHBOARD: '/tecnico',
  TECH_SERVICE_REGISTER: '/tecnico/registrar-servicio',
  TECH_SERVICE_HISTORY: '/tecnico/historial',

  // Supervisor
  SUPERVISOR_DASHBOARD: '/supervisor',
  SUPERVISOR_REPORTS: '/supervisor/informes',
  SUPERVISOR_REPORT_DETAIL: '/supervisor/informes/:id',

  // Responsible
  RESPONSIBLE_DASHBOARD: '/responsable',
  RESPONSIBLE_HISTORY: '/responsable/historial',
} as const;

export const SERVICE_TYPE_LABELS: Record<string, string> = {
  preventivo: 'Preventivo',
  correctivo: 'Correctivo',
  emergencia: 'Emergencia',
  inspeccion: 'Inspección',
  instalacion: 'Instalación',
  otro: 'Otro',
};

export const SERVICE_STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  submitted: 'Enviado a revisión',
  in_review: 'En revisión',
  approved: 'Aprobado',
  rejected: 'Rechazado',
};

export const REPORT_STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  generated: 'Generado',
  reviewed: 'Revisado',
  approved: 'Aprobado',
  sent: 'Enviado',
};
