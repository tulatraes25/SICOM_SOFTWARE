import { supabase } from '@/config/supabase';

// ============================================================
// Types (read-only, matching RPC return shapes)
// ============================================================

export interface ResponsibleElevator {
  id: string;
  code: string;
  building_id: string;
  manufacturer: string | null;
  model: string | null;
  elevator_type: string | null;
  capacity_kg: number | null;
  floors_served: string | null;
  year_installed: number | null;
  operational_status: string | null;
  conservation_status: string | null;
  contractual_status: string | null;
  last_service_date: string | null;
  next_service_date: string | null;
  active: boolean;
}

export interface ResponsibleClient {
  id: string;
  code: string;
  name: string;
}

export interface ResponsibleBuilding {
  id: string;
  code: string;
  name: string;
  address: string;
  locality: string;
  province: string | null;
}

export interface ResponsibleServiceRecord {
  id: string;
  elevator_id: string;
  technician_id: string;
  service_date: string;
  service_time: string | null;
  service_type: string;
  status: string;
  description: string | null;
  technical_report: string | null;
  observations: string | null;
  operational_status_at_service: string | null;
  conservation_status_at_service: string | null;
  approved_at: string | null;
  final_report_text: string | null;
}

export interface ResponsibleVisitEntry {
  id: string;
  elevator_id: string;
  service_case_id: string | null;
  service_record_id: string | null;
  service_order_id: string | null;
  entry_number: number;
  visit_date: string;
  entry_type: string;
  origin_type: string | null;
  title: string | null;
  description: string;
  work_performed: string | null;
  observations: string | null;
  recommendations: string | null;
  operational_status: string | null;
  conservation_status: string | null;
  technician_id: string | null;
  status: string;
  check_in_at: string | null;
  check_out_at: string | null;
  duration_minutes: number | null;
  duration_seconds: number | null;
}

export interface ResponsibleServiceOrder {
  id: string;
  elevator_id: string;
  subject: string;
  order_type: string;
  status: string;
  completion_summary: string | null;
  reviewed_at: string | null;
  service_case_id: string | null;
}

export interface ResponsibleMonthlyReport {
  id: string;
  elevator_id: string;
  period: string;
  title: string | null;
  status: string;
  general_status: string | null;
  services_count: number | null;
  report_month: number | null;
  report_year: number | null;
  pdf_generated_at: string | null;
  has_pdf: boolean;
}

export interface ResponsibleTechnician {
  id: string;
  full_name: string;
}

// ============================================================
// Service functions
// ============================================================

async function rpc<T>(fn: string, params?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, params || {});
  if (error) throw new Error(`Error al cargar datos: ${error.message}`);
  return data as T;
}

export async function getResponsibleElevators(buildingId?: string): Promise<ResponsibleElevator[]> {
  return rpc<ResponsibleElevator[]>('get_responsible_elevators', { p_building_id: buildingId || null });
}

export async function getResponsibleClients(): Promise<ResponsibleClient[]> {
  return rpc<ResponsibleClient[]>('get_responsible_clients');
}

export async function getResponsibleBuildings(): Promise<ResponsibleBuilding[]> {
  const { data, error } = await supabase
    .from('buildings')
    .select('id, code, name, address, locality, province')
    .order('name');
  if (error) throw new Error(`Error al cargar edificios: ${error.message}`);
  return data || [];
}

export async function getResponsibleServiceRecords(elevatorId?: string): Promise<ResponsibleServiceRecord[]> {
  return rpc<ResponsibleServiceRecord[]>('get_responsible_service_records', { p_elevator_id: elevatorId || null });
}

export async function getResponsibleVisitEntries(
  elevatorId?: string, dateFrom?: string, dateTo?: string
): Promise<ResponsibleVisitEntry[]> {
  return rpc<ResponsibleVisitEntry[]>('get_responsible_visit_entries', {
    p_elevator_id: elevatorId || null,
    p_date_from: dateFrom || null,
    p_date_to: dateTo || null,
  });
}

export async function getResponsibleServiceOrders(elevatorId?: string): Promise<ResponsibleServiceOrder[]> {
  return rpc<ResponsibleServiceOrder[]>('get_responsible_service_orders', { p_elevator_id: elevatorId || null });
}

export async function getResponsibleMonthlyReports(elevatorId?: string): Promise<ResponsibleMonthlyReport[]> {
  return rpc<ResponsibleMonthlyReport[]>('get_responsible_monthly_reports', { p_elevator_id: elevatorId || null });
}

export async function getResponsibleTechnicians(): Promise<ResponsibleTechnician[]> {
  return rpc<ResponsibleTechnician[]>('get_responsible_technicians');
}
