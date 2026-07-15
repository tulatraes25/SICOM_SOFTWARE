import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/config/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

describe('Budgets - Constants', () => {
  it('BUDGET_STATUS_LABELS has all statuses', async () => {
    const { BUDGET_STATUS_LABELS } = await import('@/types/database');
    expect(BUDGET_STATUS_LABELS.draft).toBe('Borrador');
    expect(BUDGET_STATUS_LABELS.ready).toBe('Listo');
    expect(BUDGET_STATUS_LABELS.sent).toBe('Enviado');
    expect(BUDGET_STATUS_LABELS.accepted).toBe('Aceptado');
    expect(BUDGET_STATUS_LABELS.rejected).toBe('Rechazado');
    expect(BUDGET_STATUS_LABELS.expired).toBe('Vencido');
    expect(BUDGET_STATUS_LABELS.cancelled).toBe('Cancelado');
  });
});

describe('Budgets - RPC calls', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('createBudget calls create_budget RPC', async () => {
    mockRpc.mockResolvedValue({ data: { budget_id: 'b-1', service_case_id: 'sc-1', case_number: 1902, numbering_mode: 'test' }, error: null });
    const { createBudget } = await import('@/services/budgets.service');
    const result = await createBudget({ client_id: 'c-1', subject: 'Test budget' });

    expect(mockRpc).toHaveBeenCalledWith('create_budget', expect.objectContaining({
      p_client_id: 'c-1',
      p_subject: 'Test budget',
    }));
    expect(result.case_number).toBe(1902);
  });

  it('createBudget throws on RPC error', async () => {
    mockRpc.mockResolvedValue({ data: { error: 'Sin permisos' }, error: null });
    const { createBudget } = await import('@/services/budgets.service');
    await expect(createBudget({ client_id: 'c-1', subject: 'Test' })).rejects.toThrow('Sin permisos');
  });

  it('recalculateBudget calls RPC', async () => {
    mockRpc.mockResolvedValue({ data: { subtotal: 1000, tax_amount: 210, total: 1210 }, error: null });
    const { recalculateBudget } = await import('@/services/budgets.service');
    await recalculateBudget('b-1');
    expect(mockRpc).toHaveBeenCalledWith('recalculate_budget_totals', { p_budget_id: 'b-1' });
  });

  it('markBudgetReady calls RPC', async () => {
    mockRpc.mockResolvedValue({ data: { success: true, status: 'ready' }, error: null });
    const { markBudgetReady } = await import('@/services/budgets.service');
    await markBudgetReady('b-1');
    expect(mockRpc).toHaveBeenCalledWith('mark_budget_ready', { p_budget_id: 'b-1' });
  });

  it('markBudgetSent calls RPC', async () => {
    mockRpc.mockResolvedValue({ data: { success: true, status: 'sent' }, error: null });
    const { markBudgetSent } = await import('@/services/budgets.service');
    await markBudgetSent('b-1');
    expect(mockRpc).toHaveBeenCalledWith('mark_budget_sent', { p_budget_id: 'b-1' });
  });

  it('acceptBudget calls RPC', async () => {
    mockRpc.mockResolvedValue({ data: { success: true, status: 'accepted' }, error: null });
    const { acceptBudget } = await import('@/services/budgets.service');
    await acceptBudget('b-1');
    expect(mockRpc).toHaveBeenCalledWith('accept_budget', {
      p_budget_id: 'b-1',
      p_response_notes: null,
      p_response_contact: null,
    });
  });

  it('rejectBudget calls RPC with reason', async () => {
    mockRpc.mockResolvedValue({ data: { success: true, status: 'rejected' }, error: null });
    const { rejectBudget } = await import('@/services/budgets.service');
    await rejectBudget('b-1', 'Too expensive');
    expect(mockRpc).toHaveBeenCalledWith('reject_budget', { p_budget_id: 'b-1', p_reason: 'Too expensive' });
  });

  it('cancelBudget calls RPC with reason', async () => {
    mockRpc.mockResolvedValue({ data: { success: true, status: 'cancelled' }, error: null });
    const { cancelBudget } = await import('@/services/budgets.service');
    await cancelBudget('b-1', 'No longer needed');
    expect(mockRpc).toHaveBeenCalledWith('cancel_budget', { p_budget_id: 'b-1', p_reason: 'No longer needed' });
  });
});

describe('Budgets - listBudgets', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns data and count', async () => {
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], count: 0, error: null }),
    };
    mockFrom.mockReturnValue(mockQuery);

    const { listBudgets } = await import('@/services/budgets.service');
    const result = await listBudgets();
    expect(result).toEqual({ data: [], count: 0 });
  });
});
