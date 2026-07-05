import { supabase } from '@/config/supabase';
import type { Client } from '@/types/database';

export async function listClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('name');

  if (error) throw error;
  return data || [];
}

export async function getClientById(id: string): Promise<Client | null> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function searchClients(query: string): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .or(`name.ilike.%${query}%,tax_id.ilike.%${query}%,locality.ilike.%${query}%`)
    .order('name');

  if (error) throw error;
  return data || [];
}

export async function createClient(client: Omit<Client, 'id' | 'created_at' | 'updated_at'>): Promise<Client> {
  const { data, error } = await supabase
    .from('clients')
    .insert(client)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateClient(id: string, updates: Partial<Client>): Promise<Client> {
  const { data, error } = await supabase
    .from('clients')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deactivateClient(id: string): Promise<void> {
  const { error } = await supabase
    .from('clients')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

export async function activateClient(id: string): Promise<void> {
  const { error } = await supabase
    .from('clients')
    .update({ active: true, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}
