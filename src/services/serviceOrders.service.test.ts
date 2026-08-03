import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRpc, mockFrom } = vi.hoisted(() => {
  const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockFrom = vi.fn();
  return { mockRpc, mockFrom };
});

vi.mock('@/config/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn(), signInWithPassword: vi.fn(), signOut: vi.fn() },
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://example.com' } }),
      })),
    },
  },
}));

import { listMyServiceOrders, assignTechnicians } from './serviceOrders.service';

function createChain() {
  return {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('serviceOrders.service — listMyServiceOrders', () => {
  it('consulto service_order_technicians por technician_id', async () => {
    const chain1 = createChain();
    chain1.eq.mockResolvedValue({ data: [{ service_order_id: 'o1' }], error: null });
    const chain2 = createChain();
    chain2.order.mockResolvedValue({ data: [], error: null });
    mockFrom.mockReturnValueOnce(chain1).mockReturnValueOnce(chain2);

    await listMyServiceOrders('tech-1');
    expect(chain1.eq).toHaveBeenCalledWith('technician_id', 'tech-1');
  });

  it('retorna [] cuando no hay asignaciones', async () => {
    const chain1 = createChain();
    chain1.eq.mockResolvedValue({ data: [], error: null });
    mockFrom.mockReturnValueOnce(chain1);

    const result = await listMyServiceOrders('tech-1');
    expect(result).toEqual([]);
  });

  it('consulto solo los orderIds asignados', async () => {
    const chain1 = createChain();
    chain1.eq.mockResolvedValue({ data: [{ service_order_id: 'o1' }, { service_order_id: 'o2' }], error: null });
    const chain2 = createChain();
    chain2.order.mockResolvedValue({ data: [], error: null });
    mockFrom.mockReturnValueOnce(chain1).mockReturnValueOnce(chain2);

    await listMyServiceOrders('tech-1');
    expect(chain2.in).toHaveBeenCalledWith('id', ['o1', 'o2']);
  });

  it('incluye is_lead info', async () => {
    const chain1 = createChain();
    chain1.eq.mockResolvedValue({ data: [{ service_order_id: 'o1' }], error: null });
    const chain2 = createChain();
    chain2.order.mockResolvedValue({
      data: [{ id: 'o1', technicians: [{ technician: { id: 'tech-1' }, is_lead: true }] }],
      error: null,
    });
    mockFrom.mockReturnValueOnce(chain1).mockReturnValueOnce(chain2);

    const result = await listMyServiceOrders('tech-1');
    expect(result[0].technicians?.[0].is_lead).toBe(true);
  });

  it('propaga errores de asignaciones', async () => {
    const chain1 = createChain();
    chain1.eq.mockResolvedValue({ data: null, error: { message: 'assign error' } });
    mockFrom.mockReturnValueOnce(chain1);

    await expect(listMyServiceOrders('tech-1')).rejects.toEqual({ message: 'assign error' });
  });

  it('propaga errores de órdenes', async () => {
    const chain1 = createChain();
    chain1.eq.mockResolvedValue({ data: [{ service_order_id: 'o1' }], error: null });
    const chain2 = createChain();
    chain2.order.mockResolvedValue({ data: null, error: { message: 'orders error' } });
    mockFrom.mockReturnValueOnce(chain1).mockReturnValueOnce(chain2);

    await expect(listMyServiceOrders('tech-1')).rejects.toEqual({ message: 'orders error' });
  });
});

describe('serviceOrders.service — assignTechnicians', () => {
  it('envía p_order_id', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await assignTechnicians('order-1', ['t1', 't2'], 't1');
    expect(mockRpc).toHaveBeenCalledWith('assign_service_order_technicians', expect.objectContaining({ p_order_id: 'order-1' }));
  });

  it('envía p_technician_ids', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await assignTechnicians('order-1', ['t1', 't2'], 't1');
    expect(mockRpc).toHaveBeenCalledWith('assign_service_order_technicians', expect.objectContaining({ p_technician_ids: ['t1', 't2'] }));
  });

  it('envía p_is_lead', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await assignTechnicians('order-1', ['t1', 't2'], 't1');
    expect(mockRpc).toHaveBeenCalledWith('assign_service_order_technicians', expect.objectContaining({ p_is_lead: 't1' }));
  });

  it('envía null cuando no hay leadId', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await assignTechnicians('order-1', ['t1']);
    expect(mockRpc).toHaveBeenCalledWith('assign_service_order_technicians', expect.objectContaining({ p_is_lead: null }));
  });

  it('propaga error de supabase.rpc', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'rpc failed' } });
    await expect(assignTechnicians('order-1', ['t1'])).rejects.toEqual({ message: 'rpc failed' });
  });

  it('propaga data.error', async () => {
    mockRpc.mockResolvedValue({ data: { error: 'business error' }, error: null });
    await expect(assignTechnicians('order-1', ['t1'])).rejects.toThrow('business error');
  });
});
