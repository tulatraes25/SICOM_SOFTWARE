import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFrom, mockRpc, mockInvoke } = vi.hoisted(() => {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockInvoke = vi.fn().mockResolvedValue({ data: null, error: null });
  return { mockFrom, mockRpc, mockInvoke };
});

vi.mock('@/config/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://example.com/photo.jpg' } }),
      })),
    },
  },
}));

import {
  listPendingServiceRecords,
  listApprovedServiceRecords,
  getServiceRecordForReview,
  markInReview,
  saveSupervisorReportDraft,
  approveServiceRecord,
  rejectServiceRecord,
  generateAIReportDraft,
} from './supervisor.service';

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
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('supervisor.service — listPendingServiceRecords', () => {
  it('incluye submitted, in_review y rejected', async () => {
    const chain = createChain();
    chain.order.mockResolvedValue({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await listPendingServiceRecords();
    expect(chain.in).toHaveBeenCalledWith('status', ['submitted', 'in_review', 'rejected']);
  });
});

describe('supervisor.service — listApprovedServiceRecords', () => {
  it('filtra approved', async () => {
    const chain = createChain();
    chain.limit.mockResolvedValue({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await listApprovedServiceRecords();
    expect(chain.eq).toHaveBeenCalledWith('status', 'approved');
  });

  it('ordena por approved_at', async () => {
    const chain = createChain();
    chain.limit.mockResolvedValue({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await listApprovedServiceRecords();
    expect(chain.order).toHaveBeenCalledWith('approved_at', { ascending: false });
  });
});

describe('supervisor.service — getServiceRecordForReview', () => {
  it('carga elevator, building, client, technician, approved_by_profile', async () => {
    const chain = createChain();
    chain.single.mockResolvedValue({ data: { id: 'sr-1' }, error: null });
    mockFrom.mockReturnValue(chain);

    await getServiceRecordForReview('sr-1');
    expect(chain.select).toHaveBeenCalledWith(expect.stringContaining('elevator'));
    expect(chain.select).toHaveBeenCalledWith(expect.stringContaining('technician'));
    expect(chain.select).toHaveBeenCalledWith(expect.stringContaining('approved_by_profile'));
    expect(chain.eq).toHaveBeenCalledWith('id', 'sr-1');
  });
});

describe('supervisor.service — markInReview (start_service_review)', () => {
  it('usa firma correcta', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    await markInReview('sr-1');
    expect(mockRpc).toHaveBeenCalledWith('start_service_review', {
      p_service_record_id: 'sr-1',
    });
  });
});

describe('supervisor.service — saveSupervisorReportDraft (save_review_report)', () => {
  it('usa parámetros correctos', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    await saveSupervisorReportDraft('sr-1', 'contenido del informe');
    expect(mockRpc).toHaveBeenCalledWith('save_review_report', {
      p_service_record_id: 'sr-1',
      p_ai_report_draft: 'contenido del informe',
      p_final_report_text: 'contenido del informe',
    });
  });
});

describe('supervisor.service — approveServiceRecord', () => {
  it('usa p_service_record_id', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    await approveServiceRecord('sr-1');
    expect(mockRpc).toHaveBeenCalledWith('approve_service_record', {
      p_service_record_id: 'sr-1',
    });
  });
});

describe('supervisor.service — rejectServiceRecord', () => {
  it('usa motivo', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    await rejectServiceRecord('sr-1', 'Falta documentación');
    expect(mockRpc).toHaveBeenCalledWith('reject_service_record', {
      p_service_record_id: 'sr-1',
      p_rejection_reason: 'Falta documentación',
    });
  });
});

describe('supervisor.service — errores', () => {
  it('error RPC se propaga', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'rpc failed' } });

    await expect(markInReview('sr-1')).rejects.toEqual({ message: 'rpc failed' });
  });

  it('data.error se convierte en Error', async () => {
    mockRpc.mockResolvedValue({ data: { error: 'business error' }, error: null });

    await expect(markInReview('sr-1')).rejects.toThrow('business error');
  });
});

describe('supervisor.service — generateAIReportDraft', () => {
  it('envía service_record_id', async () => {
    mockInvoke.mockResolvedValue({ data: { report: 'Informe generado' }, error: null });

    const result = await generateAIReportDraft('sr-1');
    expect(mockInvoke).toHaveBeenCalledWith('generate-report', {
      body: { service_record_id: 'sr-1' },
    });
    expect(result).toBe('Informe generado');
  });
});

describe('supervisor.service — aislamiento', () => {
  it('no llama RPC de órdenes ni presupuestos', async () => {
    const chain1 = createChain();
    chain1.order.mockResolvedValue({ data: [], error: null });
    const chain2 = createChain();
    chain2.limit.mockResolvedValue({ data: [], error: null });
    mockFrom.mockReturnValueOnce(chain1).mockReturnValueOnce(chain2);

    await listPendingServiceRecords();
    await listApprovedServiceRecords();

    const rpcCalls = mockRpc.mock.calls.map((c) => c[0]);
    expect(rpcCalls).not.toContain('assign_service_order_technicians');
    expect(rpcCalls).not.toContain('create_budget');
  });
});
