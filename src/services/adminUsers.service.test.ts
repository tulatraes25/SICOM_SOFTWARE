import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { listUsers, getUser, createUser, updateUser, resetPassword, sendRecovery, createResponsible, getResponsibleAssignments, replaceResponsibleAssignments, getAdminUsersErrorMessage } from './adminUsers.service';

const { mockInvoke } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
}));

vi.mock('@/config/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    email: 'test@example.com',
    full_name: 'Test User',
    role: 'technician',
    active: true,
    created_at: '2026-01-01T00:00:00Z',
    last_sign_in_at: '2026-07-01T00:00:00Z',
    must_change_password: false,
    temporary_password_issued_at: null,
    password_changed_at: null,
    ...overrides,
  };
}

function userWithout(...keys: string[]) {
  const entries = Object.entries(makeUser()).filter(([k]) => !keys.includes(k));
  return Object.fromEntries(entries);
}

describe('listUsers', () => {
  it('devuelve usuarios válidos', async () => {
    mockInvoke.mockResolvedValue({ data: { users: [makeUser()] }, error: null });
    const result = await listUsers();
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('technician');
  });

  it('conserva must_change_password', async () => {
    mockInvoke.mockResolvedValue({ data: { users: [makeUser({ must_change_password: true })] }, error: null });
    const result = await listUsers();
    expect(result[0].must_change_password).toBe(true);
  });

  it('conserva las tres fechas', async () => {
    const user = makeUser({
      temporary_password_issued_at: '2026-07-01T00:00:00Z',
      password_changed_at: '2026-07-02T00:00:00Z',
    });
    mockInvoke.mockResolvedValue({ data: { users: [user] }, error: null });
    const result = await listUsers();
    expect(result[0].temporary_password_issued_at).toBe('2026-07-01T00:00:00Z');
    expect(result[0].password_changed_at).toBe('2026-07-02T00:00:00Z');
  });

  it('normaliza fechas ausentes a null', async () => {
    mockInvoke.mockResolvedValue({ data: { users: [userWithout('temporary_password_issued_at', 'password_changed_at', 'last_sign_in_at')] }, error: null });
    const result = await listUsers();
    expect(result[0].temporary_password_issued_at).toBeNull();
    expect(result[0].password_changed_at).toBeNull();
    expect(result[0].last_sign_in_at).toBeNull();
  });

  it('rechaza data null', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });
    await expect(listUsers()).rejects.toThrow('Respuesta de usuarios inválida');
  });

  it('rechaza users ausente', async () => {
    mockInvoke.mockResolvedValue({ data: {}, error: null });
    await expect(listUsers()).rejects.toThrow('Respuesta de usuarios inválida');
  });

  it('rechaza users no array', async () => {
    mockInvoke.mockResolvedValue({ data: { users: 'not-array' }, error: null });
    await expect(listUsers()).rejects.toThrow('Respuesta de usuarios inválida');
  });

  it('rechaza un usuario incompleto', async () => {
    mockInvoke.mockResolvedValue({ data: { users: [{ id: 'u1' }] }, error: null });
    await expect(listUsers()).rejects.toThrow('Respuesta de usuarios inválida');
  });

  it('rechaza role desconocido', async () => {
    mockInvoke.mockResolvedValue({ data: { users: [makeUser({ role: 'hacker' })] }, error: null });
    await expect(listUsers()).rejects.toThrow('Respuesta de usuarios inválida');
  });

  it('rechaza active string', async () => {
    mockInvoke.mockResolvedValue({ data: { users: [makeUser({ active: 'yes' })] }, error: null });
    await expect(listUsers()).rejects.toThrow('Respuesta de usuarios inválida');
  });

  it('rechaza must_change_password null', async () => {
    mockInvoke.mockResolvedValue({ data: { users: [makeUser({ must_change_password: null })] }, error: null });
    await expect(listUsers()).rejects.toThrow('Respuesta de usuarios inválida');
  });

  it('rechaza created_at number', async () => {
    mockInvoke.mockResolvedValue({ data: { users: [makeUser({ created_at: 123 })] }, error: null });
    await expect(listUsers()).rejects.toThrow('Respuesta de usuarios inválida');
  });

  it('rechaza last_sign_in_at objeto', async () => {
    mockInvoke.mockResolvedValue({ data: { users: [makeUser({ last_sign_in_at: {} })] }, error: null });
    await expect(listUsers()).rejects.toThrow('Respuesta de usuarios inválida');
  });

  it('rechaza temporary_password_issued_at array', async () => {
    mockInvoke.mockResolvedValue({ data: { users: [makeUser({ temporary_password_issued_at: [] })] }, error: null });
    await expect(listUsers()).rejects.toThrow('Respuesta de usuarios inválida');
  });

  it('rechaza password_changed_at boolean', async () => {
    mockInvoke.mockResolvedValue({ data: { users: [makeUser({ password_changed_at: true })] }, error: null });
    await expect(listUsers()).rejects.toThrow('Respuesta de usuarios inválida');
  });
});

