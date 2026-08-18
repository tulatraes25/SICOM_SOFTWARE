import { supabase } from '@/config/supabase';
import type { BuildingRecipient } from '@/types/database';

export async function listBuildingRecipients(buildingId: string): Promise<BuildingRecipient[]> {
  const { data, error } = await supabase
    .from('building_recipients')
    .select('*')
    .eq('building_id', buildingId)
    .order('full_name');

  if (error) throw error;
  return data || [];
}

export async function listServiceOrderRecipients(buildingId: string, elevatorId?: string): Promise<BuildingRecipient[]> {
  let query = supabase
    .from('building_recipients')
    .select('*')
    .eq('building_id', buildingId)
    .eq('active', true)
    .eq('receives_service_orders', true);

  if (elevatorId) {
    // Get building-level + elevator-specific recipients
    query = query.or(`elevator_id.is.null,elevator_id.eq.${elevatorId}`);
  } else {
    query = query.is('elevator_id', null);
  }

  const { data, error } = await query.order('full_name');
  if (error) throw error;
  return data || [];
}

export async function createBuildingRecipient(recipient: {
  building_id: string;
  full_name: string;
  email: string;
  elevator_id?: string;
  role_label?: string;
  phone?: string;
  active?: boolean;
  receives_service_orders?: boolean;
  receives_monthly_reports?: boolean;
  receives_budgets?: boolean;
}): Promise<BuildingRecipient> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const { data, error } = await supabase
    .from('building_recipients')
    .insert({ ...recipient, created_by: user.id })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateBuildingRecipient(id: string, updates: Partial<BuildingRecipient>): Promise<void> {
  const { error } = await supabase
    .from('building_recipients')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
}

export async function deactivateBuildingRecipient(id: string): Promise<void> {
  const { error } = await supabase
    .from('building_recipients')
    .update({ active: false })
    .eq('id', id);

  if (error) throw error;
}

export async function activateBuildingRecipient(id: string): Promise<void> {
  const { error } = await supabase
    .from('building_recipients')
    .update({ active: true })
    .eq('id', id);

  if (error) throw error;
}
