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

describe('Elevator Visit Book - Constants', () => {
  it('VISIT_ENTRY_TYPE_LABELS has all types', async () => {
    const { VISIT_ENTRY_TYPE_LABELS } = await import('@/types/database');
    expect(VISIT_ENTRY_TYPE_LABELS.scheduled_service).toBe('Servicio programado');
    expect(VISIT_ENTRY_TYPE_LABELS.preventive_maintenance).toBe('Mantenimiento preventivo');
    expect(VISIT_ENTRY_TYPE_LABELS.corrective_maintenance).toBe('Mantenimiento correctivo');
    expect(VISIT_ENTRY_TYPE_LABELS.claim_visit).toBe('Visita por reclamo');
    expect(VISIT_ENTRY_TYPE_LABELS.inspection).toBe('Inspección');
    expect(VISIT_ENTRY_TYPE_LABELS.emergency).toBe('Emergencia');
    expect(VISIT_ENTRY_TYPE_LABELS.verification).toBe('Verificación');
    expect(VISIT_ENTRY_TYPE_LABELS.other).toBe('Otro');
  });

  it('VISIT_ENTRY_STATUS_LABELS has all statuses', async () => {
    const { VISIT_ENTRY_STATUS_LABELS } = await import('@/types/database');
    expect(VISIT_ENTRY_STATUS_LABELS.draft).toBe('Borrador');
    expect(VISIT_ENTRY_STATUS_LABELS.submitted).toBe('Enviado');
    expect(VISIT_ENTRY_STATUS_LABELS.approved).toBe('Aprobado');
    expect(VISIT_ENTRY_STATUS_LABELS.rectified).toBe('Rectificado');
    expect(VISIT_ENTRY_STATUS_LABELS.cancelled).toBe('Anulado');
  });
});

describe('Elevator Visit Book - RPC calls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createVisitEntry calls create_elevator_visit_entry', async () => {
    mockRpc.mockResolvedValue({ data: { id: 'entry-1', entry_number: 1, status: 'draft' }, error: null });
    const { createVisitEntry } = await import('@/services/elevatorVisitBook.service');
    await createVisitEntry({
      elevator_id: 'elev-1',
      visit_date: '2026-07-14',
      entry_type: 'preventive_maintenance',
      description: 'Test visit',
    });

    expect(mockRpc).toHaveBeenCalledWith('create_elevator_visit_entry', expect.objectContaining({
      p_elevator_id: 'elev-1',
      p_visit_date: '2026-07-14',
      p_entry_type: 'preventive_maintenance',
      p_description: 'Test visit',
    }));
  });

  it('createVisitEntry returns entry data', async () => {
    mockRpc.mockResolvedValue({ data: { id: 'entry-1', entry_number: 1, status: 'draft' }, error: null });
    const { createVisitEntry } = await import('@/services/elevatorVisitBook.service');
    const result = await createVisitEntry({
      elevator_id: 'elev-1',
      visit_date: '2026-07-14',
      entry_type: 'emergency',
      description: 'Emergency visit',
    });

    expect(result).toEqual({ id: 'entry-1', entry_number: 1, status: 'draft' });
  });

  it('createVisitEntry throws on RPC error', async () => {
    mockRpc.mockResolvedValue({ data: { error: 'Fecha futura no permitida' }, error: null });
    const { createVisitEntry } = await import('@/services/elevatorVisitBook.service');

    await expect(createVisitEntry({
      elevator_id: 'elev-1',
      visit_date: '2099-01-01',
      entry_type: 'other',
      description: 'Future visit',
    })).rejects.toThrow('Fecha futura no permitida');
  });

  it('submitVisitEntry calls submit_elevator_visit_entry', async () => {
    mockRpc.mockResolvedValue({ data: { success: true }, error: null });
    const { submitVisitEntry } = await import('@/services/elevatorVisitBook.service');
    await submitVisitEntry('entry-1');

    expect(mockRpc).toHaveBeenCalledWith('submit_elevator_visit_entry', { p_entry_id: 'entry-1' });
  });

  it('approveVisitEntry calls approve_elevator_visit_entry', async () => {
    mockRpc.mockResolvedValue({ data: { success: true }, error: null });
    const { approveVisitEntry } = await import('@/services/elevatorVisitBook.service');
    await approveVisitEntry('entry-1');

    expect(mockRpc).toHaveBeenCalledWith('approve_elevator_visit_entry', { p_entry_id: 'entry-1' });
  });

  it('rectifyVisitEntry calls rectify_elevator_visit_entry with reason and fields', async () => {
    mockRpc.mockResolvedValue({ data: { success: true, new_id: 'new-1', new_entry_number: 2 }, error: null });
    const { rectifyVisitEntry } = await import('@/services/elevatorVisitBook.service');
    const result = await rectifyVisitEntry('entry-1', 'Error in description', { description: 'Corrected' });

    expect(mockRpc).toHaveBeenCalledWith('rectify_elevator_visit_entry', {
      p_entry_id: 'entry-1',
      p_reason: 'Error in description',
      p_corrected_fields: { description: 'Corrected' },
    });
    expect(result).toEqual({ success: true, new_id: 'new-1', new_entry_number: 2 });
  });

  it('cancelVisitEntry calls cancel_elevator_visit_entry with reason', async () => {
    mockRpc.mockResolvedValue({ data: { success: true }, error: null });
    const { cancelVisitEntry } = await import('@/services/elevatorVisitBook.service');
    await cancelVisitEntry('entry-1', 'No longer needed');

    expect(mockRpc).toHaveBeenCalledWith('cancel_elevator_visit_entry', {
      p_entry_id: 'entry-1',
      p_reason: 'No longer needed',
    });
  });

  it('createVisitFromServiceRecord calls create_visit_entry_from_service_record', async () => {
    mockRpc.mockResolvedValue({ data: { success: true, id: 'entry-1', entry_number: 1 }, error: null });
    const { createVisitFromServiceRecord } = await import('@/services/elevatorVisitBook.service');
    const result = await createVisitFromServiceRecord('record-1');

    expect(mockRpc).toHaveBeenCalledWith('create_visit_entry_from_service_record', {
      p_service_record_id: 'record-1',
    });
    expect(result).toEqual({ success: true, id: 'entry-1', entry_number: 1 });
  });
});

describe('Elevator Visit Book - listEntriesByElevator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns data and count', async () => {
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], count: 0, error: null }),
    };
    mockFrom.mockReturnValue(mockQuery);

    const { listEntriesByElevator } = await import('@/services/elevatorVisitBook.service');
    const result = await listEntriesByElevator('elev-1');

    expect(result).toEqual({ data: [], count: 0 });
  });

  it('applies filters', async () => {
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], count: 0, error: null }),
    };
    mockFrom.mockReturnValue(mockQuery);

    const { listEntriesByElevator } = await import('@/services/elevatorVisitBook.service');
    await listEntriesByElevator('elev-1', { status: 'approved', entry_type: 'inspection' });

    expect(mockQuery.eq).toHaveBeenCalledWith('elevator_id', 'elev-1');
    expect(mockQuery.eq).toHaveBeenCalledWith('status', 'approved');
    expect(mockQuery.eq).toHaveBeenCalledWith('entry_type', 'inspection');
  });
});
