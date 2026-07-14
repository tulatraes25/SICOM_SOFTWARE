export type {
  OperationalStatus,
  ConservationStatus,
  ContractualStatus,
  ElevatorType,
} from './elevators';

export type {
  UserRole,
  Profile,
  User,
} from './roles';

import type { Profile } from './roles';

export interface Client {
  id: string;
  code: string;
  name: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  locality?: string;
  province?: string;
  tax_id?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Building {
  id: string;
  client_id: string;
  code: string;
  name: string;
  address: string;
  locality: string;
  province: string;
  latitude?: number;
  longitude?: number;
  active: boolean;
  created_at: string;
  updated_at: string;
  client?: Client;
}

export interface Elevator {
  id: string;
  code: string;
  qr_token: string;
  building_id: string;
  client_id: string;
  serial_number?: string;
  manufacturer?: string;
  model?: string;
  elevator_type?: string;
  capacity_kg?: number;
  floors_served?: string;
  year_installed?: number;
  operational_status: string;
  conservation_status: string;
  contractual_status: string;
  responsible_user_id?: string;
  conservation_company?: string;
  supervisor_name?: string;
  supervisor_phone?: string;
  building_contact_name?: string;
  building_contact_phone?: string;
  building_access_code?: string;
  last_service_date?: string;
  next_service_date?: string;
  notes?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  building?: Building;
  client?: Client;
}

export interface ReportRecipient {
  id: string;
  elevator_id: string;
  name: string;
  email: string;
  role?: string;
  active: boolean;
  created_at: string;
}

export type ServiceType =
  | 'preventivo'
  | 'correctivo'
  | 'emergencia'
  | 'inspeccion'
  | 'instalacion'
  | 'otro';

export type ServiceRecordStatus =
  | 'draft'
  | 'submitted'
  | 'in_review'
  | 'approved'
  | 'rejected';

export interface ServiceRecord {
  id: string;
  elevator_id: string;
  technician_id: string;
  service_date: string;
  service_time?: string;
  service_type: ServiceType;
  status: ServiceRecordStatus;
  description?: string;
  technical_report?: string;
  observations?: string;
  operational_status_at_service?: string;
  conservation_status_at_service?: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  ai_report_draft?: string;
  final_report_text?: string;
  created_at: string;
  updated_at: string;
  elevator?: Elevator;
  technician?: Profile;
}

export interface ServiceChecklistItem {
  id: string;
  service_record_id: string;
  item_name: string;
  status: 'ok' | 'needs_attention' | 'failed' | 'na';
  notes?: string;
  created_at: string;
}

export interface ServicePhoto {
  id: string;
  service_record_id: string;
  storage_path: string;
  photo_type: 'before' | 'after' | 'general';
  caption?: string;
  include_in_report: boolean;
  report_order: number;
  created_at: string;
  signedUrl?: string;
}

export type MonthlyReportStatus =
  | 'draft'
  | 'generated'
  | 'reviewed'
  | 'approved'
  | 'sent';

export interface MonthlyReport {
  id: string;
  elevator_id: string;
  period: string;
  title?: string;
  content?: string;
  summary?: string;
  status: MonthlyReportStatus;
  created_by?: string;
  reviewed_by?: string;
  approved_by?: string;
  approved_at?: string;
  pdf_url?: string;
  pdf_storage_path?: string;
  pdf_generated_at?: string;
  sent_at?: string;
  services_count: number;
  created_at: string;
  updated_at: string;
  elevator?: Elevator;
}

export type ReportSendStatus = 'pending' | 'sent' | 'failed' | 'bounced';

export interface ReportSend {
  id: string;
  monthly_report_id: string;
  recipient_id?: string;
  recipient_name: string;
  recipient_email: string;
  status: ReportSendStatus;
  sent_at?: string;
  error_message?: string;
  resend_id?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  old_data?: Record<string, unknown>;
  new_data?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  user?: Profile;
}

export type BudgetEstimateStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'in_progress'
  | 'completed';

export interface BudgetEstimate {
  id: string;
  elevator_id?: string;
  client_id?: string;
  description: string;
  amount?: number;
  currency: string;
  status: BudgetEstimateStatus;
  valid_until?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Service Cases (Expediente Maestro)
// ============================================================

export type CaseOriginType = 'budget' | 'claim' | 'direct_report' | 'scheduled_service' | 'other';
export type CaseStatus = 'open' | 'assigned' | 'in_progress' | 'completed' | 'closed' | 'cancelled';
export type NumberingMode = 'test' | 'production';

export interface ServiceCase {
  id: string;
  case_number: number;
  numbering_mode: NumberingMode;
  origin_type: CaseOriginType;
  status: CaseStatus;
  client_id?: string;
  building_id?: string;
  elevator_id?: string;
  title?: string;
  description?: string;
  created_by: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  // Relations
  client?: Client;
  building?: Building;
  elevator?: Elevator;
  assigned_user?: Profile;
  created_user?: Profile;
}

export interface ServiceCaseEvent {
  id: string;
  service_case_id: string;
  event_type: 'case_created' | 'assigned' | 'closed' | 'cancelled' | 'production_numbering_activated';
  performed_by?: string;
  details: Record<string, unknown>;
  created_at: string;
  performer?: Profile;
}

export interface DocumentNumberingSettings {
  current_mode: NumberingMode;
  next_test_number: number;
  next_production_number: number;
  production_activated_at?: string;
}

export const CASE_ORIGIN_LABELS: Record<CaseOriginType, string> = {
  budget: 'Presupuesto',
  claim: 'Reclamo',
  direct_report: 'Informe directo',
  scheduled_service: 'Servicio programado',
  other: 'Otro',
};

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  open: 'Abierto',
  assigned: 'Asignado',
  in_progress: 'En curso',
  completed: 'Completado',
  closed: 'Cerrado',
  cancelled: 'Anulado',
};

// ============================================================
// Elevator Visit Book (Libro Digital de Visitas)
// ============================================================

export type VisitEntryType =
  | 'scheduled_service'
  | 'preventive_maintenance'
  | 'corrective_maintenance'
  | 'claim_visit'
  | 'inspection'
  | 'emergency'
  | 'verification'
  | 'other';

export type VisitEntryStatus = 'draft' | 'submitted' | 'approved' | 'rectified' | 'cancelled';

export interface ElevatorVisitEntry {
  id: string;
  elevator_id: string;
  service_case_id?: string;
  service_record_id?: string;
  entry_number: number;
  visit_date: string;
  registered_at: string;
  entry_type: VisitEntryType;
  origin_type?: string;
  title?: string;
  description: string;
  work_performed?: string;
  observations?: string;
  recommendations?: string;
  operational_status?: string;
  conservation_status?: string;
  technician_id?: string;
  registered_by: string;
  reviewed_by?: string;
  reviewed_at?: string;
  status: VisitEntryStatus;
  is_rectification: boolean;
  rectifies_entry_id?: string;
  cancellation_reason?: string;
  technician_signature_id?: string;
  reviewer_signature_id?: string;
  created_at: string;
  updated_at: string;
  // Relations
  elevator?: Elevator;
  technician?: Profile;
  registered_user?: Profile;
  reviewer?: Profile;
  service_case?: ServiceCase;
  service_record?: ServiceRecord;
  rectified_entry?: ElevatorVisitEntry;
}

export const VISIT_ENTRY_TYPE_LABELS: Record<VisitEntryType, string> = {
  scheduled_service: 'Servicio programado',
  preventive_maintenance: 'Mantenimiento preventivo',
  corrective_maintenance: 'Mantenimiento correctivo',
  claim_visit: 'Visita por reclamo',
  inspection: 'Inspección',
  emergency: 'Emergencia',
  verification: 'Verificación',
  other: 'Otro',
};

export const VISIT_ENTRY_STATUS_LABELS: Record<VisitEntryStatus, string> = {
  draft: 'Borrador',
  submitted: 'Enviado',
  approved: 'Aprobado',
  rectified: 'Rectificado',
  cancelled: 'Anulado',
};

// ============================================================
// Document Branding & Signatures
// ============================================================

export interface CompanyDocumentSettings {
  company_name: string;
  legal_name?: string;
  tax_id?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  logo_path?: string;
  header_text?: string;
  footer_text?: string;
  primary_color?: string;
  secondary_color?: string;
}

export type SignatureType = 'technician' | 'administrator' | 'supervisor' | 'representative';

export interface UserSignature {
  id: string;
  user_id: string;
  signature_type: SignatureType;
  storage_path: string;
  original_filename?: string;
  mime_type: string;
  file_size?: number;
  is_active: boolean;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
  revoked_at?: string;
  revoked_by?: string;
  signedUrl?: string;
}

export type DocumentSignatureType =
  | 'service_report'
  | 'budget'
  | 'service_order'
  | 'visit_entry'
  | 'visit_history'
  | 'external_invoice_delivery'
  | 'other';

export interface DocumentSignature {
  id: string;
  document_type: DocumentSignatureType;
  document_id: string;
  service_case_id?: string;
  signer_user_id: string;
  signer_role: string;
  signature_id?: string;
  signature_storage_path?: string;
  signer_name_snapshot: string;
  signed_at: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  signer?: Profile;
  signature?: UserSignature;
}

export const SIGNATURE_TYPE_LABELS: Record<SignatureType, string> = {
  technician: 'Técnico',
  administrator: 'Administrador',
  supervisor: 'Supervisor',
  representative: 'Representante',
};

export const DOC_SIGNATURE_TYPE_LABELS: Record<DocumentSignatureType, string> = {
  service_report: 'Informe técnico',
  budget: 'Presupuesto',
  service_order: 'Orden de servicio',
  visit_entry: 'Asiento del libro',
  visit_history: 'Historial del libro',
  external_invoice_delivery: 'Entrega de factura',
  other: 'Otro',
};

// ============================================================
// Budgets
// ============================================================

export type BudgetStatus = 'draft' | 'ready' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'cancelled';

export interface Budget {
  id: string;
  service_case_id: string;
  client_id: string;
  building_id?: string;
  elevator_id?: string;
  budget_date: string;
  valid_until?: string;
  subject: string;
  introduction?: string;
  notes?: string;
  payment_terms?: string;
  delivery_terms?: string;
  currency: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  status: BudgetStatus;
  created_by: string;
  approved_by?: string;
  approved_at?: string;
  sent_at?: string;
  accepted_at?: string;
  rejected_at?: string;
  expired_at?: string;
  cancellation_reason?: string;
  created_at: string;
  updated_at: string;
  // Relations
  service_case?: ServiceCase;
  client?: Client;
  building?: Building;
  elevator?: Elevator;
  created_user?: Profile;
  approved_user?: Profile;
  items?: BudgetItem[];
}

export interface BudgetItem {
  id: string;
  budget_id: string;
  item_order: number;
  description: string;
  quantity: number;
  unit?: string;
  unit_price: number;
  line_subtotal: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetEmailSend {
  id: string;
  budget_id: string;
  recipient_email: string;
  recipient_name?: string;
  subject: string;
  status: 'sent' | 'failed';
  provider_message_id?: string;
  error_message?: string;
  sent_by: string;
  sent_at: string;
  created_at: string;
  sender?: Profile;
}

export const BUDGET_STATUS_LABELS: Record<BudgetStatus, string> = {
  draft: 'Borrador',
  ready: 'Listo',
  sent: 'Enviado',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
  expired: 'Vencido',
  cancelled: 'Cancelado',
};
