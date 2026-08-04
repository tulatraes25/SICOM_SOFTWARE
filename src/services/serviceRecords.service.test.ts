import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFrom } = vi.hoisted(() => {
  const mockFrom = vi.fn();
  return { mockFrom };
});

vi.mock('@/config/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
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
  listMyServiceRecords,
  listServiceRecordsByElevator,
  getServiceRecordById,
  createServiceRecord,
  updateServiceRecord,
  submitServiceRecord,
  deleteDraftServiceRecord,
  createChecklistItems,
  deleteChecklistByServiceRecord,
  getPhotosByServiceRecord,
  searchElevatorsForTechnician,
} from './serviceRecords.service';

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

describe('serviceRecords.service — listMyServiceRecords', () => {
  it('filtra por technician_id', async () => {
    const chain = createChain();
    chain.order.mockResolvedValue({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await listMyServiceRecords('tech-1');
    expect(chain.eq).toHaveBeenCalledWith('technician_id', 'tech-1');
  });

  it('ordena por created_at descendente', async () => {
    const chain = createChain();
    chain.order.mockResolvedValue({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await listMyServiceRecords('tech-1');
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });
});

describe('serviceRecords.service — listServiceRecordsByElevator', () => {
  it('filtra por elevator_id', async () => {
    const chain = createChain();
    chain.order.mockResolvedValue({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await listServiceRecordsByElevator('elev-1');
    expect(chain.eq).toHaveBeenCalledWith('elevator_id', 'elev-1');
  });
});

describe('serviceRecords.service — getServiceRecordById', () => {
  it('carga elevator, building, client, checklist, photos', async () => {
    const chain = createChain();
    chain.single.mockResolvedValue({ data: { id: 'sr-1' }, error: null });
    mockFrom.mockReturnValue(chain);

    await getServiceRecordById('sr-1');
    expect(chain.select).toHaveBeenCalledWith(expect.stringContaining('elevator'));
    expect(chain.select).toHaveBeenCalledWith(expect.stringContaining('checklist'));
    expect(chain.select).toHaveBeenCalledWith(expect.stringContaining('photos'));
    expect(chain.eq).toHaveBeenCalledWith('id', 'sr-1');
  });
});

describe('serviceRecords.service — createServiceRecord', () => {
  it('fuerza status=draft', async () => {
    const chain = createChain();
    chain.single.mockResolvedValue({ data: { id: 'sr-1', status: 'draft' }, error: null });
    mockFrom.mockReturnValue(chain);

    const record = { technician_id: 'tech-1', elevator_id: 'elev-1', service_date: '2026-08-03', service_type: 'preventivo' };
    await createServiceRecord(record as never);
    expect(chain.insert).toHaveBeenCalledWith({ ...record, status: 'draft' });
  });
});

describe('serviceRecords.service — updateServiceRecord', () => {
  it('filtra por id', async () => {
    const chain = createChain();
    chain.single.mockResolvedValue({ data: { id: 'sr-1' }, error: null });
    mockFrom.mockReturnValue(chain);

    await updateServiceRecord('sr-1', { description: 'updated' });
    expect(chain.eq).toHaveBeenCalledWith('id', 'sr-1');
  });

  it('actualiza updated_at', async () => {
    const chain = createChain();
    chain.single.mockResolvedValue({ data: { id: 'sr-1' }, error: null });
    mockFrom.mockReturnValue(chain);

    const before = Date.now();
    await updateServiceRecord('sr-1', { description: 'updated' });
    const call = chain.update.mock.calls[0]![0] as Record<string, unknown>;
    expect(call.updated_at).toBeDefined();
    expect(new Date(call.updated_at as string).getTime()).toBeGreaterThanOrEqual(before);
  });
});

describe('serviceRecords.service — submitServiceRecord', () => {
  it('cambia a submitted', async () => {
    const chain = createChain();
    chain.single.mockResolvedValue({ data: { id: 'sr-1', status: 'submitted' }, error: null });
    mockFrom.mockReturnValue(chain);

    await submitServiceRecord('sr-1');
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'submitted' }));
  });

  it('filtra por id', async () => {
    const chain = createChain();
    chain.single.mockResolvedValue({ data: { id: 'sr-1' }, error: null });
    mockFrom.mockReturnValue(chain);

    await submitServiceRecord('sr-1');
    expect(chain.eq).toHaveBeenCalledWith('id', 'sr-1');
  });
});

describe('serviceRecords.service — deleteDraftServiceRecord', () => {
  it('exige status=draft', async () => {
    const chain = createChain();
    chain.eq
      .mockReturnValueOnce(chain)
      .mockResolvedValueOnce({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    await deleteDraftServiceRecord('sr-1');
    expect(chain.eq).toHaveBeenCalledWith('id', 'sr-1');
    expect(chain.eq).toHaveBeenCalledWith('status', 'draft');
  });
});

describe('serviceRecords.service — createChecklistItems', () => {
  it('inserta todos los ítems', async () => {
    const chain = createChain();
    chain.insert.mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const items = [
      { service_record_id: 'sr-1', item_name: 'Item 1', status: 'ok', notes: '' },
      { service_record_id: 'sr-1', item_name: 'Item 2', status: 'ok', notes: '' },
    ];
    await createChecklistItems(items as never);
    expect(chain.insert).toHaveBeenCalledWith(items);
  });
});

describe('serviceRecords.service — deleteChecklistByServiceRecord', () => {
  it('filtra por service_record_id', async () => {
    const chain = createChain();
    chain.eq.mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    await deleteChecklistByServiceRecord('sr-1');
    expect(chain.eq).toHaveBeenCalledWith('service_record_id', 'sr-1');
  });
});

describe('serviceRecords.service — getPhotosByServiceRecord', () => {
  it('ordena por created_at', async () => {
    const chain = createChain();
    chain.order.mockResolvedValue({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await getPhotosByServiceRecord('sr-1');
    expect(chain.order).toHaveBeenCalledWith('created_at');
  });
});

describe('serviceRecords.service — searchElevatorsForTechnician', () => {
  it('exige active=true', async () => {
    const chain = createChain();
    chain.limit.mockResolvedValue({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await searchElevatorsForTechnician('ASC');
    expect(chain.eq).toHaveBeenCalledWith('active', true);
  });

  it('limita a 20', async () => {
    const chain = createChain();
    chain.limit.mockResolvedValue({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await searchElevatorsForTechnician('ASC');
    expect(chain.limit).toHaveBeenCalledWith(20);
  });
});

describe('serviceRecords.service — errores', () => {
  it('errores Supabase se propagan', async () => {
    const chain = createChain();
    chain.order.mockResolvedValue({ data: null, error: { message: 'db error' } });
    mockFrom.mockReturnValue(chain);

    await expect(listMyServiceRecords('tech-1')).rejects.toEqual({ message: 'db error' });
  });

  it('una respuesta sin data devuelve arreglo vacío donde corresponda', async () => {
    const chain = createChain();
    chain.order.mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await listMyServiceRecords('tech-1');
    expect(result).toEqual([]);
  });
});
