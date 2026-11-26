// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import { describe, expect, it, vi } from 'vitest';

// Execute the production Edge Function, replacing only the two Deno URL imports
// with injected transports. These tests exercise its handler, not copied logic.
const source = readFileSync(resolve(__dirname, '../../supabase/functions/admin-users/index.ts'), 'utf8');
const executable = transpileModule(source.replace(/^import .* from "https:\/\/.*";\r?\n/gm, ''), {
  compilerOptions: { module: ModuleKind.None, target: ScriptTarget.ES2022 },
}).outputText;

const defaultData = {
  full_name: 'Persona de prueba', email: 'person@example.test', password: 'Example-password-42', role: 'technician',
};

function setup(caller: { role: string; active: boolean } = { role: 'admin', active: true }) {
  let nextId = 0;
  const createUser = vi.fn(async (data: Record<string, unknown>): Promise<{
    data: { user: { id: string; email: unknown } | null }; error: unknown;
  }> => ({ data: { user: { id: `created-${++nextId}`, email: data.email } }, error: null }));
  const deleteUser = vi.fn().mockResolvedValue({ error: null });
  const listUsers = vi.fn().mockResolvedValue({ data: { users: [] }, error: null });
  const getUser = vi.fn().mockResolvedValue({ data: { user: { id: 'caller' } }, error: null });
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const insert = vi.fn().mockResolvedValue({ error: null });
  const profilesIn = vi.fn(async (_column: string, ids: string[]) => ({
    data: ids.map((id) => ({ id, role: 'technician', full_name: id, active: true })), error: null as unknown,
  }));
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: 'caller', ...caller }, error: null }),
    in: profilesIn, upsert, insert,
  };
  const from = vi.fn(() => query);
  const log = vi.fn();
  let handler: ((req: Request) => Promise<Response>) | undefined;
  runInNewContext(executable, {
    serve: (callback: typeof handler) => { handler = callback; },
    createClient: () => ({ auth: { getUser, admin: { createUser, deleteUser, listUsers } }, from }),
    Deno: { env: { get: () => 'test-configuration' } },
    Response, Request, Headers, console: { error: log },
  });
  if (!handler) throw new Error('The Edge Function did not register a handler');
  const invoke = (body: unknown, authorization: string | null = 'Bearer test-session') => {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (authorization) headers.Authorization = authorization;
    return handler!(new Request('http://localhost/admin-users', { method: 'POST', headers, body: JSON.stringify(body) }));
  };
  return { invoke, createUser, deleteUser, listUsers, getUser, upsert, insert, profilesIn, log };
}

