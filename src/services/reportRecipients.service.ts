import { supabase } from '@/config/supabase';
import type { ReportRecipient } from '@/types/database';

export async function listRecipientsByElevator(elevatorId: string): Promise<ReportRecipient[]> {
  const { data, error } = await supabase
    .from('report_recipients')
    .select('*')
    .eq('elevator_id', elevatorId)
    .order('name');

  if (error) throw error;
  return data || [];
}

export async function getRecipientById(id: string): Promise<ReportRecipient | null> {
  const { data, error } = await supabase
    .from('report_recipients')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createRecipient(recipient: Omit<ReportRecipient, 'id' | 'created_at'>): Promise<ReportRecipient> {
  const { data, error } = await supabase
    .from('report_recipients')
    .insert(recipient)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateRecipient(id: string, updates: Partial<ReportRecipient>): Promise<ReportRecipient> {
  const { data, error } = await supabase
    .from('report_recipients')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deactivateRecipient(id: string): Promise<void> {
  const { error } = await supabase
    .from('report_recipients')
    .update({ active: false })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteRecipient(id: string): Promise<void> {
  const { error } = await supabase
    .from('report_recipients')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
