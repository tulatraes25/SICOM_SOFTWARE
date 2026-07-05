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

export async function getCurrentUserProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !data) return null;

  return data as Profile;
}

export async function getProfileById(id: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;

  return data as Profile;
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
