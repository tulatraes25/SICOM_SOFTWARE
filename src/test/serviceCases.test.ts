import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock de Supabase
const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/config/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

describe('Service Cases - formatCaseNumber', () => {
  it('formatCaseNumber muestra PRUEBA para modo test', async () => {
    const { formatCaseNumber } = await import('@/services/serviceCases.service');
    expect(formatCaseNumber(1900, 'test')).toBe('PRUEBA N.º 1900');
    expect(formatCaseNumber(1950, 'test')).toBe('PRUEBA N.º 1950');
  });

  it('formatCaseNumber muestra N.º para modo production', async () => {
    const { formatCaseNumber } = await import('@/services/serviceCases.service');
    expect(formatCaseNumber(2000, 'production')).toBe('N.º 2000');
    expect(formatCaseNumber(2001, 'production')).toBe('N.º 2001');
  });

  it('formatCaseNumberShort muestra prefijo EXP-', async () => {
    const { formatCaseNumberShort } = await import('@/services/serviceCases.service');
    expect(formatCaseNumberShort(1900)).toBe('EXP-1900');
    expect(formatCaseNumberShort(2000)).toBe('EXP-2000');
  });
});

describe('Service Cases - RPC calls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: { id: 'test-id', case_number: 1900, numbering_mode: 'test', origin_type: 'direct_report', status: 'open' }, error: null });
  });

  it('createServiceCase llama a la RPC correcta', async () => {
    const { createServiceCase } = await import('@/services/serviceCases.service');
    await createServiceCase({
      origin_type: 'direct_report',
      title: 'Test case',
    });

    expect(mockRpc).toHaveBeenCalledWith('create_service_case', expect.objectContaining({
      p_origin_type: 'direct_report',
      p_title: 'Test case',
    }));
  });

  it('createServiceCase retorna datos del expediente', async () => {
    const { createServiceCase } = await import('@/services/serviceCases.service');
    const result = await createServiceCase({ origin_type: 'budget' });

    expect(result).toEqual({
      id: 'test-id',
      case_number: 1900,
      numbering_mode: 'test',
      origin_type: 'direct_report',
      status: 'open',
    });
  });

  it('createServiceCase lanza error si la RPC retorna error', async () => {
    mockRpc.mockResolvedValue({ data: { error: 'Sin permisos' }, error: null });
    const { createServiceCase } = await import('@/services/serviceCases.service');

    await expect(createServiceCase({ origin_type: 'direct_report' }))
      .rejects.toThrow('Sin permisos');
  });

  it('closeServiceCase llama a la RPC correcta', async () => {
    mockRpc.mockResolvedValue({ data: { success: true }, error: null });
    const { closeServiceCase } = await import('@/services/serviceCases.service');
    await closeServiceCase('case-id-123');

    expect(mockRpc).toHaveBeenCalledWith('close_service_case', {
      p_case_id: 'case-id-123',
    });
  });

  it('cancelServiceCase llama a la RPC con motivo', async () => {
    mockRpc.mockResolvedValue({ data: { success: true }, error: null });
    const { cancelServiceCase } = await import('@/services/serviceCases.service');
    await cancelServiceCase('case-id-123', 'Motivo de prueba');

    expect(mockRpc).toHaveBeenCalledWith('cancel_service_case', {
      p_case_id: 'case-id-123',
      p_reason: 'Motivo de prueba',
    });
  });

  it('getNumberingSettings llama a la RPC', async () => {
    mockRpc.mockResolvedValue({
      data: { current_mode: 'test', next_test_number: 1900, next_production_number: 2000 },
      error: null,
    });
    const { getNumberingSettings } = await import('@/services/serviceCases.service');
    const result = await getNumberingSettings();

    expect(mockRpc).toHaveBeenCalledWith('get_numbering_settings');
    expect(result).toEqual({
      current_mode: 'test',
      next_test_number: 1900,
      next_production_number: 2000,
    });
  });

  it('activateProductionNumbering llama a la RPC', async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, next_production_number: 2000 },
      error: null,
    });
    const { activateProductionNumbering } = await import('@/services/serviceCases.service');
    const result = await activateProductionNumbering();

    expect(mockRpc).toHaveBeenCalledWith('activate_production_numbering');
    expect(result).toEqual({ success: true, next_production_number: 2000 });
  });
});

describe('Service Cases - listServiceCases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], count: 0, error: null }),
    };
    mockFrom.mockReturnValue(mockQuery);
  });

  it('listServiceCases retorna data y count', async () => {
    const { listServiceCases } = await import('@/services/serviceCases.service');
    const result = await listServiceCases();

    expect(result).toEqual({ data: [], count: 0 });
  });

  it('listServiceCases aplica filtros', async () => {
    const { listServiceCases } = await import('@/services/serviceCases.service');
    await listServiceCases({ status: 'open', origin_type: 'budget' });

    const mockQuery = mockFrom.mock.results[0].value;
    expect(mockQuery.eq).toHaveBeenCalledWith('status', 'open');
    expect(mockQuery.eq).toHaveBeenCalledWith('origin_type', 'budget');
  });
});

describe('Service Cases - constants', () => {
  it('CASE_ORIGIN_LABELS tiene todos los orígenes', async () => {
    const { CASE_ORIGIN_LABELS } = await import('@/types/database');
    expect(CASE_ORIGIN_LABELS.budget).toBe('Presupuesto');
    expect(CASE_ORIGIN_LABELS.claim).toBe('Reclamo');
    expect(CASE_ORIGIN_LABELS.direct_report).toBe('Informe directo');
    expect(CASE_ORIGIN_LABELS.scheduled_service).toBe('Servicio programado');
    expect(CASE_ORIGIN_LABELS.other).toBe('Otro');
  });

  it('CASE_STATUS_LABELS tiene todos los estados', async () => {
    const { CASE_STATUS_LABELS } = await import('@/types/database');
    expect(CASE_STATUS_LABELS.open).toBe('Abierto');
    expect(CASE_STATUS_LABELS.assigned).toBe('Asignado');
    expect(CASE_STATUS_LABELS.in_progress).toBe('En curso');
    expect(CASE_STATUS_LABELS.completed).toBe('Completado');
    expect(CASE_STATUS_LABELS.closed).toBe('Cerrado');
    expect(CASE_STATUS_LABELS.cancelled).toBe('Anulado');
  });
});
