import { supabase } from '@/config/supabase';
import type { Profile } from '@/types/roles';

export async function listProfilesByRole(role: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', role)
    .eq('active', true)
    .order('full_name');

  if (error) throw error;
  return data || [];
}

export async function getProfileById(id: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function listTechnicians(): Promise<Profile[]> {
  return listProfilesByRole('technician');
}

export async function listResponsible(): Promise<Profile[]> {
  return listProfilesByRole('responsible');
}

export async function listSupervisors(): Promise<Profile[]> {
  return listProfilesByRole('supervisor');
}
