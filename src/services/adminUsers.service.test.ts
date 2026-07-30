import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listUsers, getUser, createUser, updateUser, resetPassword, sendRecovery, getAdminUsersErrorMessage } from './adminUsers.service';

const mockInvoke = vi.fn();

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
    const user = makeUser();
    delete (user as Record<string, unknown>).temporary_password_issued_at;
    delete (user as Record<string, unknown>).password_changed_at;
    delete (user as Record<string, unknown>).last_sign_in_at;
    mockInvoke.mockResolvedValue({ data: { users: [user] }, error: null });
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
    await expect(listUsers()).rejects.toThrow('Respuesta de usuario inválida');
  });

  it('rechaza role desconocido', async () => {
    mockInvoke.mockResolvedValue({ data: { users: [makeUser({ role: 'hacker' })] }, error: null });
    await expect(listUsers()).rejects.toThrow('Respuesta de usuario inválida');
  });

  it('rechaza active string', async () => {
    mockInvoke.mockResolvedValue({ data: { users: [makeUser({ active: 'yes' })] }, error: null });
    await expect(listUsers()).rejects.toThrow('Respuesta de usuario inválida');
  });

  it('rechaza must_change_password null', async () => {
    mockInvoke.mockResolvedValue({ data: { users: [makeUser({ must_change_password: null })] }, error: null });
    await expect(listUsers()).rejects.toThrow('Respuesta de usuario inválida');
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
});

describe('createUser', () => {
  it('acepta respuesta sin created_at ni last_sign_in_at', async () => {
    const user = makeUser();
    delete (user as Record<string, unknown>).created_at;
    delete (user as Record<string, unknown>).last_sign_in_at;
    mockInvoke.mockResolvedValue({ data: user, error: null });
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
