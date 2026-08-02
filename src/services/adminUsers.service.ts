import { supabase } from '@/config/supabase';
import { FunctionsHttpError } from '@supabase/supabase-js';

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

async function getAdminUsersInvokeErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body: unknown = await error.context.json();
      if (isRecord(body) && typeof body.error === 'string' && body.error) {
        return body.error;
      }
    } catch {
      // body is not JSON or json() failed — fall through
    }
  }
  return getAdminUsersErrorMessage(error);
}

export async function listUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { action: 'list_users' },
  });
  if (error) throw new Error(await getAdminUsersInvokeErrorMessage(error));
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
  if (error) throw new Error(await getAdminUsersInvokeErrorMessage(error));
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
  if (error) throw new Error(await getAdminUsersInvokeErrorMessage(error));
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
  if (error) throw new Error(await getAdminUsersInvokeErrorMessage(error));
  if (isRecord(data) && typeof data.error === 'string' && data.error) {
    throw new Error(data.error);
  }
  parseSuccessResponse(data);
}

export async function resetPassword(userId: string, newPassword: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { action: 'reset_password', data: { user_id: userId, new_password: newPassword } },
  });
  if (error) throw new Error(await getAdminUsersInvokeErrorMessage(error));
  if (isRecord(data) && typeof data.error === 'string' && data.error) {
    throw new Error(data.error);
  }
  parseSuccessResponse(data);
}

export async function sendRecovery(email: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { action: 'send_recovery', data: { email } },
  });
  if (error) throw new Error(await getAdminUsersInvokeErrorMessage(error));
  if (isRecord(data) && typeof data.error === 'string' && data.error) {
    throw new Error(data.error);
  }
  parseSuccessResponse(data);
}

export interface CreateResponsibleParams {
  email: string;
  password: string;
  full_name: string;
  elevator_ids: string[];
}

export interface CreateResponsibleResult {
  user: AdminUser;
  assigned_elevator_ids: string[];
}

export interface ResponsibleAssignmentsSnapshot {
  responsible_user_id: string;
  assigned_elevator_ids: string[];
}

export interface ReplaceResponsibleAssignmentsParams {
  responsible_user_id: string;
  elevator_ids: string[];
  expected_current_elevator_ids: string[];
}

export interface ReplaceResponsibleAssignmentsResult {
  responsible_user_id: string;
  previous_elevator_ids: string[];
  assigned_elevator_ids: string[];
  added_elevator_ids: string[];
  removed_elevator_ids: string[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

function validateElevatorIds(value: unknown): string[] | never {
  if (!Array.isArray(value)) throw new Error('Debe seleccionar al menos un ascensor');
  if (value.length < 1) throw new Error('Debe seleccionar al menos un ascensor');
  if (value.length > 100) throw new Error('No se pueden asignar más de 100 ascensores');
  const ids: string[] = [];
  for (const item of value) {
    if (!isValidUuid(item)) throw new Error('La selección de ascensores es inválida');
    ids.push(item);
  }
  if (new Set(ids).size !== ids.length) throw new Error('No se permiten ascensores duplicados');
  return ids;
}

function validateExpectedIds(value: unknown): string[] | never {
  if (!Array.isArray(value)) throw new Error('expected_current_elevator_ids es obligatorio');
  if (value.length > 100) throw new Error('La selección de ascensores es inválida');
  const ids: string[] = [];
  for (const item of value) {
    if (!isValidUuid(item)) throw new Error('La selección de ascensores es inválida');
    ids.push(item);
  }
  if (new Set(ids).size !== ids.length) throw new Error('No se permiten ascensores duplicados');
  return ids;
}

function setEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  return b.every((id) => sa.has(id));
}

function setDiff(from: string[], against: string[]): string[] {
  const s = new Set(against);
  return [...from].filter((id) => !s.has(id)).sort();
}

export async function createResponsible(params: CreateResponsibleParams): Promise<CreateResponsibleResult> {
  if (new Set(params.elevator_ids).size !== params.elevator_ids.length) {
    throw new Error('No se permiten ascensores duplicados');
  }
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { action: 'create_responsible', data: params },
  });
  if (error) throw new Error(await getAdminUsersInvokeErrorMessage(error));
  if (isRecord(data) && typeof data.error === 'string' && data.error) {
    throw new Error(data.error);
  }
  if (!isRecord(data) || !isRecord(data.user) || !Array.isArray(data.assigned_elevator_ids)) {
    throw new Error('Respuesta de creación de responsable inválida');
  }
  const user = parseAdminUser(data.user);
  if (user.role !== 'responsible') throw new Error('Respuesta de creación de responsable inválida');
  if (user.active !== true) throw new Error('Respuesta de creación de responsable inválida');
  if (user.must_change_password !== true) throw new Error('Respuesta de creación de responsable inválida');
  const ids = data.assigned_elevator_ids;
  if (!ids.every((id: unknown) => typeof id === 'string')) {
    throw new Error('Respuesta de creación de responsable inválida');
  }
  const idsStr = ids as string[];
  if (new Set(idsStr).size !== idsStr.length) {
    throw new Error('Respuesta de creación de responsable inválida');
  }
  const paramSorted = [...params.elevator_ids].sort();
  const respSorted = [...idsStr].sort();
  if (paramSorted.length !== respSorted.length || paramSorted.some((id, i) => id !== respSorted[i])) {
    throw new Error('Respuesta de creación de responsable inválida');
  }
  return { user, assigned_elevator_ids: [...idsStr] };
}

