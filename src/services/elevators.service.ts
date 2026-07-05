import { supabase } from '@/config/supabase';
import type { Elevator } from '@/types/database';

function generateQRToken(length: number = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function listElevators(): Promise<Elevator[]> {
  const { data, error } = await supabase
    .from('elevators')
    .select('*, building:buildings(name, address), client:clients(name)')
    .order('code');

  if (error) throw error;
  return data || [];
}

export async function getElevatorById(id: string): Promise<Elevator | null> {
  const { data, error } = await supabase
    .from('elevators')
    .select('*, building:buildings(*), client:clients(*)')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function getElevatorByToken(token: string): Promise<Elevator | null> {
  const { data, error } = await supabase
    .from('elevators')
    .select('*, building:buildings(name, address), client:clients(name)')
    .eq('qr_token', token)
    .single();

  if (error) throw error;
  return data;
}

export async function searchElevators(query: string): Promise<Elevator[]> {
  const { data, error } = await supabase
    .from('elevators')
    .select('*, building:buildings(name, address), client:clients(name)')
    .or(`code.ilike.%${query}%,serial_number.ilike.%${query}%,manufacturer.ilike.%${query}%`)
    .order('code');

  if (error) throw error;
  return data || [];
}

export async function filterElevators(filters: {
  operational_status?: string;
  conservation_status?: string;
  contractual_status?: string;
  client_id?: string;
  building_id?: string;
}): Promise<Elevator[]> {
  let query = supabase
    .from('elevators')
    .select('*, building:buildings(name, address), client:clients(name)');

  if (filters.operational_status) {
    query = query.eq('operational_status', filters.operational_status);
  }
  if (filters.conservation_status) {
    query = query.eq('conservation_status', filters.conservation_status);
  }
  if (filters.contractual_status) {
    query = query.eq('contractual_status', filters.contractual_status);
  }
  if (filters.client_id) {
    query = query.eq('client_id', filters.client_id);
  }
  if (filters.building_id) {
    query = query.eq('building_id', filters.building_id);
  }

  const { data, error } = await query.order('code');

  if (error) throw error;
  return data || [];
}

export async function createElevator(elevator: Omit<Elevator, 'id' | 'created_at' | 'updated_at' | 'qr_token'> & { qr_token?: string }): Promise<Elevator> {
  const elevatorData = {
    ...elevator,
    qr_token: elevator.qr_token || generateQRToken(),
  };

  const { data, error } = await supabase
    .from('elevators')
    .insert(elevatorData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateElevator(id: string, updates: Partial<Elevator>): Promise<Elevator> {
  const { data, error } = await supabase
    .from('elevators')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deactivateElevator(id: string): Promise<void> {
  const { error } = await supabase
    .from('elevators')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

export async function updateElevatorStatus(
  id: string,
  status: {
    operational_status?: string;
    conservation_status?: string;
    contractual_status?: string;
  }
): Promise<Elevator> {
  const { data, error } = await supabase
    .from('elevators')
    .update({ ...status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