describe('getUser', () => {
  it('devuelve usuario válido', async () => {
    mockInvoke.mockResolvedValue({ data: makeUser(), error: null });
    const result = await getUser('u1');
    expect(result.id).toBe('u1');
    expect(result.email).toBe('test@example.com');
  });

  it('rechaza respuesta inválida', async () => {
    mockInvoke.mockResolvedValue({ data: 'invalid', error: null });
    await expect(getUser('u1')).rejects.toThrow('Respuesta de usuario inválida');
  });

  it('rechaza created_at number', async () => {
    mockInvoke.mockResolvedValue({ data: makeUser({ created_at: 42 }), error: null });
    await expect(getUser('u1')).rejects.toThrow('Respuesta de usuario inválida');
  });

  it('rechaza last_sign_in_at array', async () => {
    mockInvoke.mockResolvedValue({ data: makeUser({ last_sign_in_at: [] }), error: null });
    await expect(getUser('u1')).rejects.toThrow('Respuesta de usuario inválida');
  });
});

describe('createUser', () => {
  it('acepta respuesta sin created_at ni last_sign_in_at', async () => {
    mockInvoke.mockResolvedValue({ data: userWithout('created_at', 'last_sign_in_at'), error: null });
    const result = await createUser({ email: 'a@b.com', password: '12345678', full_name: 'A', role: 'technician' });
    expect(result.created_at).toBeNull();
    expect(result.last_sign_in_at).toBeNull();
  });

  it('normaliza ambos a null', async () => {
    mockInvoke.mockResolvedValue({ data: makeUser({ created_at: undefined, last_sign_in_at: undefined }), error: null });
    const result = await createUser({ email: 'a@b.com', password: '12345678', full_name: 'A', role: 'technician' });
    expect(result.created_at).toBeNull();
    expect(result.last_sign_in_at).toBeNull();
  });

  it('conserva estado de contraseña temporal', async () => {
    mockInvoke.mockResolvedValue({
      data: makeUser({ must_change_password: true, temporary_password_issued_at: '2026-07-30T00:00:00Z' }),
      error: null,
    });
    const result = await createUser({ email: 'a@b.com', password: '12345678', full_name: 'A', role: 'responsible' });
    expect(result.must_change_password).toBe(true);
    expect(result.temporary_password_issued_at).toBe('2026-07-30T00:00:00Z');
  });

  it('rechaza created_at boolean', async () => {
    mockInvoke.mockResolvedValue({ data: makeUser({ created_at: true }), error: null });
    await expect(createUser({ email: 'a@b.com', password: '12345678', full_name: 'A', role: 'technician' })).rejects.toThrow('Respuesta de usuario inválida');
  });

  it('rechaza password_changed_at number', async () => {
    mockInvoke.mockResolvedValue({ data: makeUser({ password_changed_at: 999 }), error: null });
    await expect(createUser({ email: 'a@b.com', password: '12345678', full_name: 'A', role: 'technician' })).rejects.toThrow('Respuesta de usuario inválida');
  });
});

describe('updateUser', () => {
  it('acepta únicamente success true', async () => {
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
    await expect(updateUser('u1', { full_name: 'New' })).resolves.toBeUndefined();
  });

  it('rechaza success false', async () => {
    mockInvoke.mockResolvedValue({ data: { success: false }, error: null });
    await expect(updateUser('u1', {})).rejects.toThrow('Respuesta de operación inválida');
  });
});

describe('resetPassword', () => {
  it('rechaza success false', async () => {
    mockInvoke.mockResolvedValue({ data: { success: false }, error: null });
    await expect(resetPassword('u1', 'newpass123')).rejects.toThrow('Respuesta de operación inválida');
  });
});

describe('sendRecovery', () => {
  it('rechaza success ausente', async () => {
    mockInvoke.mockResolvedValue({ data: {}, error: null });
    await expect(sendRecovery('a@b.com')).rejects.toThrow('Respuesta de operación inválida');
  });
});

describe('errores', () => {
  it('error de invoke se propaga de forma legible', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('Red failed') });
    await expect(listUsers()).rejects.toThrow('Red failed');
  });

  it('data.error se propaga', async () => {
    mockInvoke.mockResolvedValue({ data: { error: 'No autenticado' }, error: null });
    await expect(listUsers()).rejects.toThrow('No autenticado');
  });

  it('valor desconocido usa el fallback controlado', () => {
    expect(getAdminUsersErrorMessage(42)).toBe('Error al gestionar usuarios');
    expect(getAdminUsersErrorMessage(null)).toBe('Error al gestionar usuarios');
    expect(getAdminUsersErrorMessage(undefined)).toBe('Error al gestionar usuarios');
  });

  it('getAdminUsersErrorMessage maneja string', () => {
    expect(getAdminUsersErrorMessage('fail')).toBe('fail');
  });

  it('getAdminUsersErrorMessage maneja objeto con message', () => {
    expect(getAdminUsersErrorMessage({ message: 'obj err' })).toBe('obj err');
  });
});

