import { supabase } from '@/config/supabase';
import type { ServiceCase, ServiceCaseEvent, DocumentNumberingSettings, CaseOriginType } from '@/types/database';

export async function listServiceCases(filters?: {
  status?: string;
  origin_type?: string;
  numbering_mode?: string;
  client_id?: string;
  building_id?: string;
  elevator_id?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: ServiceCase[]; count: number }> {
  let query = supabase
    .from('service_cases')
    .select(`
      *,
      client:clients(id, name, code),
      building:buildings(id, name, code),
      elevator:elevators(id, code),
      assigned_user:profiles!service_cases_assigned_to_fkey(full_name, email),
      created_user:profiles!service_cases_created_by_fkey(full_name, email)
    `, { count: 'exact' })
    .order('case_number', { ascending: false });

  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.origin_type) query = query.eq('origin_type', filters.origin_type);
  if (filters?.numbering_mode) query = query.eq('numbering_mode', filters.numbering_mode);
  if (filters?.client_id) query = query.eq('client_id', filters.client_id);
  if (filters?.building_id) query = query.eq('building_id', filters.building_id);
  if (filters?.elevator_id) query = query.eq('elevator_id', filters.elevator_id);
  if (filters?.search) {
    query = query.or(`case_number::text.ilike.%${filters.search}%,title.ilike.%${filters.search}%`);
  }

  const from = filters?.offset || 0;
  const to = from + (filters?.limit || 50) - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) throw error;
  return { data: data || [], count: count || 0 };
}

export async function getServiceCase(id: string): Promise<ServiceCase | null> {
  const { data, error } = await supabase
    .from('service_cases')
    .select(`
      *,
      client:clients(id, name, code, contact_name, contact_email, contact_phone),
      building:buildings(id, name, code, address, locality),
      elevator:elevators(id, code, manufacturer, model, elevator_type),
      assigned_user:profiles!service_cases_assigned_to_fkey(full_name, email),
      created_user:profiles!service_cases_created_by_fkey(full_name, email)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function getServiceCaseByNumber(caseNumber: number): Promise<ServiceCase | null> {
  const { data, error } = await supabase
    .from('service_cases')
    .select(`
      *,
      client:clients(id, name, code),
      building:buildings(id, name, code),
      elevator:elevators(id, code)
    `)
    .eq('case_number', caseNumber)
    .single();

  if (error) return null;
  return data;
}

export async function createServiceCase(params: {
  origin_type: CaseOriginType;
  client_id?: string;
  building_id?: string;
  elevator_id?: string;
  title?: string;
  description?: string;
  assigned_to?: string;
}): Promise<{ id: string; case_number: number; numbering_mode: string; origin_type: string; status: string }> {
  const { data, error } = await supabase.rpc('create_service_case', {
    p_origin_type: params.origin_type,
    p_client_id: params.client_id || null,
    p_building_id: params.building_id || null,
    p_elevator_id: params.elevator_id || null,
    p_title: params.title || null,
    p_description: params.description || null,
    p_assigned_to: params.assigned_to || null,
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function closeServiceCase(caseId: string): Promise<void> {
  const { data, error } = await supabase.rpc('close_service_case', {
    p_case_id: caseId,
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function cancelServiceCase(caseId: string, reason: string): Promise<void> {
  const { data, error } = await supabase.rpc('cancel_service_case', {
    p_case_id: caseId,
    p_reason: reason,
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function getNumberingSettings(): Promise<DocumentNumberingSettings | null> {
  const { data, error } = await supabase.rpc('get_numbering_settings');
  if (error) throw error;
  if (data?.error) return null;
  return data;
}

export async function activateProductionNumbering(): Promise<{ success: boolean; next_production_number: number }> {
  const { data, error } = await supabase.rpc('activate_production_numbering');
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function getCaseEvents(caseId: string): Promise<ServiceCaseEvent[]> {
  const { data, error } = await supabase
    .from('service_case_events')
    .select(`
      *,
      performer:profiles!service_case_events_performed_by_fkey(id, full_name, email)
    `)
    .eq('service_case_id', caseId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export function formatCaseNumber(caseNumber: number, mode: string): string {
  if (mode === 'test') return `PRUEBA N.º ${caseNumber}`;
  return `N.º ${caseNumber}`;
}

export function formatCaseNumberShort(caseNumber: number): string {
  return `EXP-${caseNumber}`;
}
