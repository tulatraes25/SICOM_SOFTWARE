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

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface SendBudgetEmailParams {
  budgetId: string;
  recipients: EmailRecipient[];
  subject: string;
  body: string;
  pdfBase64?: string;
  pdfFilename?: string;
}

export interface SendBudgetEmailResult {
  success: number;
  failed: number;
  mock: boolean;
  results: Array<{ email: string; name?: string; status: string; provider_message_id?: string; error?: string }>;
}

export async function sendBudgetEmails(params: SendBudgetEmailParams): Promise<SendBudgetEmailResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const { data, error } = await supabase.functions.invoke('send-budget-email', {
    body: {
      budget_id: params.budgetId,
      recipients: params.recipients,
      subject: params.subject,
      body: params.body,
      pdf_base64: params.pdfBase64 || null,
      pdf_filename: params.pdfFilename || 'presupuesto.pdf',
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  return data;
}
