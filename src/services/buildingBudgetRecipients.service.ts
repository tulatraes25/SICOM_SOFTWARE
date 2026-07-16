import { supabase } from '@/config/supabase';

export interface BuildingBudgetRecipient {
  id: string;
  building_id: string;
  name: string;
  email: string;
  position?: string;
  active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export async function listBudgetRecipients(buildingId: string): Promise<BuildingBudgetRecipient[]> {
  const { data, error } = await supabase
    .from('building_budget_recipients')
    .select('*')
    .eq('building_id', buildingId)
    .eq('active', true)
    .order('name');

  if (error) throw error;
  return data || [];
}

export async function createBudgetRecipient(recipient: {
  building_id: string;
  name: string;
  email: string;
  position?: string;
}): Promise<BuildingBudgetRecipient> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const { data, error } = await supabase
    .from('building_budget_recipients')
    .insert({ ...recipient, created_by: user.id })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deactivateBudgetRecipient(id: string): Promise<void> {
  const { error } = await supabase
    .from('building_budget_recipients')
    .update({ active: false })
    .eq('id', id);

  if (error) throw error;
}
