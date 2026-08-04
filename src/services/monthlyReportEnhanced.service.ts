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

export async function findMonthlyReportByPeriod(
  elevatorId: string,
  year: number,
  month: number,
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from('monthly_reports')
    .select('id')
    .eq('elevator_id', elevatorId)
    .eq('report_year', year)
    .eq('report_month', month)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function validateReportRelations(
  clientId: string,
  buildingId: string,
  elevatorId: string,
): Promise<void> {
  // Check client is active
  const { data: client, error: cErr } = await supabase
    .from('clients')
    .select('id, active')
    .eq('id', clientId)
    .single();
  if (cErr || !client) throw new Error('Seleccioná un cliente.');
  if (!client.active) throw new Error('El cliente seleccionado ya no está activo.');

  // Check building belongs to client and is active
  const { data: building, error: bErr } = await supabase
    .from('buildings')
    .select('id, active, client_id')
    .eq('id', buildingId)
    .single();
  if (bErr || !building) throw new Error('Seleccioná un edificio.');
  if (!building.active) throw new Error('El edificio seleccionado ya no está activo.');
  if (building.client_id !== clientId) throw new Error('El edificio no pertenece al cliente seleccionado.');

  // Check elevator belongs to building and is active
  const { data: elevator, error: eErr } = await supabase
    .from('elevators')
    .select('id, active, building_id')
    .eq('id', elevatorId)
    .single();
  if (eErr || !elevator) throw new Error('Seleccioná un ascensor.');
  if (!elevator.active) throw new Error('El ascensor seleccionado ya no está activo.');
  if (elevator.building_id !== buildingId) throw new Error('El ascensor no pertenece al edificio seleccionado.');
}

export async function createMonthlyReport(params: {
  elevator_id: string;
  client_id: string;
  building_id: string;
  report_month: number;
  report_year: number;
}): Promise<{ id: string; period: string }> {
  if (!params.client_id) throw new Error('Seleccioná un cliente.');
  if (!params.building_id) throw new Error('Seleccioná un edificio.');
  if (!params.elevator_id) throw new Error('Seleccioná un ascensor.');
  if (params.report_month < 1 || params.report_month > 12) throw new Error('Mes inválido.');
  if (params.report_year < 2020 || params.report_year > 2100) throw new Error('Año inválido.');

  const period = `${params.report_year}-${String(params.report_month).padStart(2, '0')}`;

  const { data, error } = await supabase.from('monthly_reports').insert({
    elevator_id: params.elevator_id,
    client_id: params.client_id,
    building_id: params.building_id,
    report_month: params.report_month,
    report_year: params.report_year,
    period,
    status: 'draft',
    services_count: 0,
  }).select().single();

  if (error) throw error;
  return { id: data.id, period };
}

export async function getMonthlyReportPeriodData(
  elevatorId: string,
  year: number,
  month: number,
): Promise<{
  maintenances: Record<string, unknown>[];
  serviceOrders: Record<string, unknown>[];
  claims: Record<string, unknown>[];
  summary: MonthlyReportSummary;
}> {
  const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const dateTo = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const { data: maintenances } = await supabase
    .from('service_records')
    .select('*, elevator:elevators(code), technician:profiles!service_records_technician_id_fkey(full_name)')
    .eq('elevator_id', elevatorId)
    .eq('status', 'approved')
    .gte('service_date', dateFrom)
    .lte('service_date', dateTo)
    .order('service_date');

  const { data: serviceOrders } = await supabase
    .from('service_orders')
    .select('*, service_case:service_cases(case_number, numbering_mode), technicians:service_order_technicians(technician:profiles!service_order_technicians_technician_id_fkey(full_name), is_lead)')
    .eq('elevator_id', elevatorId)
    .eq('status', 'approved')
    .gte('order_date', dateFrom)
    .lte('order_date', dateTo)
    .order('order_date');

  const { data: claims } = await supabase
    .from('claims')
    .select('*, service_case:service_cases(case_number, numbering_mode)')
    .eq('elevator_id', elevatorId)
    .gte('claim_date', dateFrom)
    .lte('claim_date', dateTo)
    .order('claim_date');

  const preventiveCount = (maintenances || []).filter((m: Record<string, unknown>) => m.service_type === 'preventivo').length;
  const correctiveCount = (maintenances || []).filter((m: Record<string, unknown>) => m.service_type === 'correctivo').length;
  const serviceOrderCount = (serviceOrders || []).length;
  const claimCount = (claims || []).length;
  const dates = [...(maintenances || []).map((m: Record<string, unknown>) => m.service_date), ...(serviceOrders || []).map((o: Record<string, unknown>) => o.order_date)].filter(Boolean).sort();

  const summary: MonthlyReportSummary = {
    preventiveCount,
    correctiveCount,
    serviceOrderCount,
    claimCount,
    totalApproved: (maintenances || []).length + (serviceOrders || []).length,
    totalWithCorrections: (serviceOrders || []).filter((o: Record<string, unknown>) => o.changes_requested).length,
    firstDate: (dates[0] as string) || null,
    lastDate: (dates[dates.length - 1] as string) || null,
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

export async function listMonthlyReports(filters?: {
  elevator_id?: string;
  period?: string;
  status?: string;
  client_id?: string;
}): Promise<Record<string, unknown>[]> {
  let query = supabase
    .from('monthly_reports')
    .select(`
      *,
      elevator:elevators(code, building:buildings(name, address, client:clients(name))),
      approved_by_profile:profiles!monthly_reports_approved_by_fkey(full_name),
      reviewed_by_profile:profiles!monthly_reports_reviewed_by_fkey(full_name)
    `)
    .order('period', { ascending: false });

  if (filters?.elevator_id) query = query.eq('elevator_id', filters.elevator_id);
  if (filters?.period) query = query.eq('period', filters.period);
  if (filters?.status) query = query.eq('status', filters.status);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

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
