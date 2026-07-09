import { supabase } from '@/config/supabase';
import type { ServiceRecord, MonthlyReport } from '@/types/database';

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
      elevator:elevators(code, building:buildings(name, address, locality, client:clients(name, contact_name, contact_email))),
      technician:profiles!service_records_technician_id_fkey(full_name, email)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

// Marcar como en revisión
export async function markInReview(id: string): Promise<ServiceRecord> {
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('service_records')
    .update({
      status: 'in_review',
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Guardar borrador de informe del supervisor
export async function saveSupervisorReportDraft(
  serviceRecordId: string,
  content: string
): Promise<void> {
  const { error } = await supabase
    .from('service_records')
    .update({
      supervisor_notes: content,
      updated_at: new Date().toISOString(),
    })
    .eq('id', serviceRecordId);

  if (error) throw error;
}

// Generar informe con IA (llama a Edge Function)
export async function generateAIReportDraft(
  serviceRecordId: string
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('generate-report', {
    body: { service_record_id: serviceRecordId },
  });

  if (error) throw error;
  return data.report;
}

// Aprobar registro de servicio
export async function approveServiceRecord(
  id: string,
  finalReport?: string
): Promise<ServiceRecord> {
  const { data: { user } } = await supabase.auth.getUser();
  
  const updateData: Record<string, any> = {
    status: 'approved',
    approved_by: user?.id,
    approved_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (finalReport) {
    updateData.final_report = finalReport;
  }

  const { data, error } = await supabase
    .from('service_records')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Rechazar registro de servicio
export async function rejectServiceRecord(
  id: string,
  reason: string
): Promise<ServiceRecord> {
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('service_records')
    .update({
      status: 'rejected',
      rejection_reason: reason,
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Actualizar estado del ascensor desde servicio aprobado
export async function updateElevatorStatusFromApprovedService(
  serviceRecordId: string
): Promise<void> {
  // Obtener el servicio aprobado
  const { data: service, error: serviceError } = await supabase
    .from('service_records')
    .select('elevator_id, operational_status_at_service, conservation_status_at_service, service_date')
    .eq('id', serviceRecordId)
    .single();

  if (serviceError || !service) throw serviceError;

  // Actualizar el ascensor
  const { error: updateError } = await supabase
    .from('elevators')
    .update({
      operational_status: service.operational_status_at_service,
      conservation_status: service.conservation_status_at_service,
      last_service_date: service.service_date,
      updated_at: new Date().toISOString(),
    })
    .eq('id', service.elevator_id);

  if (updateError) throw updateError;
}

// Crear o actualizar informe mensual
export async function createOrUpdateMonthlyReport(
  serviceRecordId: string
): Promise<MonthlyReport> {
  // Obtener el servicio
  const { data: service, error: serviceError } = await supabase
    .from('service_records')
    .select('elevator_id, service_date, id, final_report')
    .eq('id', serviceRecordId)
    .single();

  if (serviceError || !service) throw serviceError;

  // Determinar período
  const date = new Date(service.service_date);
  const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

  // Buscar monthly_report existente
  const { data: existing } = await supabase
    .from('monthly_reports')
    .select('id')
    .eq('elevator_id', service.elevator_id)
    .eq('period', period)
    .single();

  const { data: { user } } = await supabase.auth.getUser();

  if (existing) {
    // Actualizar existente
    const { data, error } = await supabase
      .from('monthly_reports')
      .update({
        content: service.final_report,
        status: 'reviewed',
        reviewed_by: user?.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;

    // Incrementar services_count por separado
    await supabase.rpc('increment_services_count', { report_id: existing.id });

    return data;
  } else {
    // Crear nuevo
    const { data, error } = await supabase
      .from('monthly_reports')
      .insert({
        elevator_id: service.elevator_id,
        period,
        title: `Informe Mensual - ${period}`,
        content: service.final_report,
        status: 'reviewed',
        created_by: user?.id,
        reviewed_by: user?.id,
        services_count: 1,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
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
