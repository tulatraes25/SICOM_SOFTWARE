import { supabase } from '@/config/supabase';
import type { Claim, ClaimChannel, ClaimCategory, ClaimPriority } from '@/types/database';

export async function listClaims(filters?: {
  status?: string; priority?: string; category?: string; assigned_to?: string;
  client_id?: string; building_id?: string; search?: string;
  limit?: number; offset?: number;
}): Promise<{ data: Claim[]; count: number }> {
  let query = supabase.from('claims').select(`
    *, service_case:service_cases(case_number, numbering_mode),
    client:clients(name, code), building:buildings(name, code),
    elevator:elevators(code), assigned_user:profiles!claims_assigned_to_fkey(full_name)
  `, { count: 'exact' }).order('claim_date', { ascending: false });

  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.priority) query = query.eq('priority', filters.priority);
  if (filters?.category) query = query.eq('category', filters.category);
  if (filters?.assigned_to) query = query.eq('assigned_to', filters.assigned_to);
  if (filters?.client_id) query = query.eq('client_id', filters.client_id);
  if (filters?.building_id) query = query.eq('building_id', filters.building_id);
  if (filters?.search) query = query.or(`subject.ilike.%${filters.search}%,service_cases.case_number::text.ilike.%${filters.search}%`);

  const from = filters?.offset || 0;
  query = query.range(from, from + (filters?.limit || 50) - 1);
  const { data, count, error } = await query;
  if (error) throw error;
  return { data: data || [], count: count || 0 };
}

export async function getClaim(id: string): Promise<Claim | null> {
  const { data, error } = await supabase.from('claims').select(`
    *, service_case:service_cases(case_number, numbering_mode, status),
    client:clients(id, name, code, contact_name, contact_phone),
    building:buildings(id, name, code, address),
    elevator:elevators(id, code, manufacturer, model),
    assigned_user:profiles!claims_assigned_to_fkey(full_name, email),
    received_user:profiles!claims_received_by_fkey(full_name)
  `).eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function createClaim(params: {
  client_id: string; building_id: string; subject: string; description: string;
  elevator_id?: string; claim_date?: string; claim_time?: string;
  claimant_name?: string; claimant_email?: string; claimant_phone?: string; claimant_role?: string;
  channel?: ClaimChannel; category?: ClaimCategory; priority?: ClaimPriority;
  internal_notes?: string; assigned_to?: string; service_case_id?: string;
}): Promise<{ claim_id: string; service_case_id: string; case_number: number; numbering_mode: string; status: string }> {
  const { data, error } = await supabase.rpc('create_claim', {
    p_client_id: params.client_id, p_building_id: params.building_id,
    p_subject: params.subject, p_description: params.description,
    p_elevator_id: params.elevator_id || null, p_claim_date: params.claim_date || new Date().toISOString().split('T')[0],
    p_claim_time: params.claim_time || null, p_claimant_name: params.claimant_name || null,
    p_claimant_email: params.claimant_email || null, p_claimant_phone: params.claimant_phone || null,
    p_claimant_role: params.claimant_role || null, p_channel: params.channel || 'phone',
    p_category: params.category || 'other', p_priority: params.priority || 'normal',
    p_internal_notes: params.internal_notes || null, p_assigned_to: params.assigned_to || null,
    p_service_case_id: params.service_case_id || null,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function assignTechnician(claimId: string, technicianId: string): Promise<void> {
  const { data, error } = await supabase.rpc('assign_claim_technician', { p_claim_id: claimId, p_technician_id: technicianId });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function startWork(claimId: string): Promise<void> {
  const { data, error } = await supabase.rpc('start_claim_work', { p_claim_id: claimId });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function resolveClaim(claimId: string, resolution: string): Promise<void> {
  const { data, error } = await supabase.rpc('resolve_claim', { p_claim_id: claimId, p_resolution: resolution });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function closeClaim(claimId: string): Promise<void> {
  const { data, error } = await supabase.rpc('close_claim', { p_claim_id: claimId });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function cancelClaim(claimId: string, reason: string): Promise<void> {
  const { data, error } = await supabase.rpc('cancel_claim', { p_claim_id: claimId, p_reason: reason });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function getClaimEvents(claimId: string) {
  const { data, error } = await supabase.from('claim_events').select('*, performer:profiles(full_name)').eq('claim_id', claimId).order('created_at');
  if (error) throw error;
  return data || [];
}
