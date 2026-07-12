import { supabase } from '@/config/supabase';

interface PublicElevatorData {
  id: string;
  code: string;
  manufacturer?: string;
  model?: string;
  elevator_type?: string;
  operational_status: string;
  conservation_status: string;
  contractual_status: string;
  last_service_date?: string;
  updated_at: string;
  building_name: string;
  building_address: string;
  building_locality: string;
  building_province: string;
  client_name?: string;
}

export async function getPublicElevatorByToken(token: string): Promise<PublicElevatorData | null> {
  const { data, error } = await supabase
    .rpc('get_public_elevator_by_token', { token });

  if (error) {
    console.error('Error fetching public elevator:', error);
    return null;
  }

  // La función RPC devuelve un array, tomamos el primer resultado
  if (!data || data.length === 0) return null;

  const row = data[0];

  return {
    id: row.id,
    code: row.code,
    manufacturer: row.manufacturer,
    model: row.model,
    elevator_type: row.elevator_type,
    operational_status: row.operational_status,
    conservation_status: row.conservation_status,
    contractual_status: row.contractual_status,
    last_service_date: row.last_service_date,
    updated_at: row.updated_at,
    building_name: row.building_name,
    building_address: row.building_address,
    building_locality: row.building_locality,
    building_province: row.building_province,
    client_name: row.client_name,
  };
}

export async function logQRScan(token: string, elevatorId: string): Promise<void> {
  try {
    await supabase
      .from('qr_scan_logs')
      .insert({
        elevator_id: elevatorId,
        qr_token: token,
        user_agent: navigator.userAgent,
        scanned_at: new Date().toISOString(),
      });
  } catch (err) {
    console.error('Error logging QR scan:', err);
  }
}

export interface PublicServiceHistory {
  service_date: string;
  service_type: string;
  operational_status: string;
  conservation_status: string;
}

export async function getPublicServiceHistory(elevatorId: string): Promise<PublicServiceHistory[]> {
  const { data, error } = await supabase
    .rpc('get_public_service_history', { p_elevator_id: elevatorId });

  if (error) {
    console.error('Error fetching service history:', error);
    return [];
  }

  return data || [];
}
