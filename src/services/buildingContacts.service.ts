import { supabase } from '@/config/supabase';
import type { BuildingContact } from '@/types/database';

export async function listBuildingContacts(buildingId: string): Promise<BuildingContact[]> {
  const { data, error } = await supabase
    .from('building_contacts')
    .select('*')
    .eq('building_id', buildingId)
    .order('name');

  if (error) throw error;
  return data || [];
}

export async function listActiveContactsByType(
  buildingId: string,
  documentType: 'reports' | 'budgets' | 'invoices' | 'service_orders' | 'claim_updates' | 'general_notices'
): Promise<BuildingContact[]> {
  const columnMap: Record<string, string> = {
    reports: 'receives_reports',
    budgets: 'receives_budgets',
    invoices: 'receives_invoices',
    service_orders: 'receives_service_orders',
    claim_updates: 'receives_claim_updates',
    general_notices: 'receives_general_notices',
  };

  const column = columnMap[documentType];
  if (!column) return [];

  const { data, error } = await supabase
    .from('building_contacts')
    .select('*')
    .eq('building_id', buildingId)
    .eq('is_active', true)
    .eq(column, true)
    .order('name');

  if (error) throw error;
  return data || [];
}

export async function createBuildingContact(contact: {
  building_id: string;
  name: string;
  email: string;
  phone?: string;
  position?: string;
  organization?: string;
  notes?: string;
  receives_reports?: boolean;
  receives_budgets?: boolean;
  receives_invoices?: boolean;
  receives_service_orders?: boolean;
  receives_claim_updates?: boolean;
  receives_general_notices?: boolean;
}): Promise<BuildingContact> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const { data, error } = await supabase
    .from('building_contacts')
    .insert({ ...contact, created_by: user.id })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateBuildingContact(id: string, updates: Partial<BuildingContact>): Promise<void> {
  const { error } = await supabase
    .from('building_contacts')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
}

export async function deactivateBuildingContact(id: string): Promise<void> {
  const { error } = await supabase
    .from('building_contacts')
    .update({ is_active: false })
    .eq('id', id);

  if (error) throw error;
}

export async function reactivateBuildingContact(id: string): Promise<void> {
  const { error } = await supabase
    .from('building_contacts')
    .update({ is_active: true })
    .eq('id', id);

  if (error) throw error;
}
