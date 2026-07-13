import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock de Supabase
vi.mock('@/config/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      order: vi.fn().mockReturnThis(),
    })),
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  },
}));

describe('Service Records Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listMyServiceRecords retorna array vacío con mock', async () => {
    const { listMyServiceRecords } = await import('@/services/serviceRecords.service');
    const result = await listMyServiceRecords('test-user-id');
    expect(result).toEqual([]);
  });
});

describe('Public Elevator Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getPublicElevatorByToken retorna null para token inválido', async () => {
    const { getPublicElevatorByToken } = await import('@/services/publicElevator.service');
    const result = await getPublicElevatorByToken('invalid-token');
    expect(result).toBeNull();
  });

  it('getPublicServiceHistory retorna array vacío para token inválido', async () => {
    const { getPublicServiceHistory } = await import('@/services/publicElevator.service');
    const result = await getPublicServiceHistory('invalid-token');
    expect(result).toEqual([]);
  });
});
