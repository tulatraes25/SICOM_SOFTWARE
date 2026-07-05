import { supabase } from '@/config/supabase';

export interface AuditLogEntry {
  action: string;
  entity_type: string;
  entity_id?: string;
  old_data?: Record<string, unknown>;
  new_data?: Record<string, unknown>;
}

export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('audit_logs')
    .insert({
      user_id: user?.id,
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      old_data: entry.old_data,
      new_data: entry.new_data,
      user_agent: navigator.userAgent,
    });

  if (error) {
    console.error('Error creating audit log:', error);
  }
}
