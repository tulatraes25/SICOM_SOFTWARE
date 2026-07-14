import { supabase } from '@/config/supabase';
import type { BudgetEmailSend } from '@/types/database';

export async function listBudgetEmailSends(budgetId: string): Promise<BudgetEmailSend[]> {
  const { data, error } = await supabase
    .from('budget_email_sends')
    .select(`
      *,
      sender:profiles!budget_email_sends_sent_by_fkey(full_name)
    `)
    .eq('budget_id', budgetId)
    .order('sent_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function sendBudgetEmail(
  budgetId: string,
  recipientEmail: string,
  recipientName?: string,
  subject?: string,
  body?: string
): Promise<BudgetEmailSend> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  // Call Edge Function
  const { data, error } = await supabase.functions.invoke('send-budget-email', {
    body: {
      budget_id: budgetId,
      recipient_email: recipientEmail,
      recipient_name: recipientName,
      subject,
      body,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  return data;
}

export async function getBudgetRecipients(buildingId: string): Promise<Array<{ id: string; name: string; email: string }>> {
  const { data, error } = await supabase
    .from('building_report_recipients')
    .select('id, name, email')
    .eq('building_id', buildingId)
    .eq('active', true);

  if (error) throw error;
  return data || [];
}
