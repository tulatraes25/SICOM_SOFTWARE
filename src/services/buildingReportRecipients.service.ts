import { supabase } from '@/config/supabase';

export interface BuildingRecipient {
  id: string;
  building_id: string;
  name: string;
  email: string;
  role?: string;
  active: boolean;
  created_at: string;
}

export async function listByBuilding(buildingId: string): Promise<BuildingRecipient[]> {
  const { data, error } = await supabase
    .from('building_report_recipients')
    .select('*')
    .eq('building_id', buildingId)
    .order('name');

  if (error) throw error;
  return data || [];
}

export async function createRecipient(buildingId: string, data: { name: string; email: string; role?: string }): Promise<BuildingRecipient> {
  const { data: result, error } = await supabase
    .from('building_report_recipients')
    .insert({ building_id: buildingId, name: data.name, email: data.email, role: data.role || '', active: true })
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function updateRecipient(id: string, data: { name: string; email: string; role?: string }): Promise<BuildingRecipient> {
  const { data: result, error } = await supabase
    .from('building_report_recipients')
    .update({ name: data.name, email: data.email, role: data.role || '', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function deleteRecipient(id: string): Promise<void> {
  const { error } = await supabase
    .from('building_report_recipients')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
