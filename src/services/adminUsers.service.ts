import { supabase } from '@/config/supabase';

export type AdminUserRole = 'admin' | 'supervisor' | 'technician' | 'responsible';

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: AdminUserRole;
  active: boolean;
  created_at: string | null;
  last_sign_in_at: string | null;
  must_change_password: boolean;
  temporary_password_issued_at: string | null;
  password_changed_at: string | null;
}

const VALID_ROLES: readonly string[] = ['admin', 'supervisor', 'technician', 'responsible'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAdminUserRole(value: unknown): value is AdminUserRole {
  return typeof value === 'string' && (VALID_ROLES as readonly string[]).includes(value);
}

function requireNullableString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value;
  throw new Error('Respuesta de usuario inválida');
}

function parseAdminUser(value: unknown): AdminUser {
  if (!isRecord(value)) throw new Error('Respuesta de usuario inválida');

  const { id, email, full_name, role, active, created_at, last_sign_in_at,
    must_change_password, temporary_password_issued_at, password_changed_at } = value;

  if (typeof id !== 'string') throw new Error('Respuesta de usuario inválida');
  if (typeof email !== 'string') throw new Error('Respuesta de usuario inválida');
  if (typeof full_name !== 'string') throw new Error('Respuesta de usuario inválida');
  if (!isAdminUserRole(role)) throw new Error('Respuesta de usuario inválida');
  if (typeof active !== 'boolean') throw new Error('Respuesta de usuario inválida');
  if (typeof must_change_password !== 'boolean') throw new Error('Respuesta de usuario inválida');

  return {
    id,
    email,
    full_name,
    role,
    active,
    created_at: requireNullableString(created_at),
    last_sign_in_at: requireNullableString(last_sign_in_at),
    must_change_password,
    temporary_password_issued_at: requireNullableString(temporary_password_issued_at),
    password_changed_at: requireNullableString(password_changed_at),
  };
}

function parseSuccessResponse(data: unknown): void {
  if (!isRecord(data)) throw new Error('Respuesta de operación inválida');
  if (data.success !== true) throw new Error('Respuesta de operación inválida');
}

export function getAdminUsersErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (isRecord(error) && typeof error.message === 'string') return error.message;
  return 'Error al gestionar usuarios';
}

export async function listUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { action: 'list_users' },
  });
  if (error) throw new Error(getAdminUsersErrorMessage(error));
  if (isRecord(data) && typeof data.error === 'string' && data.error) {
    throw new Error(data.error);
  }
  if (!isRecord(data) || !Array.isArray(data.users)) {
    throw new Error('Respuesta de usuarios inválida');
  }
  try {
    return data.users.map((u: unknown) => parseAdminUser(u));
  } catch {
    throw new Error('Respuesta de usuarios inválida');
  }
}

export async function getUser(userId: string): Promise<AdminUser> {
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { action: 'get_user', data: { user_id: userId } },
  });
  if (error) throw new Error(getAdminUsersErrorMessage(error));
  if (isRecord(data) && typeof data.error === 'string' && data.error) {
    throw new Error(data.error);
  }
  return parseAdminUser(data);
}

export async function createUser(params: {
  email: string; password: string; full_name: string; role: AdminUserRole; active?: boolean;
}): Promise<AdminUser> {
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { action: 'create_user', data: params },
  });
  if (error) throw new Error(getAdminUsersErrorMessage(error));
  if (isRecord(data) && typeof data.error === 'string' && data.error) {
    throw new Error(data.error);
  }
  return parseAdminUser(data);
}

export async function updateUser(userId: string, updates: {
  full_name?: string; role?: AdminUserRole; active?: boolean;
}): Promise<void> {
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { action: 'update_user', data: { user_id: userId, ...updates } },
  });
  if (error) throw new Error(getAdminUsersErrorMessage(error));
  if (isRecord(data) && typeof data.error === 'string' && data.error) {
    throw new Error(data.error);
  }
  parseSuccessResponse(data);
}

export async function resetPassword(userId: string, newPassword: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { action: 'reset_password', data: { user_id: userId, new_password: newPassword } },
  });
  if (error) throw new Error(getAdminUsersErrorMessage(error));
  if (isRecord(data) && typeof data.error === 'string' && data.error) {
    throw new Error(data.error);
  }
  parseSuccessResponse(data);
}

export async function sendRecovery(email: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { action: 'send_recovery', data: { email } },
  });
  if (error) throw new Error(getAdminUsersErrorMessage(error));
  if (isRecord(data) && typeof data.error === 'string' && data.error) {
    throw new Error(data.error);
  }
  parseSuccessResponse(data);
}
