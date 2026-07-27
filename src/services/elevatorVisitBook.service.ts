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
      service_order:service_orders(subject, order_type, priority, status)
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

export async function listAllEntries(
  filters?: {
    clientId?: string;
    buildingId?: string;
    elevatorId?: string;
    technicianId?: string;
    dateFrom?: string;
    dateTo?: string;
    status?: string;
    originType?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ data: any[]; count: number }> {
  let elevatorIds: string[] | null = null;

  // Resolve building to elevator IDs
  if (filters?.buildingId && !filters?.elevatorId) {
    const { data: els } = await supabase.from('elevators').select('id').eq('building_id', filters.buildingId).eq('active', true);
    elevatorIds = (els || []).map((e: any) => e.id);
    if (elevatorIds.length === 0) return { data: [], count: 0 };
  }

  let query = supabase
    .from('elevator_visit_entries')
    .select(`
      id, entry_number, visit_date, elevator_id, technician_id, status,
      entry_type, origin_type, title, description, check_in_at, check_out_at,
      duration_minutes, duration_seconds, service_order_id, service_record_id, service_case_id,
      elevator:elevators(id, code, building:buildings(name, client_id)),
      technician:profiles!elevator_visit_entries_technician_id_fkey(full_name),
      service_case:service_cases(id, case_number, numbering_mode),
      service_order:service_orders(id, subject, order_type, service_case_id)
    `, { count: 'exact' })
    .order('visit_date', { ascending: false })
    .order('entry_number', { ascending: false });

  if (filters?.elevatorId) query = query.eq('elevator_id', filters.elevatorId);
  else if (elevatorIds) query = query.in('elevator_id', elevatorIds);
  if (filters?.technicianId) query = query.eq('technician_id', filters.technicianId);
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.originType) query = query.eq('origin_type', filters.originType);
  if (filters?.dateFrom) query = query.gte('visit_date', filters.dateFrom);
  if (filters?.dateTo) query = query.lte('visit_date', filters.dateTo);
  if (filters?.search) {
    query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,entry_number::text.ilike.%${filters.search}%`);
  }

  const from = filters?.offset || 0;
  const to = from + (filters?.limit || 200) - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) throw error;

  // Enrich: for entries without direct service_case, load from service_order's case
  const enriched = await Promise.all((data || []).map(async (entry: any) => {
    if (!entry.service_case && entry.service_order?.service_case_id) {
      const { data: sc } = await supabase.from('service_cases').select('id, case_number, numbering_mode').eq('id', entry.service_order.service_case_id).single();
      if (sc) entry.service_case = sc;
    }
    return entry;
  }));

  return { data: enriched, count: count || 0 };
}

export async function getVisitEntry(id: string): Promise<ElevatorVisitEntry | null> {
  const { data: entry, error } = await supabase
    .from('elevator_visit_entries')
    .select(`
      *,
      elevator:elevators(id, code, building_id, building:buildings(name, address, client:clients(name))),
      technician:profiles!elevator_visit_entries_technician_id_fkey(full_name, email),
      registered_user:profiles!elevator_visit_entries_registered_by_fkey(full_name, email),
      reviewer:profiles!elevator_visit_entries_reviewed_by_fkey(full_name, email),
      service_case:service_cases(case_number, numbering_mode, status),
      service_order:service_orders(id, subject, work_requested, completion_summary, order_type, priority, status),
      rectified_entry:elevator_visit_entries!rectifies_entry_id(entry_number, visit_date, description)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  if (!entry) return null;

  // Load service_record separately to avoid ambiguous embed
  let serviceRecord = null;
  if (entry.service_record_id) {
    const { data } = await supabase
      .from('service_records')
      .select('id, service_type, status, service_date, description, technical_report, observations, final_report_text, operational_status_at_service, conservation_status_at_service')
      .eq('id', entry.service_record_id)
      .maybeSingle();
    serviceRecord = data;
  }

  return { ...entry, service_record: serviceRecord } as any;
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

export async function createVisitFromServiceOrder(orderId: string): Promise<{ id: string; entry_number: number; status: string; already_existed?: boolean }> {
  const { data, error } = await supabase.rpc('create_visit_from_service_order', {
    p_order_id: orderId,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}
