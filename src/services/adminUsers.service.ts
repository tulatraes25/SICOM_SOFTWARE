import { supabase } from '@/config/supabase';

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  active: boolean;
  created_at: string;
  last_sign_in_at?: string;
}

export async function listUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { action: 'list_users' },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.users || [];
}

export async function getUser(userId: string): Promise<AdminUser> {
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { action: 'get_user', data: { user_id: userId } },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function createUser(params: {
  email: string; password: string; full_name: string; role: string; active?: boolean;
}): Promise<AdminUser> {
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { action: 'create_user', data: params },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function updateUser(userId: string, updates: {
  full_name?: string; role?: string; active?: boolean;
}): Promise<void> {
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { action: 'update_user', data: { user_id: userId, ...updates } },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function resetPassword(userId: string, newPassword: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { action: 'reset_password', data: { user_id: userId, new_password: newPassword } },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function sendRecovery(email: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { action: 'send_recovery', data: { email } },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}