describe('createResponsible', () => {
  const params = { email: 'r@test.com', password: 'password1', full_name: 'Nuevo Responsable', elevator_ids: ['a1b2c3d4-e5f6-7890-abcd-ef1234567890'] };
  const successResponse = {
    user: makeUser({ id: 'r1', role: 'responsible', must_change_password: true, active: true }),
    assigned_elevator_ids: ['a1b2c3d4-e5f6-7890-abcd-ef1234567890'],
  };

  it('invoca admin-users con action create_responsible', async () => {
    mockInvoke.mockResolvedValue({ data: successResponse, error: null });
    await createResponsible(params);
    expect(mockInvoke).toHaveBeenCalledWith('admin-users', { body: { action: 'create_responsible', data: params } });
  });

  it('envía email, password, full_name y elevator_ids', async () => {
    mockInvoke.mockResolvedValue({ data: successResponse, error: null });
    await createResponsible(params);
    const body = mockInvoke.mock.calls[0][1].body;
    expect(body.data.email).toBe('r@test.com');
    expect(body.data.password).toBe('password1');
    expect(body.data.full_name).toBe('Nuevo Responsable');
    expect(body.data.elevator_ids).toEqual(params.elevator_ids);
  });

  it('devuelve usuario responsible', async () => {
    mockInvoke.mockResolvedValue({ data: successResponse, error: null });
    const result = await createResponsible(params);
    expect(result.user.role).toBe('responsible');
    expect(result.user.active).toBe(true);
    expect(result.user.must_change_password).toBe(true);
  });

  it('devuelve IDs asignados', async () => {
    mockInvoke.mockResolvedValue({ data: successResponse, error: null });
    const result = await createResponsible(params);
    expect(result.assigned_elevator_ids).toEqual(params.elevator_ids);
  });

  it('acepta IDs en distinto orden si el conjunto coincide', async () => {
    const ids = ['a', 'b', 'c'];
    mockInvoke.mockResolvedValue({ data: { user: makeUser({ role: 'responsible', must_change_password: true }), assigned_elevator_ids: ['c', 'a', 'b'] }, error: null });
    const result = await createResponsible({ email: 'r@test.com', password: 'password1', full_name: 'Test', elevator_ids: ids });
    expect(result.assigned_elevator_ids.sort()).toEqual(ids.sort());
  });

  it('conserva el orden exacto del array enviado', async () => {
    const ids = ['z', 'a', 'm'];
    mockInvoke.mockResolvedValue({ data: { user: makeUser({ role: 'responsible', must_change_password: true }), assigned_elevator_ids: ['z', 'a', 'm'] }, error: null });
    await createResponsible({ email: 'r@test.com', password: 'password1', full_name: 'Test', elevator_ids: ids });
    const sentBody = mockInvoke.mock.calls[0][1].body;
    expect(sentBody.data.elevator_ids).toEqual(['z', 'a', 'm']);
  });

  it('rechaza user ausente', async () => {
    mockInvoke.mockResolvedValue({ data: { assigned_elevator_ids: ['a'] }, error: null });
    await expect(createResponsible(params)).rejects.toThrow('Respuesta de creación de responsable inválida');
  });

  it('rechaza role distinto', async () => {
    mockInvoke.mockResolvedValue({ data: { user: makeUser({ role: 'technician' }), assigned_elevator_ids: ['a'] }, error: null });
    await expect(createResponsible(params)).rejects.toThrow('Respuesta de creación de responsable inválida');
  });

  it('rechaza must_change_password false', async () => {
    mockInvoke.mockResolvedValue({ data: { user: makeUser({ role: 'responsible', must_change_password: false }), assigned_elevator_ids: ['a'] }, error: null });
    await expect(createResponsible(params)).rejects.toThrow('Respuesta de creación de responsable inválida');
  });

  it('rechaza assigned_elevator_ids no array', async () => {
    mockInvoke.mockResolvedValue({ data: { user: makeUser({ role: 'responsible' }), assigned_elevator_ids: 'not-array' }, error: null });
    await expect(createResponsible(params)).rejects.toThrow('Respuesta de creación de responsable inválida');
  });

  it('rechaza ID no string', async () => {
    mockInvoke.mockResolvedValue({ data: { user: makeUser({ role: 'responsible' }), assigned_elevator_ids: [123] }, error: null });
    await expect(createResponsible(params)).rejects.toThrow('Respuesta de creación de responsable inválida');
  });

  it('rechaza entrada duplicada', async () => {
    await expect(createResponsible({ email: 'r@test.com', password: 'password1', full_name: 'Test', elevator_ids: ['a', 'a'] })).rejects.toThrow('No se permiten ascensores duplicados');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('rechaza respuesta duplicada', async () => {
    mockInvoke.mockResolvedValue({ data: { user: makeUser({ role: 'responsible', must_change_password: true }), assigned_elevator_ids: ['a', 'b', 'b'] }, error: null });
    await expect(createResponsible({ email: 'r@test.com', password: 'password1', full_name: 'Test', elevator_ids: ['a', 'b'] })).rejects.toThrow('Respuesta de creación de responsable inválida');
  });

  it('rechaza IDs faltantes', async () => {
    mockInvoke.mockResolvedValue({ data: { user: makeUser({ role: 'responsible', must_change_password: true }), assigned_elevator_ids: ['a'] }, error: null });
    await expect(createResponsible({ email: 'r@test.com', password: 'password1', full_name: 'Test', elevator_ids: ['a', 'b'] })).rejects.toThrow('Respuesta de creación de responsable inválida');
  });

  it('rechaza IDs adicionales', async () => {
    mockInvoke.mockResolvedValue({ data: { user: makeUser({ role: 'responsible', must_change_password: true }), assigned_elevator_ids: ['a', 'b', 'c'] }, error: null });
    await expect(createResponsible({ email: 'r@test.com', password: 'password1', full_name: 'Test', elevator_ids: ['a'] })).rejects.toThrow('Respuesta de creación de responsable inválida');
  });

  it('propaga data.error', async () => {
    mockInvoke.mockResolvedValue({ data: { error: 'Email ya existe' }, error: null });
    await expect(createResponsible(params)).rejects.toThrow('Email ya existe');
  });

  it('propaga error de invoke', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('Network fail') });
    await expect(createResponsible(params)).rejects.toThrow('Network fail');
  });

  it('ninguna respuesta expone la contraseña', async () => {
    mockInvoke.mockResolvedValue({ data: successResponse, error: null });
    const result = await createResponsible(params);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('password1');
  });
});