describe('admin-users actual handler — account creation', () => {
  it('an active admin can create another administrator', async () => {
    const app = setup();
    const response = await app.invoke({ action: 'create_user', data: { ...defaultData, role: 'admin' } });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ role: 'admin', active: true, email: defaultData.email });
    expect(app.createUser).toHaveBeenCalledWith(expect.objectContaining({ user_metadata: { full_name: defaultData.full_name, role: 'admin' } }));
    expect(app.upsert).toHaveBeenCalledWith(expect.objectContaining({ role: 'admin', active: true }), { onConflict: 'id' });
  });

  it('accepts the same name for two accounts with different emails and roles', async () => {
    const app = setup();
    const first = await app.invoke({ action: 'create_user', data: { ...defaultData, role: 'admin' } });
    const second = await app.invoke({ action: 'create_user', data: { ...defaultData, email: 'person.technician@example.test' } });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect((await first.json()).id).not.toBe((await second.json()).id);
    expect(app.createUser).toHaveBeenNthCalledWith(2, expect.objectContaining({ email: 'person.technician@example.test', user_metadata: { full_name: defaultData.full_name, role: 'technician' } }));
  });

  it.each([
    { role: 'technician', active: true }, { role: 'supervisor', active: true },
    { role: 'responsible', active: true }, { role: 'admin', active: false },
  ])('denies creation for caller $role, active=$active', async (caller) => {
    const app = setup(caller);
    const response = await app.invoke({ action: 'create_user', data: { ...defaultData, role: 'admin' } });
    expect(response.status).toBe(403);
    expect(app.createUser).not.toHaveBeenCalled();
    expect(app.upsert).not.toHaveBeenCalled();
  });

  it('requires a verified session before profile and Auth mutations', async () => {
    const app = setup();
    const missing = await app.invoke({ action: 'create_user', data: defaultData }, null);
    expect(missing.status).toBe(401);
    app.getUser.mockResolvedValueOnce({ data: { user: null }, error: { code: 'bad_jwt' } });
    const invalid = await app.invoke({ action: 'create_user', data: defaultData });
    expect(invalid.status).toBe(401);
    expect(app.createUser).not.toHaveBeenCalled();
  });

  it('rejects missing data and invalid email before creating an Auth user', async () => {
    const app = setup();
    expect((await app.invoke({ action: 'create_user' })).status).toBe(400);
    const invalid = await app.invoke({ action: 'create_user', data: { ...defaultData, email: 'not-an-email' } });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ error: 'Ingresá un email válido' });
    expect(app.createUser).not.toHaveBeenCalled();
  });

  it.each(['email_exists', 'user_already_exists'])('explains %s without overwriting an existing account', async (code) => {
    const app = setup();
    app.createUser.mockResolvedValueOnce({ data: { user: null }, error: { code, message: 'Internal provider text' } });
    const response = await app.invoke({ action: 'create_user', data: defaultData });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'EMAIL_ALREADY_EXISTS', error: expect.stringContaining('Ya existe un usuario con ese email') });
    expect(app.upsert).not.toHaveBeenCalled();
    expect(app.deleteUser).not.toHaveBeenCalled();
  });

  it('explains a rejected password and logs only the provider code', async () => {
    const app = setup();
    app.createUser.mockResolvedValueOnce({ data: { user: null }, error: { code: 'weak_password', status: 422, message: `Sensitive detail: ${defaultData.password}` } });
    const response = await app.invoke({ action: 'create_user', data: defaultData });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'WEAK_PASSWORD', error: expect.stringContaining('requisitos de seguridad') });
    expect(JSON.stringify(app.log.mock.calls)).toContain('weak_password');
    expect(JSON.stringify(app.log.mock.calls)).not.toContain(defaultData.password);
    expect(JSON.stringify(app.log.mock.calls)).not.toContain(defaultData.email);
  });

  it('never exposes unknown database errors or provider details to the user', async () => {
    const app = setup();
    app.createUser.mockResolvedValueOnce({ data: { user: null }, error: { code: 'unexpected_failure', message: 'SQL internal details with sensitive-data' } });
    const response = await app.invoke({ action: 'create_user', data: defaultData });
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('sensitive-data');
    expect(JSON.stringify(app.log.mock.calls)).not.toContain('sensitive-data');
  });

  it('rolls back a newly created Auth account if its profile cannot be saved', async () => {
    const app = setup();
    app.upsert.mockResolvedValueOnce({ error: { code: '23505', message: 'Sensitive database detail' } });
    const response = await app.invoke({ action: 'create_user', data: defaultData });
    expect(response.status).toBe(500);
    expect(app.deleteUser).toHaveBeenCalledWith('created-1');
    expect(app.insert).not.toHaveBeenCalled();
    expect(JSON.stringify(app.log.mock.calls)).toContain('23505');
    expect(JSON.stringify(app.log.mock.calls)).not.toContain('Sensitive database detail');
  });
});

describe('admin-users actual handler — complete user listing', () => {
  it('loads later Auth pages and their profiles without dropping an administrator', async () => {
    const app = setup();
    const firstPage = Array.from({ length: 100 }, (_, i) => ({ id: `user-${i}`, email: `user${i}@example.test` }));
    app.listUsers.mockResolvedValueOnce({ data: { users: firstPage }, error: null });
    app.listUsers.mockResolvedValueOnce({ data: { users: [{ id: 'last-admin', email: 'last@example.test' }] }, error: null });
    app.profilesIn.mockImplementation(async (_column, ids) => ({
      data: ids.map((id) => ({ id, role: id === 'last-admin' ? 'admin' : 'technician', full_name: id, active: true })), error: null,
    }));
    const response = await app.invoke({ action: 'list_users' });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.users).toHaveLength(101);
    expect(data.users[100]).toMatchObject({ id: 'last-admin', role: 'admin' });
    expect(app.listUsers).toHaveBeenNthCalledWith(1, { page: 1, perPage: 100 });
    expect(app.listUsers).toHaveBeenNthCalledWith(2, { page: 2, perPage: 100 });
    expect(app.profilesIn.mock.calls.map((call) => call[1].length)).toEqual([100, 1]);
  });

  it('reports an incomplete profile instead of inventing an active technician', async () => {
    const app = setup();
    app.listUsers.mockResolvedValueOnce({ data: { users: [{ id: 'orphan', email: 'orphan@example.test' }] }, error: null });
    app.profilesIn.mockResolvedValueOnce({ data: [], error: null });
    const response = await app.invoke({ action: 'list_users' });
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain('perfil incompleto');
    expect(data.users).toBeUndefined();
  });

  it('does not report a partial list as complete if a later page fails', async () => {
    const app = setup();
    app.listUsers.mockResolvedValueOnce({ data: { users: Array.from({ length: 100 }, (_, i) => ({ id: `user-${i}` })) }, error: null });
    app.listUsers.mockResolvedValueOnce({ data: { users: [] }, error: { code: 'request_timeout' } });
    const response = await app.invoke({ action: 'list_users' });
    expect(response.status).toBe(400);
    expect((await response.json()).users).toBeUndefined();
  });
});
