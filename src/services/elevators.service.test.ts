import { describe, it, expect, vi, beforeEach } from 'vitest';

function createChain() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
  };
}

let mockChain: ReturnType<typeof createChain>;
const mockFrom = vi.fn();

vi.mock('@/config/supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

import { listElevators, searchElevators, filterElevators, deactivateElevator, reactivateElevator } from './elevators.service';

beforeEach(() => {
  vi.clearAllMocks();
  mockChain = createChain();
  mockFrom.mockImplementation(() => mockChain);
});

describe('elevators.service — filterElevators', () => {
  it('active=true agrega eq("active", true)', async () => {
    mockChain.order.mockResolvedValue({ data: [], error: null });
    await filterElevators({ active: true });
    expect(mockChain.eq).toHaveBeenCalledWith('active', true);
  });

  it('active=false agrega eq("active", false)', async () => {
    mockChain.order.mockResolvedValue({ data: [], error: null });
    await filterElevators({ active: false });
    expect(mockChain.eq).toHaveBeenCalledWith('active', false);
  });

  it('sin active no agrega filtro', async () => {
    mockChain.order.mockResolvedValue({ data: [], error: null });
    await filterElevators({});
    const activeCalls = mockChain.eq.mock.calls.filter((c: unknown[]) => c[0] === 'active');
    expect(activeCalls).toHaveLength(0);
  });
});

describe('elevators.service — searchElevators', () => {
  it('con true filtra activos', async () => {
    mockChain.or.mockReturnThis();
    mockChain.order.mockReturnThis();
    mockChain.eq.mockResolvedValue({ data: [], error: null });
    await searchElevators('test', true);
    expect(mockChain.eq).toHaveBeenCalledWith('active', true);
  });

  it('con false filtra inactivos', async () => {
    mockChain.or.mockReturnThis();
    mockChain.order.mockReturnThis();
    mockChain.eq.mockResolvedValue({ data: [], error: null });
    await searchElevators('test', false);
    expect(mockChain.eq).toHaveBeenCalledWith('active', false);
  });

  it('sin active incluye todos', async () => {
    mockChain.or.mockReturnThis();
    mockChain.order.mockResolvedValue({ data: [], error: null });
    await searchElevators('test');
    const activeCalls = mockChain.eq.mock.calls.filter((c: unknown[]) => c[0] === 'active');
    expect(activeCalls).toHaveLength(0);
  });
});

describe('elevators.service — reactivateElevator', () => {
  it('actualiza active=true', async () => {
    mockChain.update.mockReturnThis();
    mockChain.eq.mockResolvedValue({ error: null });
    await reactivateElevator('e1');
    expect(mockChain.update).toHaveBeenCalledWith(expect.objectContaining({ active: true }));
  });

  it('actualiza updated_at', async () => {
    mockChain.update.mockReturnThis();
    mockChain.eq.mockResolvedValue({ error: null });
    await reactivateElevator('e1');
    const updateArg = mockChain.update.mock.calls[0][0];
    expect(updateArg.updated_at).toBeDefined();
  });

  it('no modifica responsible_user_id', async () => {
    mockChain.update.mockReturnThis();
    mockChain.eq.mockResolvedValue({ error: null });
    await reactivateElevator('e1');
    const updateArg = mockChain.update.mock.calls[0][0];
    expect(updateArg).not.toHaveProperty('responsible_user_id');
  });
});

describe('elevators.service — deactivateElevator', () => {
  it('actualiza active=false', async () => {
    mockChain.update.mockReturnThis();
    mockChain.eq.mockResolvedValue({ error: null });
    await deactivateElevator('e1');
    expect(mockChain.update).toHaveBeenCalledWith(expect.objectContaining({ active: false }));
  });
});

describe('elevators.service — error propagation', () => {
  it('errores Supabase se propagan', async () => {
    mockChain.order.mockResolvedValue({ data: null, error: { message: 'DB error' } });
    await expect(listElevators()).rejects.toThrow();
  });
});