describe('getResponsibleAssignments', () => {
  const userId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const elev1 = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
  const elev2 = 'c3d4e5f6-a7b8-9012-cdef-123456789012';

  it('invokes admin-users with correct action and payload', async () => {
    mockInvoke.mockResolvedValue({
      data: { responsible_user_id: userId, assigned_elevator_ids: [elev1] },
      error: null,
    });
    await getResponsibleAssignments(userId);
    expect(mockInvoke).toHaveBeenCalledWith('admin-users', {
      body: { action: 'get_responsible_assignments', data: { responsible_user_id: userId } },
    });
  });

  it('accepts empty array result', async () => {
    mockInvoke.mockResolvedValue({
      data: { responsible_user_id: userId, assigned_elevator_ids: [] },
      error: null,
    });
    const result = await getResponsibleAssignments(userId);
    expect(result.assigned_elevator_ids).toEqual([]);
    expect(result.responsible_user_id).toBe(userId);
  });

  it('preserves order from response', async () => {
    mockInvoke.mockResolvedValue({
      data: { responsible_user_id: userId, assigned_elevator_ids: [elev2, elev1] },
      error: null,
    });
    const result = await getResponsibleAssignments(userId);
    expect(result.assigned_elevator_ids).toEqual([elev2, elev1]);
  });

  it('rejects data null', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });
    await expect(getResponsibleAssignments(userId)).rejects.toThrow('Respuesta de asignaciones inválida');
  });

  it('rejects responsible_user_id missing', async () => {
    mockInvoke.mockResolvedValue({
      data: { assigned_elevator_ids: [] },
      error: null,
    });
    await expect(getResponsibleAssignments(userId)).rejects.toThrow('Respuesta de asignaciones inválida');
  });

  it('rejects responsible_user_id different from requested', async () => {
    mockInvoke.mockResolvedValue({
      data: { responsible_user_id: 'd4e5f6a7-b8c9-0123-defa-234567890123', assigned_elevator_ids: [] },
      error: null,
    });
    await expect(getResponsibleAssignments(userId)).rejects.toThrow('Respuesta de asignaciones inválida');
  });

  it('rejects assigned_elevator_ids not array', async () => {
    mockInvoke.mockResolvedValue({
      data: { responsible_user_id: userId, assigned_elevator_ids: 'not-array' },
      error: null,
    });
    await expect(getResponsibleAssignments(userId)).rejects.toThrow('Respuesta de asignaciones inválida');
  });

  it('rejects element not string', async () => {
    mockInvoke.mockResolvedValue({
      data: { responsible_user_id: userId, assigned_elevator_ids: [123] },
      error: null,
    });
    await expect(getResponsibleAssignments(userId)).rejects.toThrow('Respuesta de asignaciones inválida');
  });

  it('rejects duplicates in response', async () => {
    mockInvoke.mockResolvedValue({
      data: { responsible_user_id: userId, assigned_elevator_ids: [elev1, elev1] },
      error: null,
    });
    await expect(getResponsibleAssignments(userId)).rejects.toThrow('Respuesta de asignaciones inválida');
  });

  it('propagates data.error', async () => {
    mockInvoke.mockResolvedValue({ data: { error: 'No autorizado' }, error: null });
    await expect(getResponsibleAssignments(userId)).rejects.toThrow('No autorizado');
  });

  it('propagates invoke error', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('Network fail') });
    await expect(getResponsibleAssignments(userId)).rejects.toThrow('Network fail');
  });

  it('con ID inválido no invoca Edge', async () => {
    await expect(getResponsibleAssignments('not-a-uuid')).rejects.toThrow();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('snapshot con responsible_user_id no UUID se rechaza', async () => {
    mockInvoke.mockResolvedValue({
      data: { responsible_user_id: 'not-a-uuid', assigned_elevator_ids: [elev1] },
      error: null,
    });
    await expect(getResponsibleAssignments(userId)).rejects.toThrow('Respuesta de asignaciones inválida');
  });

  it('snapshot con ascensor no UUID se rechaza', async () => {
    mockInvoke.mockResolvedValue({
      data: { responsible_user_id: userId, assigned_elevator_ids: ['not-a-uuid'] },
      error: null,
    });
    await expect(getResponsibleAssignments(userId)).rejects.toThrow('Respuesta de asignaciones inválida');
  });
});

