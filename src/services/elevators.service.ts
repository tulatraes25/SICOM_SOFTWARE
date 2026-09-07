import { supabase } from '@/config/supabase';
import type { Elevator } from '@/types/database';
import type { ElevatorTechnicalFields } from '@/types/elevators';

export type ElevatorWithTechnical = Elevator & ElevatorTechnicalFields;

type ElevatorWritable = Omit<
  ElevatorWithTechnical,
  | 'id'
  | 'created_at'
  | 'updated_at'
  | 'qr_token'
  | 'responsible_user_id'
  | 'building'
  | 'client'
  | 'technical_data_updated_at'
  | 'technical_data_updated_by'
  | 'equipment_category'
  | 'motricity_type'
  | 'start_type'
> & {
  equipment_category?: string;
  motricity_type?: string;
  start_type?: string;
};

export type CreateElevatorInput = ElevatorWritable & {
  qr_token?: string;
};

export type UpdateElevatorInput = Partial<ElevatorWritable>;

function generateQRToken(length: number = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function listElevators(): Promise<ElevatorWithTechnical[]> {
  const { data, error } = await supabase
    .from('elevators')
    .select('*, building:buildings(name, address), client:clients(name)')
    .order('code');

  if (error) throw error;
  return (data || []) as ElevatorWithTechnical[];
}

export async function getElevatorById(id: string): Promise<ElevatorWithTechnical | null> {
  const { data, error } = await supabase
    .from('elevators')
    .select('*, building:buildings(*), client:clients(*)')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as ElevatorWithTechnical;
}

export async function getElevatorByToken(token: string): Promise<ElevatorWithTechnical | null> {
  const { data, error } = await supabase
    .from('elevators')
    .select('*, building:buildings(name, address), client:clients(name)')
    .eq('qr_token', token)
    .single();

  if (error) throw error;
  return data as ElevatorWithTechnical;
}

export async function searchElevators(query: string, active?: boolean): Promise<ElevatorWithTechnical[]> {
  let q = supabase
    .from('elevators')
    .select('*, building:buildings(name, address), client:clients(name)')
    .or(`code.ilike.%${query}%,serial_number.ilike.%${query}%,manufacturer.ilike.%${query}%`)
    .order('code');

  if (active !== undefined) {
    q = q.eq('active', active);
  }

  const { data, error } = await q;

  if (error) throw error;
  return (data || []) as ElevatorWithTechnical[];
}

export async function filterElevators(filters: {
  operational_status?: string;
  conservation_status?: string;
  contractual_status?: string;
  client_id?: string;
  building_id?: string;
  active?: boolean;
}): Promise<ElevatorWithTechnical[]> {
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
  if (filters.active !== undefined) {
    query = query.eq('active', filters.active);
  }

  const { data, error } = await query.order('code');

  if (error) throw error;
  return (data || []) as ElevatorWithTechnical[];
}

export async function createElevator(input: CreateElevatorInput): Promise<ElevatorWithTechnical> {
  const elevatorData = {
    ...input,
    qr_token: input.qr_token || generateQRToken(),
  };

  const { data, error } = await supabase
    .from('elevators')
    .insert(elevatorData)
    .select()
    .single();

  if (error) throw error;
  return data as ElevatorWithTechnical;
}

export async function updateElevator(id: string, updates: UpdateElevatorInput): Promise<ElevatorWithTechnical> {
  const { data, error } = await supabase
    .from('elevators')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as ElevatorWithTechnical;
}

export async function deactivateElevator(id: string): Promise<void> {
  const { error } = await supabase
    .from('elevators')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

export async function reactivateElevator(id: string): Promise<void> {
  const { error } = await supabase
    .from('elevators')
    .update({ active: true, updated_at: new Date().toISOString() })
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
): Promise<ElevatorWithTechnical> {
  const { data, error } = await supabase
    .from('elevators')
    .update({ ...status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as ElevatorWithTechnical;
}
