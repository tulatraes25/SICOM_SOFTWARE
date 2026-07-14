import { supabase } from '@/config/supabase';
import type { Budget, BudgetItem } from '@/types/database';

export async function listBudgets(filters?: {
  status?: string;
  client_id?: string;
  building_id?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: Budget[]; count: number }> {
  let query = supabase
    .from('budgets')
    .select(`
      *,
      service_case:service_cases(case_number, numbering_mode),
      client:clients(name, code),
      building:buildings(name, code),
      elevator:elevators(code),
      created_user:profiles!budgets_created_by_fkey(full_name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false });

  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.client_id) query = query.eq('client_id', filters.client_id);
  if (filters?.building_id) query = query.eq('building_id', filters.building_id);
  if (filters?.search) {
    query = query.or(`subject.ilike.%${filters.search}%,service_cases.case_number::text.ilike.%${filters.search}%`);
  }

  const from = filters?.offset || 0;
  const to = from + (filters?.limit || 50) - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) throw error;
  return { data: data || [], count: count || 0 };
}

export async function getBudget(id: string): Promise<Budget | null> {
  const { data, error } = await supabase
    .from('budgets')
    .select(`
      *,
      service_case:service_cases(case_number, numbering_mode, status),
      client:clients(id, name, code, contact_name, contact_email, contact_phone),
      building:buildings(id, name, code, address, locality),
      elevator:elevators(id, code, manufacturer, model),
      created_user:profiles!budgets_created_by_fkey(full_name, email),
      approved_user:profiles!budgets_approved_by_fkey(full_name, email)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;

  // Load items
  const { data: items } = await supabase
    .from('budget_items')
    .select('*')
    .eq('budget_id', id)
    .order('item_order');

  return { ...data, items: items || [] };
}

export async function createBudget(params: {
  client_id: string;
  building_id?: string;
  elevator_id?: string;
  subject: string;
  budget_date?: string;
  valid_until?: string;
  service_case_id?: string;
}): Promise<{ budget_id: string; service_case_id: string; case_number: number; numbering_mode: string }> {
  const { data, error } = await supabase.rpc('create_budget', {
    p_client_id: params.client_id,
    p_building_id: params.building_id || null,
    p_elevator_id: params.elevator_id || null,
    p_subject: params.subject,
    p_budget_date: params.budget_date || new Date().toISOString().split('T')[0],
    p_valid_until: params.valid_until || null,
    p_service_case_id: params.service_case_id || null,
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function updateBudgetDraft(id: string, updates: {
  subject?: string;
  introduction?: string;
  notes?: string;
  payment_terms?: string;
  delivery_terms?: string;
  tax_rate?: number;
  valid_until?: string;
}): Promise<void> {
  const { error } = await supabase
    .from('budgets')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'draft');

  if (error) throw error;
}

export async function addBudgetItem(budgetId: string, item: {
  description: string;
  quantity: number;
  unit?: string;
  unit_price: number;
  notes?: string;
}): Promise<BudgetItem> {
  // Get next order
  const { data: existing } = await supabase
    .from('budget_items')
    .select('item_order')
    .eq('budget_id', budgetId)
    .order('item_order', { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? existing[0].item_order + 1 : 1;

  const { data, error } = await supabase
    .from('budget_items')
    .insert({
      budget_id: budgetId,
      item_order: nextOrder,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price,
      line_subtotal: item.quantity * item.unit_price,
      notes: item.notes,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateBudgetItem(itemId: string, updates: {
  description?: string;
  quantity?: number;
  unit?: string;
  unit_price?: number;
  notes?: string;
}): Promise<void> {
  // Get current item to recalculate
  const { data: current } = await supabase
    .from('budget_items')
    .select('quantity, unit_price')
    .eq('id', itemId)
    .single();

  if (!current) throw new Error('Ítem no encontrado');

  const qty = updates.quantity ?? current.quantity;
  const price = updates.unit_price ?? current.unit_price;

  const { error } = await supabase
    .from('budget_items')
    .update({
      ...updates,
      line_subtotal: qty * price,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId);

  if (error) throw error;
}

export async function deleteBudgetItem(itemId: string): Promise<void> {
  const { error } = await supabase.from('budget_items').delete().eq('id', itemId);
  if (error) throw error;
}

export async function recalculateBudget(budgetId: string): Promise<void> {
  const { data, error } = await supabase.rpc('recalculate_budget_totals', {
    p_budget_id: budgetId,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function markBudgetReady(budgetId: string): Promise<void> {
  const { data, error } = await supabase.rpc('mark_budget_ready', { p_budget_id: budgetId });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function markBudgetSent(budgetId: string): Promise<void> {
  const { data, error } = await supabase.rpc('mark_budget_sent', { p_budget_id: budgetId });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function acceptBudget(budgetId: string): Promise<void> {
  const { data, error } = await supabase.rpc('accept_budget', { p_budget_id: budgetId });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function rejectBudget(budgetId: string, reason?: string): Promise<void> {
  const { data, error } = await supabase.rpc('reject_budget', {
    p_budget_id: budgetId,
    p_reason: reason || null,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function cancelBudget(budgetId: string, reason: string): Promise<void> {
  const { data, error } = await supabase.rpc('cancel_budget', {
    p_budget_id: budgetId,
    p_reason: reason,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}
