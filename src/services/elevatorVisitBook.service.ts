import { supabase } from '@/config/supabase';
import type { ElevatorVisitEntry, VisitEntryType } from '@/types/database';

export async function listEntriesByElevator(
  elevatorId: string,
  filters?: {
    status?: string;
    entry_type?: string;
    technician_id?: string;
    date_from?: string;
    date_to?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ data: ElevatorVisitEntry[]; count: number }> {
  let query = supabase
    .from('elevator_visit_entries')
    .select(`
      *,
      technician:profiles!elevator_visit_entries_technician_id_fkey(full_name, email),
      registered_user:profiles!elevator_visit_entries_registered_by_fkey(full_name, email),
      reviewer:profiles!elevator_visit_entries_reviewed_by_fkey(full_name, email),
      service_case:service_cases(case_number, numbering_mode),
      service_record:service_records(service_type, status)
    `, { count: 'exact' })
    .eq('elevator_id', elevatorId)
    .order('visit_date', { ascending: false })
    .order('entry_number', { ascending: false });

  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.entry_type) query = query.eq('entry_type', filters.entry_type);
  if (filters?.technician_id) query = query.eq('technician_id', filters.technician_id);
  if (filters?.date_from) query = query.gte('visit_date', filters.date_from);
  if (filters?.date_to) query = query.lte('visit_date', filters.date_to);
  if (filters?.search) {
    query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,entry_number::text.ilike.%${filters.search}%`);
  }

  const from = filters?.offset || 0;
  const to = from + (filters?.limit || 50) - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) throw error;
  return { data: data || [], count: count || 0 };
}

export async function getVisitEntry(id: string): Promise<ElevatorVisitEntry | null> {
  const { data, error } = await supabase
    .from('elevator_visit_entries')
    .select(`
      *,
      elevator:elevators(id, code, building_id, building:buildings(name, address, client:clients(name))),
      technician:profiles!elevator_visit_entries_technician_id_fkey(full_name, email),
      registered_user:profiles!elevator_visit_entries_registered_by_fkey(full_name, email),
      reviewer:profiles!elevator_visit_entries_reviewed_by_fkey(full_name, email),
      service_case:service_cases(case_number, numbering_mode, status),
      service_record:service_records(service_type, status, service_date),
      rectified_entry:elevator_visit_entries!rectifies_entry_id(entry_number, visit_date, description)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createVisitEntry(params: {
  elevator_id: string;
  visit_date: string;
  entry_type: VisitEntryType;
  description: string;
  title?: string;
  work_performed?: string;
  observations?: string;
  recommendations?: string;
  operational_status?: string;
  conservation_status?: string;
  technician_id?: string;
  service_case_id?: string;
  service_record_id?: string;
  origin_type?: string;
}): Promise<{ id: string; entry_number: number; status: string }> {
  const { data, error } = await supabase.rpc('create_elevator_visit_entry', {
    p_elevator_id: params.elevator_id,
    p_visit_date: params.visit_date,
    p_entry_type: params.entry_type,
    p_description: params.description,
    p_title: params.title || null,
    p_work_performed: params.work_performed || null,
    p_observations: params.observations || null,
    p_recommendations: params.recommendations || null,
    p_operational_status: params.operational_status || null,
    p_conservation_status: params.conservation_status || null,
    p_technician_id: params.technician_id || null,
    p_service_case_id: params.service_case_id || null,
    p_service_record_id: params.service_record_id || null,
    p_origin_type: params.origin_type || null,
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function submitVisitEntry(entryId: string): Promise<void> {
  const { data, error } = await supabase.rpc('submit_elevator_visit_entry', {
    p_entry_id: entryId,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function approveVisitEntry(entryId: string): Promise<void> {
  const { data, error } = await supabase.rpc('approve_elevator_visit_entry', {
    p_entry_id: entryId,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function rectifyVisitEntry(
  entryId: string,
  reason: string,
  correctedFields: Record<string, unknown>
): Promise<{ new_id: string; new_entry_number: number }> {
  const { data, error } = await supabase.rpc('rectify_elevator_visit_entry', {
    p_entry_id: entryId,
    p_reason: reason,
    p_corrected_fields: correctedFields,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function cancelVisitEntry(entryId: string, reason: string): Promise<void> {
  const { data, error } = await supabase.rpc('cancel_elevator_visit_entry', {
    p_entry_id: entryId,
    p_reason: reason,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function createVisitFromServiceRecord(serviceRecordId: string): Promise<{ id: string; entry_number: number }> {
  const { data, error } = await supabase.rpc('create_visit_entry_from_service_record', {
    p_service_record_id: serviceRecordId,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function getVisitHistory(
  elevatorId: string,
  dateFrom: string,
  dateTo: string
): Promise<ElevatorVisitEntry[]> {
  const { data, error } = await supabase
    .from('elevator_visit_entries')
    .select(`
      *,
      technician:profiles!elevator_visit_entries_technician_id_fkey(full_name),
      service_case:service_cases(case_number, numbering_mode)
    `)
    .eq('elevator_id', elevatorId)
    .eq('status', 'approved')
    .gte('visit_date', dateFrom)
    .lte('visit_date', dateTo)
    .order('visit_date', { ascending: true })
    .order('entry_number', { ascending: true });

  if (error) throw error;
  return data || [];
}
