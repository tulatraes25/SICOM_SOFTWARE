import { supabase } from '@/config/supabase';

export interface MonthlyReportSummary {
  preventiveCount: number;
  correctiveCount: number;
  serviceOrderCount: number;
  claimCount: number;
  totalApproved: number;
  totalWithCorrections: number;
  firstDate: string | null;
  lastDate: string | null;
}

export async function createMonthlyReport(params: {
  elevator_id: string;
  client_id?: string;
  building_id?: string;
  report_month: number;
  report_year: number;
}): Promise<{ id: string; period: string }> {
  const { data, error } = await supabase.from('monthly_reports').insert({
    elevator_id: params.elevator_id,
    client_id: params.client_id,
    building_id: params.building_id,
    report_month: params.report_month,
    report_year: params.report_year,
    period: `${params.report_year}-${String(params.report_month).padStart(2, '0')}`,
    status: 'draft',
    services_count: 0,
  }).select().single();

  if (error) throw error;
  return { id: data.id, period: data.period };
}

export async function getMonthlyReportPeriodData(
  elevatorId: string,
  year: number,
  month: number
): Promise<{
  maintenances: any[];
  serviceOrders: any[];
  claims: any[];
  summary: MonthlyReportSummary;
}> {
  const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const dateTo = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  // Get approved maintenance records
  const { data: maintenances } = await supabase
    .from('service_records')
    .select('*, elevator:elevators(code), technician:profiles!service_records_technician_id_fkey(full_name)')
    .eq('elevator_id', elevatorId)
    .eq('status', 'approved')
    .gte('service_date', dateFrom)
    .lte('service_date', dateTo)
    .order('service_date');

  // Get approved service orders
  const { data: serviceOrders } = await supabase
    .from('service_orders')
    .select('*, service_case:service_cases(case_number, numbering_mode), technicians:service_order_technicians(technician:profiles!service_order_technicians_technician_id_fkey(full_name), is_lead)')
    .eq('elevator_id', elevatorId)
    .eq('status', 'approved')
    .gte('order_date', dateFrom)
    .lte('order_date', dateTo)
    .order('order_date');

  // Get claims for this elevator in the period
  const { data: claims } = await supabase
    .from('claims')
    .select('*, service_case:service_cases(case_number, numbering_mode)')
    .eq('elevator_id', elevatorId)
    .gte('claim_date', dateFrom)
    .lte('claim_date', dateTo)
    .order('claim_date');

  // Build summary
  const preventiveCount = (maintenances || []).filter((m: any) => m.service_type === 'preventivo').length;
  const correctiveCount = (maintenances || []).filter((m: any) => m.service_type === 'correctivo').length;
  const serviceOrderCount = (serviceOrders || []).length;
  const claimCount = (claims || []).length;
  const dates = [...(maintenances || []).map((m: any) => m.service_date), ...(serviceOrders || []).map((o: any) => o.order_date)].filter(Boolean).sort();

  const summary: MonthlyReportSummary = {
    preventiveCount,
    correctiveCount,
    serviceOrderCount,
    claimCount,
    totalApproved: (maintenances || []).length + (serviceOrders || []).length,
    totalWithCorrections: (serviceOrders || []).filter((o: any) => o.changes_requested).length,
    firstDate: dates[0] || null,
    lastDate: dates[dates.length - 1] || null,
  };

  return { maintenances: maintenances || [], serviceOrders: serviceOrders || [], claims: claims || [], summary };
}

export async function updateMonthlyReport(id: string, updates: {
  general_status?: string;
  general_notes?: string;
  content?: string;
  summary?: string;
}): Promise<void> {
  const { error } = await supabase.from('monthly_reports').update({
    ...updates, updated_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) throw error;
}

export async function approveMonthlyReport(id: string): Promise<void> {
  const { error } = await supabase.from('monthly_reports').update({
    status: 'approved', approved_by: (await supabase.auth.getUser()).data.user?.id,
    approved_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) throw error;
}