export async function getResponsibleAssignments(
  responsibleUserId: string,
): Promise<ResponsibleAssignmentsSnapshot> {
  if (!isValidUuid(responsibleUserId)) {
    throw new Error('responsible_user_id es obligatorio');
  }
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { action: 'get_responsible_assignments', data: { responsible_user_id: responsibleUserId } },
  });
  if (error) throw new Error(await getAdminUsersInvokeErrorMessage(error));
  if (isRecord(data) && typeof data.error === 'string' && data.error) {
    throw new Error(data.error);
  }
  if (!isRecord(data) || typeof data.responsible_user_id !== 'string') {
    throw new Error('Respuesta de asignaciones inválida');
  }
  if (data.responsible_user_id !== responsibleUserId) {
    throw new Error('Respuesta de asignaciones inválida');
  }
  if (!Array.isArray(data.assigned_elevator_ids)) {
    throw new Error('Respuesta de asignaciones inválida');
  }
  const ids = data.assigned_elevator_ids;
  if (!ids.every((id) => isValidUuid(id))) {
    throw new Error('Respuesta de asignaciones inválida');
  }
  const idsStr = ids as string[];
  if (new Set(idsStr).size !== idsStr.length) {
    throw new Error('Respuesta de asignaciones inválida');
  }
  return { responsible_user_id: data.responsible_user_id, assigned_elevator_ids: [...idsStr] };
}

export async function replaceResponsibleAssignments(
  params: ReplaceResponsibleAssignmentsParams,
): Promise<ReplaceResponsibleAssignmentsResult> {
  if (!isValidUuid(params.responsible_user_id)) {
    throw new Error('responsible_user_id es obligatorio');
  }
  validateElevatorIds(params.elevator_ids);
  validateExpectedIds(params.expected_current_elevator_ids);

  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { action: 'replace_responsible_assignments', data: params },
  });
  if (error) throw new Error(await getAdminUsersInvokeErrorMessage(error));
  if (isRecord(data) && typeof data.error === 'string' && data.error) {
    throw new Error(data.error);
  }
  if (!isRecord(data) || typeof data.responsible_user_id !== 'string') {
    throw new Error('Respuesta de actualización de asignaciones inválida');
  }
  if (data.responsible_user_id !== params.responsible_user_id) {
    throw new Error('Respuesta de actualización de asignaciones inválida');
  }

  const arrays = ['previous_elevator_ids', 'assigned_elevator_ids', 'added_elevator_ids', 'removed_elevator_ids'] as const;
  for (const key of arrays) {
    if (!Array.isArray(data[key])) {
      throw new Error('Respuesta de actualización de asignaciones inválida');
    }
    const arr = data[key] as unknown[];
    if (!arr.every((id) => isValidUuid(id))) {
      throw new Error('Respuesta de actualización de asignaciones inválida');
    }
    if (new Set(arr as string[]).size !== arr.length) {
      throw new Error('Respuesta de actualización de asignaciones inválida');
    }
  }

  const previous = data.previous_elevator_ids as string[];
  const assigned = data.assigned_elevator_ids as string[];
  const added = data.added_elevator_ids as string[];
  const removed = data.removed_elevator_ids as string[];

  if (!setEqual(assigned, params.elevator_ids)) {
    throw new Error('Respuesta de actualización de asignaciones inválida');
  }
  if (!setEqual(previous, params.expected_current_elevator_ids)) {
    throw new Error('Respuesta de actualización de asignaciones inválida');
  }

  const expectedAdded = setDiff(assigned, previous);
  const expectedRemoved = setDiff(previous, assigned);
  if (!setEqual(added, expectedAdded) || !setEqual(removed, expectedRemoved)) {
    throw new Error('Respuesta de actualización de asignaciones inválida');
  }

  return {
    responsible_user_id: data.responsible_user_id,
    previous_elevator_ids: [...previous],
    assigned_elevator_ids: [...assigned],
    added_elevator_ids: [...added],
    removed_elevator_ids: [...removed],
  };
}
