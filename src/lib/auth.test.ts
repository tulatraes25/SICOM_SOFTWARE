import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCurrentUserProfile, signIn, signOut, isValidRole, getRoleDashboardPath } from './auth';

const { mockGetUser, mockFrom, mockSignIn, mockSignOut, mockGetSession } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockSignIn: vi.fn(),
  mockSignOut: vi.fn(),
  mockGetSession: vi.fn(),
}));

vi.mock('@/config/supabase', () => ({
  supabase: {
    auth: {
      getUser: (...a: unknown[]) => mockGetUser(...a),
      signInWithPassword: (...a: unknown[]) => mockSignIn(...a),
      signOut: (...a: unknown[]) => mockSignOut(...a),
      getSession: (...a: unknown[]) => mockGetSession(...a),
    },
    from: (...a: unknown[]) => mockFrom(...a),
  },
}));

function makeProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1', email: 'test@test.com', full_name: 'Test', role: 'technician',
    active: true, created_at: '', updated_at: '',
    must_change_password: false, temporary_password_issued_at: null, password_changed_at: null,
    ...overrides,
  };
}

beforeEach(() => { vi.clearAllMocks(); });

describe('isValidRole', () => {
  it('accepts valid roles', () => {
    expect(isValidRole('admin')).toBe(true);
    expect(isValidRole('technician')).toBe(true);
    expect(isValidRole('supervisor')).toBe(true);
    expect(isValidRole('responsible')).toBe(true);
  });
  it('rejects invalid roles', () => {
    expect(isValidRole('invalid')).toBe(false);
    expect(isValidRole('')).toBe(false);
  });
});

describe('getRoleDashboardPath', () => {
  it('returns correct paths', () => {
    expect(getRoleDashboardPath('admin')).toBe('/admin');
    expect(getRoleDashboardPath('technician')).toBe('/tecnico');
    expect(getRoleDashboardPath('supervisor')).toBe('/supervisor');
    expect(getRoleDashboardPath('responsible')).toBe('/responsable');
  });
});

describe('getCurrentUserProfile', () => {
  it('returns valid profile', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockFrom.mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: makeProfile(), error: null }) }) }) });
    const result = await getCurrentUserProfile();
    expect(result).toBeTruthy();
    expect(result?.must_change_password).toBe(false);
  });

  it('conserves false as false', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockFrom.mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: makeProfile({ must_change_password: false }), error: null }) }) }) });
    const result = await getCurrentUserProfile();
    expect(result?.must_change_password).toBe(false);
  });

  it('conserves true as true', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockFrom.mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: makeProfile({ must_change_password: true }), error: null }) }) }) });
    const result = await getCurrentUserProfile();
    expect(result?.must_change_password).toBe(true);
  });

  it('null dates are valid', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockFrom.mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: makeProfile({ temporary_password_issued_at: null, password_changed_at: null }), error: null }) }) }) });
    const result = await getCurrentUserProfile();
    expect(result?.temporary_password_issued_at).toBeNull();
    expect(result?.password_changed_at).toBeNull();
  });

  it('rejects response without must_change_password', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const badProfile = { id: 'u1', email: 't@t.com', full_name: 'T', role: 'technician', active: true, created_at: '', updated_at: '' };
    mockFrom.mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: badProfile, error: null }) }) }) });
    const result = await getCurrentUserProfile();
    expect(result).toBeNull();
  });

  it('rejects invalid role', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockFrom.mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: makeProfile({ role: 'invalid' }), error: null }) }) }) });
    const result = await getCurrentUserProfile();
    expect(result).toBeNull();
  });

  it('returns null when no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const result = await getCurrentUserProfile();
    expect(result).toBeNull();
  });

  it('returns null on db error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockFrom.mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null, error: new Error('db') }) }) }) });
    const result = await getCurrentUserProfile();
    expect(result).toBeNull();
  });
});

describe('signIn', () => {
  it('calls supabase auth', async () => {
    mockSignIn.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    await signIn('a@b.com', 'pass');
    expect(mockSignIn).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pass' });
  });
});

describe('signOut', () => {
  it('calls supabase signOut', async () => {
    mockSignOut.mockResolvedValue({ error: null });
    await signOut();
    expect(mockSignOut).toHaveBeenCalled();
  });
});
