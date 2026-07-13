import { supabase } from '@/config/supabase';
import type { ServiceRecord } from '@/types/database';

// Listar registros pendientes de revisión
export async function listPendingServiceRecords(): Promise<ServiceRecord[]> {
  const { data, error } = await supabase
    .from('service_records')
    .select(`
      *,
      elevator:elevators(code, building:buildings(name, address, client:clients(name))),
      technician:profiles!service_records_technician_id_fkey(full_name, email)
    `)
    .in('status', ['submitted', 'in_review', 'rejected'])
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Listar registros aprobados recientes
export async function listApprovedServiceRecords(): Promise<ServiceRecord[]> {
  const { data, error } = await supabase
    .from('service_records')
    .select(`
      *,
      elevator:elevators(code, building:buildings(name, address, client:clients(name))),
      technician:profiles!service_records_technician_id_fkey(full_name, email)
    `)
    .eq('status', 'approved')
    .order('approved_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  return data || [];
}

// Obtener registro para revisión
export async function getServiceRecordForReview(id: string): Promise<ServiceRecord | null> {
  const { data, error } = await supabase
    .from('service_records')
    .select(`
      *,
      elevator:elevators(id, code, building_id, manufacturer, model, elevator_type, building:buildings(id, name, address, locality, client:clients(name, contact_name, contact_email))),
      technician:profiles!service_records_technician_id_fkey(full_name, email)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

// Marcar como en revisión - USA RPC
export async function markInReview(id: string): Promise<void> {
  const { data, error } = await supabase.rpc('start_service_review', {
    p_service_record_id: id,
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

// Guardar borrador de informe del supervisor - USA RPC
export async function saveSupervisorReportDraft(
  serviceRecordId: string,
  content: string
): Promise<void> {
  const { data, error } = await supabase.rpc('save_review_report', {
    p_service_record_id: serviceRecordId,
    p_ai_report_draft: content,
    p_final_report_text: content,
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

// Generar informe con IA (Edge Function)
export async function generateAIReportDraft(serviceRecordId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('generate-report', {
    body: { service_record_id: serviceRecordId },
  });

  if (error) throw error;
  return data.report;
}

// Aprobar registro - USA RPC
export async function approveServiceRecord(id: string): Promise<void> {
  const { data, error } = await supabase.rpc('approve_service_record', {
    p_service_record_id: id,
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

// Rechazar registro - USA RPC
export async function rejectServiceRecord(id: string, reason: string): Promise<void> {
  const { data, error } = await supabase.rpc('reject_service_record', {
    p_service_record_id: id,
    p_rejection_reason: reason,
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

// Obtener informes mensuales
export async function listMonthlyReports(filters?: {
  elevator_id?: string;
  period?: string;
  status?: string;
}): Promise<any[]> {
  let query = supabase
    .from('monthly_reports')
    .select(`
      *,
      elevator:elevators(code, building:buildings(name))
    `)
    .order('period', { ascending: false });

  if (filters?.elevator_id) query = query.eq('elevator_id', filters.elevator_id);
  if (filters?.period) query = query.eq('period', filters.period);
  if (filters?.status) query = query.eq('status', filters.status);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Estadísticas del dashboard
export async function getSupervisorStats() {
  const [submitted, inReview, approved, rejected] = await Promise.all([
    supabase.from('service_records').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
    supabase.from('service_records').select('id', { count: 'exact', head: true }).eq('status', 'in_review'),
    supabase.from('service_records').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
    supabase.from('service_records').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
  ]);

  return {
    submitted: submitted.count || 0,
    inReview: inReview.count || 0,
    approved: approved.count || 0,
    rejected: rejected.count || 0,
  };
}
