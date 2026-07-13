import { supabase } from '@/config/supabase';

interface PublicElevatorData {
  code: string;
  manufacturer?: string;
  model?: string;
  elevator_type?: string;
  operational_status: string;
  conservation_status: string;
  last_service_date?: string;
  building_name: string;
  building_address: string;
  building_locality: string;
  building_province: string;
  company_name: string;
}

/**
 * Obtener datos públicos del ascensor por token.
 * Usa RPC segura que solo devuelve campos públicos.
 */
export async function getPublicElevatorByToken(token: string): Promise<(PublicElevatorData & { id: string }) | null> {
  const { data, error } = await supabase
    .rpc('get_public_elevator_by_token', { p_token: token });

  if (error) {
    console.error('Error fetching public elevator:', error);
    return null;
  }

  if (!data || data.length === 0) return null;

  const row = data[0];
  return {
    id: row.code, // Usar code como identificador público
    code: row.code,
    manufacturer: row.manufacturer,
    model: row.model,
    elevator_type: row.elevator_type,
    operational_status: row.operational_status,
    conservation_status: row.conservation_status,
    last_service_date: row.last_service_date,
    building_name: row.building_name,
    building_address: row.building_address,
    building_locality: row.building_locality,
    building_province: row.building_province,
    company_name: row.company_name,
  };
}

/**
 * Registrar escaneo de forma segura usando RPC.
 */
export async function logQRScan(token: string): Promise<void> {
  try {
    await supabase.rpc('register_public_qr_scan', {
      p_token: token,
      p_user_agent: navigator.userAgent,
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

/**
 * Obtener historial público por token.
 * Solo muestra registros approved.
 */
export async function getPublicServiceHistory(token: string): Promise<PublicServiceHistory[]> {
  const { data, error } = await supabase
    .rpc('get_public_elevator_history_by_token', {
      p_token: token,
      p_limit: 5,
    });

  if (error) {
    console.error('Error fetching service history:', error);
    return [];
  }

  return data || [];
}
