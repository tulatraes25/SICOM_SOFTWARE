import { supabase } from '@/config/supabase';
import type { Building } from '@/types/database';

export async function listBuildings(): Promise<Building[]> {
  const { data, error } = await supabase
    .from('buildings')
    .select('*, client:clients(name)')
    .order('name');

  if (error) throw error;
  return data || [];
}

export async function getBuildingsByClient(clientId: string): Promise<Building[]> {
  const { data, error } = await supabase
    .from('buildings')
    .select('*')
    .eq('client_id', clientId)
    .eq('active', true)
    .order('name');

  if (error) throw error;
  return data || [];
}

export async function getBuildingById(id: string): Promise<Building | null> {
  const { data, error } = await supabase
    .from('buildings')
    .select('*, client:clients(name, id)')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function searchBuildings(query: string): Promise<Building[]> {
  const { data, error } = await supabase
    .from('buildings')
    .select('*, client:clients(name)')
    .or(`name.ilike.%${query}%,address.ilike.%${query}%,locality.ilike.%${query}%`)
    .order('name');

  if (error) throw error;
  return data || [];
}

export async function createBuilding(building: Omit<Building, 'id' | 'created_at' | 'updated_at'>): Promise<Building> {
  const { data, error } = await supabase
    .from('buildings')
    .insert(building)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateBuilding(id: string, updates: Partial<Building>): Promise<Building> {
  const { data, error } = await supabase
    .from('buildings')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deactivateBuilding(id: string): Promise<void> {
  const { error } = await supabase
    .from('buildings')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}
