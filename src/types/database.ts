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
  ai_generated_report?: string;
  supervisor_notes?: string;
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
  created_at: string;
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

export type BudgetStatus =
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
  status: BudgetStatus;
  valid_until?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}
