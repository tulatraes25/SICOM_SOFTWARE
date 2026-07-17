import { supabase } from '@/config/supabase';
import type { ServiceOrder, ServiceOrderType } from '@/types/database';

export async function listServiceOrders(filters?: {
  status?: string; priority?: string; order_type?: string;
  client_id?: string; building_id?: string; search?: string;
  limit?: number; offset?: number;
}): Promise<{ data: ServiceOrder[]; count: number }> {
  let query = supabase.from('service_orders').select(`
    *, service_case:service_cases(case_number, numbering_mode),
    client:clients(name, code), building:buildings(name, code),
    elevator:elevators(code),
    technicians:service_order_technicians(technician:profiles!service_order_technicians_technician_id_fkey(full_name), is_lead)
  `, { count: 'exact' }).order('created_at', { ascending: false });

  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.priority) query = query.eq('priority', filters.priority);
  if (filters?.order_type) query = query.eq('order_type', filters.order_type);
  if (filters?.client_id) query = query.eq('client_id', filters.client_id);
  if (filters?.building_id) query = query.eq('building_id', filters.building_id);
  if (filters?.search) query = query.or(`subject.ilike.%${filters.search}%,service_cases.case_number::text.ilike.%${filters.search}%`);

  const from = filters?.offset || 0;
  query = query.range(from, from + (filters?.limit || 50) - 1);
  const { data, count, error } = await query;
  if (error) throw error;
  return { data: data || [], count: count || 0 };
}

export async function getServiceOrder(id: string): Promise<ServiceOrder | null> {
  const { data, error } = await supabase.from('service_orders').select(`
    *, service_case:service_cases(case_number, numbering_mode, status),
    client:clients(id, name, code, contact_name, contact_phone),
    building:buildings(id, name, code, address),
    elevator:elevators(id, code, manufacturer, model),
    technicians:service_order_technicians(technician:profiles!service_order_technicians_technician_id_fkey(id, full_name, email), is_lead, assigned_at),
    created_user:profiles!service_orders_created_by_fkey(full_name, email)
  `).eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function createServiceOrder(params: {
  client_id: string; building_id: string; subject: string; work_requested: string;
  elevator_id?: string; order_date?: string; scheduled_date?: string; scheduled_time?: string;
  priority?: string; order_type?: ServiceOrderType; internal_notes?: string; client_notes?: string;
  service_case_id?: string; claim_id?: string; budget_id?: string;
}): Promise<{ order_id: string; service_case_id: string; case_number: number; numbering_mode: string; status: string }> {
  const { data, error } = await supabase.rpc('create_service_order', {
    p_client_id: params.client_id, p_building_id: params.building_id,
    p_subject: params.subject, p_work_requested: params.work_requested,
    p_elevator_id: params.elevator_id || null, p_order_date: params.order_date || new Date().toISOString().split('T')[0],
    p_scheduled_date: params.scheduled_date || null, p_scheduled_time: params.scheduled_time || null,
    p_priority: params.priority || 'normal', p_order_type: params.order_type || 'other',
    p_internal_notes: params.internal_notes || null, p_client_notes: params.client_notes || null,
    p_service_case_id: params.service_case_id || null, p_claim_id: params.claim_id || null,
    p_budget_id: params.budget_id || null,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function markReady(orderId: string): Promise<void> {
  const { data, error } = await supabase.rpc('mark_service_order_ready', { p_order_id: orderId });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function assignTechnicians(orderId: string, technicianIds: string[], leadId?: string): Promise<void> {
  const { data, error } = await supabase.rpc('assign_service_order_technicians', {
    p_order_id: orderId, p_technician_ids: technicianIds, p_is_lead: leadId || null,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function startOrder(orderId: string): Promise<void> {
  const { data, error } = await supabase.rpc('start_service_order', { p_order_id: orderId });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function completeOrder(orderId: string, summary?: string): Promise<void> {
  const { data, error } = await supabase.rpc('complete_service_order', { p_order_id: orderId, p_summary: summary || null });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function cancelOrder(orderId: string, reason: string): Promise<void> {
  const { data, error } = await supabase.rpc('cancel_service_order', { p_order_id: orderId, p_reason: reason });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function addProgress(orderId: string, note: string, progressType: string = 'update'): Promise<void> {
  const { data, error } = await supabase.rpc('add_service_order_progress', {
    p_order_id: orderId, p_note: note, p_progress_type: progressType,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function getOrderEvents(orderId: string) {
  const { data, error } = await supabase.from('service_order_events').select('*, performer:profiles(full_name)').eq('service_order_id', orderId).order('created_at');
  if (error) throw error;
  return data || [];
}

export async function getOrderProgress(orderId: string) {
  const { data, error } = await supabase.from('service_order_progress').select('*, tech:profiles(full_name)').eq('service_order_id', orderId).order('created_at');
  if (error) throw error;
  return data || [];
}
