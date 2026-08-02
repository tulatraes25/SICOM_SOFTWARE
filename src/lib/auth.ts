import { supabase } from '@/config/supabase';
import type { UserRole } from '@/types/roles';
import type { Profile } from '@/types/roles';

const VALID_ROLES: UserRole[] = ['admin', 'technician', 'supervisor', 'responsible'];

const ROLE_DASHBOARD_PATHS: Record<UserRole, string> = {
  admin: '/admin',
  technician: '/tecnico',
  supervisor: '/supervisor',
  responsible: '/responsable',
};

export function isValidRole(role: string): role is UserRole {
  return VALID_ROLES.includes(role as UserRole);
}

export function getRoleDashboardPath(role: UserRole): string {
  return ROLE_DASHBOARD_PATHS[role];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateProfile(data: unknown): Profile | null {
  if (!isRecord(data)) return null;
  const { id, email, full_name, role, active, created_at, updated_at,
    must_change_password, temporary_password_issued_at, password_changed_at } = data;
  if (typeof id !== 'string') return null;
  if (typeof email !== 'string') return null;
  if (typeof full_name !== 'string') return null;
  if (typeof role !== 'string' || !isValidRole(role)) return null;
  if (typeof active !== 'boolean') return null;
  if (typeof created_at !== 'string') return null;
  if (typeof updated_at !== 'string') return null;
  if (typeof must_change_password !== 'boolean') return null;
  if (temporary_password_issued_at !== null && typeof temporary_password_issued_at !== 'string') return null;
  if (password_changed_at !== null && typeof password_changed_at !== 'string') return null;
  return {
    id,
    email,
    full_name,
    role,
    phone: typeof data.phone === 'string' ? data.phone : undefined,
    active,
    created_at,
    updated_at,
    must_change_password,
    temporary_password_issued_at: temporary_password_issued_at as string | null,
    password_changed_at: password_changed_at as string | null,
  };
}

export async function getCurrentUserProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, phone, active, created_at, updated_at, must_change_password, temporary_password_issued_at, password_changed_at')
    .eq('id', user.id)
    .single();

  if (error || !data) return null;

  return validateProfile(data);
}

export async function getProfileById(id: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, phone, active, created_at, updated_at, must_change_password, temporary_password_issued_at, password_changed_at')
    .eq('id', id)
    .single();

  if (error || !data) return null;

  return validateProfile(data);
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  return { session, error };
}

export async function getUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
}
