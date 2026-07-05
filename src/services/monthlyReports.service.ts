import { supabase } from '@/config/supabase';
import type { MonthlyReport, ReportSend, ReportRecipient } from '@/types/database';

// Listar informes mensuales con filtros
export async function listMonthlyReports(filters?: {
  elevator_id?: string;
  period?: string;
  status?: string;
  client_id?: string;
}): Promise<MonthlyReport[]> {
  let query = supabase
    .from('monthly_reports')
    .select(`
      *,
      elevator:elevators(code, building:buildings(name, address, client:clients(name))),
      approved_by_profile:profiles!monthly_reports_approved_by_fkey(full_name),
      reviewed_by_profile:profiles!monthly_reports_reviewed_by_fkey(full_name)
    `)
    .order('period', { ascending: false });

  if (filters?.elevator_id) {
    query = query.eq('elevator_id', filters.elevator_id);
  }
  if (filters?.period) {
    query = query.eq('period', filters.period);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Obtener informe por ID
export async function getMonthlyReportById(id: string): Promise<MonthlyReport | null> {
  const { data, error } = await supabase
    .from('monthly_reports')
    .select(`
      *,
      elevator:elevators(
        code, manufacturer, model, elevator_type,
        building:buildings(name, address, locality, province, client:clients(name, contact_name, contact_email))
      ),
      approved_by_profile:profiles!monthly_reports_approved_by_fkey(full_name, email),
      reviewed_by_profile:profiles!monthly_reports_reviewed_by_fkey(full_name, email)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

// Obtener informe por ascensor y período
export async function getMonthlyReportByElevatorAndPeriod(
  elevatorId: string,
  period: string
): Promise<MonthlyReport | null> {
  const { data, error } = await supabase
    .from('monthly_reports')
    .select('*')
    .eq('elevator_id', elevatorId)
    .eq('period', period)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// DEPRECATED: Usar usePDFGenerator() desde el frontend
// Esta función llama a una Edge Function que ya no genera PDF real
// Se mantiene solo por compatibilidad, no debería usarse
/** @deprecated Usar usePDFGenerator() desde frontend */
export async function generateReportPDF(_reportId: string): Promise<string> {
  throw new Error(
    'Esta función está deprecated. Use el botón "Generar y Guardar PDF" en la interfaz de supervisor.'
  );
}

// Enviar informe por correo (llama a Edge Function)
export async function sendMonthlyReport(reportId: string): Promise<{
  success: number;
  failed: number;
  results: Array<{ email: string; status: string; error?: string }>;
}> {
  const { data, error } = await supabase.functions.invoke('send-report-email', {
    body: { report_id: reportId },
  });

  if (error) throw error;
  return data;
}

// Actualizar estado del informe
export async function updateReportStatus(
  reportId: string,
  status: string
): Promise<void> {
  const { error } = await supabase
    .from('monthly_reports')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', reportId);

  if (error) throw error;
}

// Obtener destinatarios del informe (a través del ascensor)
export async function getReportRecipients(reportId: string): Promise<ReportRecipient[]> {
  // Primero obtener el informe para saber el elevator_id
  const { data: report, error: reportError } = await supabase
    .from('monthly_reports')
    .select('elevator_id')
    .eq('id', reportId)
    .single();

  if (reportError || !report) throw reportError;

  // Obtener destinatarios del ascensor
  const { data, error } = await supabase
    .from('report_recipients')
    .select('*')
    .eq('elevator_id', report.elevator_id)
    .eq('active', true)
    .order('name');

  if (error) throw error;
  return data || [];
}

// Obtener historial de envíos
export async function getReportSends(reportId: string): Promise<ReportSend[]> {
  const { data, error } = await supabase
    .from('report_sends')
    .select('*')
    .eq('monthly_report_id', reportId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Obtener estadísticas de informes
export async function getMonthlyReportStats() {
  const [total, pending, generated, sent] = await Promise.all([
    supabase.from('monthly_reports').select('id', { count: 'exact', head: true }),
    supabase.from('monthly_reports').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
    supabase.from('monthly_reports').select('id', { count: 'exact', head: true }).not('pdf_url', 'is', null),
    supabase.from('monthly_reports').select('id', { count: 'exact', head: true }).eq('status', 'sent'),
  ]);

  return {
    total: total.count || 0,
    pending: pending.count || 0,
    generated: generated.count || 0,
    sent: sent.count || 0,
  };
}