describe('replaceResponsibleAssignments', () => {
  const userId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const elev1 = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
  const elev2 = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
  const elev3 = 'd4e5f6a7-b8c9-0123-defa-234567890123';

  function makeReplaceResponse(overrides: Record<string, unknown> = {}) {
    return {
      responsible_user_id: userId,
      previous_elevator_ids: [elev1],
      assigned_elevator_ids: [elev1, elev2],
      added_elevator_ids: [elev2],
      removed_elevator_ids: [],
      ...overrides,
    };
  }

  it('invokes admin-users with correct action and payload', async () => {
    const params = { responsible_user_id: userId, elevator_ids: [elev1, elev2], expected_current_elevator_ids: [elev1] };
    mockInvoke.mockResolvedValue({ data: makeReplaceResponse(), error: null });
    await replaceResponsibleAssignments(params);
    expect(mockInvoke).toHaveBeenCalledWith('admin-users', {
      body: { action: 'replace_responsible_assignments', data: params },
    });
  });

  it('does not modify params', async () => {
    const params = { responsible_user_id: userId, elevator_ids: [elev1, elev2], expected_current_elevator_ids: [elev1] };
    const elevatorIdsCopy = [...params.elevator_ids];
    const expectedCopy = [...params.expected_current_elevator_ids];
    mockInvoke.mockResolvedValue({ data: makeReplaceResponse(), error: null });
    await replaceResponsibleAssignments(params);
    expect(params.elevator_ids).toEqual(elevatorIdsCopy);
    expect(params.expected_current_elevator_ids).toEqual(expectedCopy);
  });

  it('accepts valid response', async () => {
    mockInvoke.mockResolvedValue({ data: makeReplaceResponse(), error: null });
    const result = await replaceResponsibleAssignments({
      responsible_user_id: userId,
      elevator_ids: [elev1, elev2],
      expected_current_elevator_ids: [elev1],
    });
    expect(result.responsible_user_id).toBe(userId);
    expect(result.previous_elevator_ids).toEqual([elev1]);
    expect(result.assigned_elevator_ids).toEqual([elev1, elev2]);
    expect(result.added_elevator_ids).toEqual([elev2]);
    expect(result.removed_elevator_ids).toEqual([]);
  });

  it('returns copies of arrays', async () => {
    const response = makeReplaceResponse();
    mockInvoke.mockResolvedValue({ data: response, error: null });
    const result = await replaceResponsibleAssignments({
      responsible_user_id: userId,
      elevator_ids: [elev1, elev2],
      expected_current_elevator_ids: [elev1],
    });
    expect(result.previous_elevator_ids).not.toBe(response.previous_elevator_ids);
    expect(result.assigned_elevator_ids).not.toBe(response.assigned_elevator_ids);
    expect(result.added_elevator_ids).not.toBe(response.added_elevator_ids);
    expect(result.removed_elevator_ids).not.toBe(response.removed_elevator_ids);
  });

  it('rejects elevator_ids empty before invoke', async () => {
    await expect(replaceResponsibleAssignments({
      responsible_user_id: userId,
      elevator_ids: [],
      expected_current_elevator_ids: [],
    })).rejects.toThrow('Debe seleccionar al menos un ascensor');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('rejects more than 100 elevator_ids before invoke', async () => {
    const manyIds = Array.from({ length: 101 }, (_, i) => {
      const hex = i.toString(16).padStart(12, '0');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-0000-0000-000000000000`;
    });
    await expect(replaceResponsibleAssignments({
      responsible_user_id: userId,
      elevator_ids: manyIds,
      expected_current_elevator_ids: [],
    })).rejects.toThrow('No se pueden asignar más de 100 ascensores');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('rejects elevator_ids duplicates before invoke', async () => {
    await expect(replaceResponsibleAssignments({
      responsible_user_id: userId,
      elevator_ids: [elev1, elev1],
      expected_current_elevator_ids: [],
    })).rejects.toThrow('No se permiten ascensores duplicados');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('accepts empty expected_current_elevator_ids', async () => {
    mockInvoke.mockResolvedValue({
      data: makeReplaceResponse({
        previous_elevator_ids: [],
        assigned_elevator_ids: [elev1],
        added_elevator_ids: [elev1],
        removed_elevator_ids: [],
      }),
      error: null,
    });
    const result = await replaceResponsibleAssignments({
      responsible_user_id: userId,
      elevator_ids: [elev1],
      expected_current_elevator_ids: [],
    });
    expect(result.previous_elevator_ids).toEqual([]);
    expect(result.added_elevator_ids).toEqual([elev1]);
  });

  it('rejects expected_current_elevator_ids duplicates', async () => {
    await expect(replaceResponsibleAssignments({
      responsible_user_id: userId,
      elevator_ids: [elev1],
      expected_current_elevator_ids: [elev2, elev2],
    })).rejects.toThrow('No se permiten ascensores duplicados');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('rejects data null', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });
    await expect(replaceResponsibleAssignments({
      responsible_user_id: userId,
      elevator_ids: [elev1],
      expected_current_elevator_ids: [],
    })).rejects.toThrow('Respuesta de actualización de asignaciones inválida');
  });

  it('rejects different responsible_user_id', async () => {
    mockInvoke.mockResolvedValue({
      data: makeReplaceResponse({ responsible_user_id: 'e5f6a7b8-c9d0-1234-efab-345678901234' }),
      error: null,
    });
    await expect(replaceResponsibleAssignments({
      responsible_user_id: userId,
      elevator_ids: [elev1, elev2],
      expected_current_elevator_ids: [elev1],
    })).rejects.toThrow('Respuesta de actualización de asignaciones inválida');
  });

  it('rejects missing arrays', async () => {
    mockInvoke.mockResolvedValue({
      data: { responsible_user_id: userId },
      error: null,
    });
    await expect(replaceResponsibleAssignments({
      responsible_user_id: userId,
      elevator_ids: [elev1],
      expected_current_elevator_ids: [],
    })).rejects.toThrow('Respuesta de actualización de asignaciones inválida');
  });

  it('rejects non-string elements', async () => {
    mockInvoke.mockResolvedValue({
      data: makeReplaceResponse({ assigned_elevator_ids: [123] }),
      error: null,
    });
    await expect(replaceResponsibleAssignments({
      responsible_user_id: userId,
      elevator_ids: [elev1, elev2],
      expected_current_elevator_ids: [elev1],
    })).rejects.toThrow('Respuesta de actualización de asignaciones inválida');
  });

  it('rejects duplicates in response arrays', async () => {
    mockInvoke.mockResolvedValue({
      data: makeReplaceResponse({ assigned_elevator_ids: [elev1, elev1] }),
      error: null,
    });
    await expect(replaceResponsibleAssignments({
      responsible_user_id: userId,
      elevator_ids: [elev1, elev2],
      expected_current_elevator_ids: [elev1],
    })).rejects.toThrow('Respuesta de actualización de asignaciones inválida');
  });

  it('rejects previous !== expected set', async () => {
    mockInvoke.mockResolvedValue({
      data: makeReplaceResponse({
        previous_elevator_ids: [elev1, elev2],
      }),
      error: null,
    });
    await expect(replaceResponsibleAssignments({
      responsible_user_id: userId,
      elevator_ids: [elev1, elev2],
      expected_current_elevator_ids: [elev1],
    })).rejects.toThrow('Respuesta de actualización de asignaciones inválida');
  });

  it('rejects assigned !== requested set', async () => {
    mockInvoke.mockResolvedValue({
      data: makeReplaceResponse({
        assigned_elevator_ids: [elev1],
        added_elevator_ids: [],
        removed_elevator_ids: [],
      }),
      error: null,
    });
    await expect(replaceResponsibleAssignments({
      responsible_user_id: userId,
      elevator_ids: [elev1, elev2],
      expected_current_elevator_ids: [elev1],
    })).rejects.toThrow('Respuesta de actualización de asignaciones inválida');
  });

  it('rejects incorrect added', async () => {
    mockInvoke.mockResolvedValue({
      data: makeReplaceResponse({
        added_elevator_ids: [],
        removed_elevator_ids: [],
      }),
      error: null,
    });
    await expect(replaceResponsibleAssignments({
      responsible_user_id: userId,
      elevator_ids: [elev1, elev2],
      expected_current_elevator_ids: [elev1],
    })).rejects.toThrow('Respuesta de actualización de asignaciones inválida');
  });

  it('rejects incorrect removed', async () => {
    mockInvoke.mockResolvedValue({
      data: makeReplaceResponse({
        previous_elevator_ids: [elev1, elev3],
        assigned_elevator_ids: [elev1, elev2],
        added_elevator_ids: [elev2],
        removed_elevator_ids: [],
      }),
      error: null,
    });
    await expect(replaceResponsibleAssignments({
      responsible_user_id: userId,
      elevator_ids: [elev1, elev2],
      expected_current_elevator_ids: [elev1, elev3],
    })).rejects.toThrow('Respuesta de actualización de asignaciones inválida');
  });

  it('accepts different order if sets match', async () => {
    mockInvoke.mockResolvedValue({
      data: makeReplaceResponse({
        previous_elevator_ids: [elev2, elev1],
        assigned_elevator_ids: [elev2, elev1, elev3],
        added_elevator_ids: [elev3],
        removed_elevator_ids: [],
      }),
      error: null,
    });
    const result = await replaceResponsibleAssignments({
      responsible_user_id: userId,
      elevator_ids: [elev1, elev2, elev3],
      expected_current_elevator_ids: [elev1, elev2],
    });
    expect(result.assigned_elevator_ids.sort()).toEqual([elev1, elev2, elev3].sort());
    expect(result.previous_elevator_ids.sort()).toEqual([elev1, elev2].sort());
  });

  it('propagates data.error', async () => {
    mockInvoke.mockResolvedValue({ data: { error: 'Conflicto de versión' }, error: null });
    await expect(replaceResponsibleAssignments({
      responsible_user_id: userId,
      elevator_ids: [elev1],
      expected_current_elevator_ids: [],
    })).rejects.toThrow('Conflicto de versión');
  });

  it('propagates invoke error', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('Timeout') });
    await expect(replaceResponsibleAssignments({
      responsible_user_id: userId,
      elevator_ids: [elev1],
      expected_current_elevator_ids: [],
    })).rejects.toThrow('Timeout');
  });

  it('elevator_ids vacío usa mensaje exacto "Debe seleccionar al menos un ascensor"', async () => {
    await expect(replaceResponsibleAssignments({
      responsible_user_id: userId,
      elevator_ids: [],
      expected_current_elevator_ids: [],
    })).rejects.toThrow('Debe seleccionar al menos un ascensor');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('elevator_ids >100 usa mensaje exacto "No se pueden asignar más de 100 ascensores"', async () => {
    const manyIds = Array.from({ length: 101 }, (_, i) => {
      const hex = i.toString(16).padStart(12, '0');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-0000-0000-000000000000`;
    });
    await expect(replaceResponsibleAssignments({
      responsible_user_id: userId,
      elevator_ids: manyIds,
      expected_current_elevator_ids: [],
    })).rejects.toThrow('No se pueden asignar más de 100 ascensores');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('elevator_ids no array usa mensaje exacto "Debe seleccionar al menos un ascensor"', async () => {
    const callWith = (elevatorIds: unknown) =>
      replaceResponsibleAssignments({
        responsible_user_id: userId,
        elevator_ids: elevatorIds as string[],
        expected_current_elevator_ids: [],
      });
    await expect(callWith('not-array')).rejects.toThrow('Debe seleccionar al menos un ascensor');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('expected no array usa mensaje exacto "expected_current_elevator_ids es obligatorio"', async () => {
    const callWith = (expected: unknown) =>
      replaceResponsibleAssignments({
        responsible_user_id: userId,
        elevator_ids: [elev1],
        expected_current_elevator_ids: expected as string[],
      });
    await expect(callWith('not-array')).rejects.toThrow('expected_current_elevator_ids es obligatorio');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('expected >100 usa "La selección de ascensores es inválida"', async () => {
    const manyIds = Array.from({ length: 101 }, (_, i) => {
      const hex = i.toString(16).padStart(12, '0');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-0000-0000-000000000000`;
    });
    await expect(replaceResponsibleAssignments({
      responsible_user_id: userId,
      elevator_ids: [elev1],
      expected_current_elevator_ids: manyIds,
    })).rejects.toThrow('La selección de ascensores es inválida');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('no aparece "elemento(s)" en mensaje de elevator_ids vacío', async () => {
    let message = '';
    try {
      await replaceResponsibleAssignments({
        responsible_user_id: userId,
        elevator_ids: [],
        expected_current_elevator_ids: [],
      });
    } catch (error: unknown) {
      if (error instanceof Error) message = error.message;
    }
    expect(message).toBeTruthy();
    expect(message).not.toContain('elemento(s)');
  });

  it('no aparece "No puede contener más de" en mensaje de elevator_ids >100', async () => {
    const manyIds = Array.from({ length: 101 }, (_, i) => {
      const hex = i.toString(16).padStart(12, '0');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-0000-0000-000000000000`;
    });
    let message = '';
    try {
      await replaceResponsibleAssignments({
        responsible_user_id: userId,
        elevator_ids: manyIds,
        expected_current_elevator_ids: [],
      });
    } catch (error: unknown) {
      if (error instanceof Error) message = error.message;
    }
    expect(message).toBeTruthy();
    expect(message).not.toContain('No puede contener más de');
  });

  it('respuesta replace con ID no UUID se rechaza en cada array', async () => {
    const arrayKeys = ['previous_elevator_ids', 'assigned_elevator_ids', 'added_elevator_ids', 'removed_elevator_ids'] as const;
    for (const key of arrayKeys) {
      mockInvoke.mockResolvedValue({
        data: makeReplaceResponse({ [key]: ['not-a-uuid'] }),
        error: null,
      });
      await expect(replaceResponsibleAssignments({
        responsible_user_id: userId,
        elevator_ids: [elev1],
        expected_current_elevator_ids: [],
      })).rejects.toThrow('Respuesta de actualización de asignaciones inválida');
    }
  });

  it('parámetros continúan sin mutarse', async () => {
    const elevatorIds = [elev1, elev2];
    const expectedIds = [elev1];
    const params = {
      responsible_user_id: userId,
      elevator_ids: elevatorIds,
      expected_current_elevator_ids: expectedIds,
    };
    mockInvoke.mockResolvedValue({ data: makeReplaceResponse(), error: null });
    await replaceResponsibleAssignments(params);
    expect(params.responsible_user_id).toBe(userId);
    expect(params.elevator_ids).toBe(elevatorIds);
    expect(params.expected_current_elevator_ids).toBe(expectedIds);
    expect(params.elevator_ids).toEqual([elev1, elev2]);
    expect(params.expected_current_elevator_ids).toEqual([elev1]);
  });
});

describe('FunctionsHttpError extraction', () => {
  function makeHttpError(body: unknown, status = 409): FunctionsHttpError {
    const response = new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    return new FunctionsHttpError(response);
  }

  it('FunctionsHttpError con body JSON y propiedad error devuelve el mensaje exacto', async () => {
    const MSG = 'Antes de desactivar este responsable, reasigná sus ascensores a otro responsable.';
    mockInvoke.mockResolvedValue({ data: null, error: makeHttpError({ error: MSG }) });
    await expect(updateUser('u1', { active: false })).rejects.toThrow(MSG);
  });

  it('updateUser propaga el mensaje exacto del HTTP 409', async () => {
    const MSG = 'Antes de desactivar este responsable, reasigná sus ascensores a otro responsable.';
    mockInvoke.mockResolvedValue({ data: null, error: makeHttpError({ error: MSG }) });
    try {
      await updateUser('u1', { active: false });
      expect.fail('should have thrown');
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(Error);
      expect((e as Error).message).toBe(MSG);
    }
  });

  it('FunctionsHttpError con JSON sin error usa fallback', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: makeHttpError({ details: 'something' }) });
    await expect(updateUser('u1', { active: false })).rejects.toThrow('Edge Function returned a non-2xx status code');
  });

  it('FunctionsHttpError con body no JSON usa fallback', async () => {
    const response = new Response('not json', { status: 500 });
    const err = new FunctionsHttpError(response);
    mockInvoke.mockResolvedValue({ data: null, error: err });
    await expect(updateUser('u1', { active: false })).rejects.toThrow('Edge Function returned a non-2xx status code');
  });

  it('FunctionsHttpError con error vacío usa fallback', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: makeHttpError({ error: '' }) });
    await expect(updateUser('u1', { active: false })).rejects.toThrow('Edge Function returned a non-2xx status code');
  });

  it('Error normal conserva error.message', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('custom msg') });
    await expect(updateUser('u1', { active: false })).rejects.toThrow('custom msg');
  });

  it('error string conserva el texto', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: 'string error' });
    await expect(updateUser('u1', { active: false })).rejects.toThrow('string error');
  });

  it('error desconocido devuelve mensaje genérico', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: 42 });
    await expect(updateUser('u1', { active: false })).rejects.toThrow('Error al gestionar usuarios');
  });

  it('no expone details ni hint ni stack', async () => {
    const MSG = 'Antes de desactivar este responsable, reasigná sus ascensores a otro responsable.';
    mockInvoke.mockResolvedValue({ data: null, error: makeHttpError({ error: MSG, details: 'internal', hint: 'none' }) });
    try {
      await updateUser('u1', { active: false });
      expect.fail('should have thrown');
    } catch (e: unknown) {
      const msg = (e as Error).message;
      expect(msg).not.toContain('details');
      expect(msg).not.toContain('hint');
      expect(msg).not.toContain('stack');
    }
  });

  it('el body de error se lee una sola vez', async () => {
    const MSG = 'test message';
    const jsonFn = vi.fn().mockResolvedValue({ error: MSG });
    const response = new Response(null);
    Object.defineProperty(response, 'json', { value: jsonFn });
    const err = new FunctionsHttpError(response);
    mockInvoke.mockResolvedValue({ data: null, error: err });
    await expect(updateUser('u1', { active: false })).rejects.toThrow(MSG);
    expect(jsonFn).toHaveBeenCalledTimes(1);
  });
});
