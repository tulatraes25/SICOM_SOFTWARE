import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRpc = vi.fn();
const mockFrom = vi.fn();
const mockAuth = { getUser: vi.fn() };
const mockStorage = { from: vi.fn() };

vi.mock('@/config/supabase', () => ({
  supabase: {
    auth: { getUser: (...args: unknown[]) => mockAuth.getUser(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
    storage: { from: (...args: unknown[]) => mockStorage.from(...args) },
  },
}));

describe('Document Branding & Signatures - Constants', () => {
  it('SIGNATURE_TYPE_LABELS has all types', async () => {
    const { SIGNATURE_TYPE_LABELS } = await import('@/types/database');
    expect(SIGNATURE_TYPE_LABELS.technician).toBe('Técnico');
    expect(SIGNATURE_TYPE_LABELS.administrator).toBe('Administrador');
    expect(SIGNATURE_TYPE_LABELS.supervisor).toBe('Supervisor');
    expect(SIGNATURE_TYPE_LABELS.representative).toBe('Representante');
  });

  it('DOC_SIGNATURE_TYPE_LABELS has all types', async () => {
    const { DOC_SIGNATURE_TYPE_LABELS } = await import('@/types/database');
    expect(DOC_SIGNATURE_TYPE_LABELS.service_report).toBe('Informe técnico');
    expect(DOC_SIGNATURE_TYPE_LABELS.budget).toBe('Presupuesto');
    expect(DOC_SIGNATURE_TYPE_LABELS.service_order).toBe('Orden de servicio');
    expect(DOC_SIGNATURE_TYPE_LABELS.visit_entry).toBe('Asiento del libro');
  });
});

describe('Document Settings - RPC calls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getDocumentSettings calls RPC', async () => {
    mockRpc.mockResolvedValue({
      data: { company_name: 'SICOM Patagonia SRL', phone: '+54 297 421-4430' },
      error: null,
    });
    const { getDocumentSettings } = await import('@/services/documentSettings.service');
    const result = await getDocumentSettings();

    expect(mockRpc).toHaveBeenCalledWith('get_document_settings');
    expect(result?.company_name).toBe('SICOM Patagonia SRL');
  });

  it('updateDocumentSettings calls RPC with params', async () => {
    mockRpc.mockResolvedValue({ data: { success: true }, error: null });
    const { updateDocumentSettings } = await import('@/services/documentSettings.service');
    await updateDocumentSettings({ phone: '+54 297 421-4430' });

    expect(mockRpc).toHaveBeenCalledWith('update_document_settings', expect.objectContaining({
      p_phone: '+54 297 421-4430',
    }));
  });
});

describe('Document Signatures - RPC calls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('signDocument calls sign_document RPC', async () => {
    mockRpc.mockResolvedValue({
      data: { id: 'sig-1', signer_name: 'Test User', has_signature: true, signed_at: new Date().toISOString() },
      error: null,
    });
    const { signDocument } = await import('@/services/documentSignatures.service');
    const result = await signDocument('service_report', 'record-1');

    expect(mockRpc).toHaveBeenCalledWith('sign_document', expect.objectContaining({
      p_document_type: 'service_report',
      p_document_id: 'record-1',
    }));
    expect((result as any).signer_name).toBe('Test User');
  });

  it('signDocument throws on RPC error', async () => {
    mockRpc.mockResolvedValue({ data: { error: 'No autenticado' }, error: null });
    const { signDocument } = await import('@/services/documentSignatures.service');

    await expect(signDocument('service_report', 'record-1'))
      .rejects.toThrow('No autenticado');
  });

  it('getDocumentSignatures queries correct table', async () => {
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    mockFrom.mockReturnValue(mockQuery);

    const { getDocumentSignatures } = await import('@/services/documentSignatures.service');
    await getDocumentSignatures('service_report', 'record-1');

    expect(mockFrom).toHaveBeenCalledWith('document_signatures');
    expect(mockQuery.eq).toHaveBeenCalledWith('document_type', 'service_report');
    expect(mockQuery.eq).toHaveBeenCalledWith('document_id', 'record-1');
  });
});

describe('User Signatures - Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  });

  it('getMySignatures queries own signatures', async () => {
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    mockFrom.mockReturnValue(mockQuery);

    const { getMySignatures } = await import('@/services/userSignatures.service');
    const result = await getMySignatures();

    expect(mockFrom).toHaveBeenCalledWith('user_signatures');
    expect(result).toEqual([]);
  });

  it('revokeSignature updates signature', async () => {
    const mockEq2 = vi.fn().mockResolvedValue({ error: null });
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq1 });
    mockFrom.mockReturnValue({ update: mockUpdate });

    const { revokeSignature } = await import('@/services/userSignatures.service');
    await revokeSignature('sig-1');

    expect(mockUpdate).toHaveBeenCalled();
    expect(mockEq1).toHaveBeenCalledWith('id', 'sig-1');
    expect(mockEq2).toHaveBeenCalledWith('user_id', 'user-1');
  });
});
