import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));
vi.mock('@/config/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }) },
  },
}));

import {
  createMonthlyReport,
  findMonthlyReportByPeriod,
  validateReportRelations,
} from './monthlyReportEnhanced.service';

function createChain() {
  const select = vi.fn().mockReturnThis();
  const insert = vi.fn().mockReturnThis();
  const update = vi.fn().mockReturnThis();
  const eq = vi.fn().mockReturnThis();
  const single = vi.fn().mockResolvedValue({ data: null, error: null });
  const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const then = vi.fn().mockResolvedValue({ data: [], error: null });
  return { select, insert, update, eq, single, maybeSingle, then };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createMonthlyReport', () => {
  it('exige client_id', async () => {
    await expect(
      createMonthlyReport({
        elevator_id: 'e1',
        client_id: '',
        building_id: 'b1',
        report_month: 7,
        report_year: 2026,
      }),
    ).rejects.toThrow('Seleccioná un cliente.');
  });

  it('exige building_id', async () => {
    await expect(
      createMonthlyReport({
        elevator_id: 'e1',
        client_id: 'c1',
        building_id: '',
        report_month: 7,
        report_year: 2026,
      }),
    ).rejects.toThrow('Seleccioná un edificio.');
  });

  it('exige elevator_id', async () => {
    await expect(
      createMonthlyReport({
        elevator_id: '',
        client_id: 'c1',
        building_id: 'b1',
        report_month: 7,
        report_year: 2026,
      }),
    ).rejects.toThrow('Seleccioná un ascensor.');
  });

  it('inserta IDs correctos (elevator_id, client_id, building_id)', async () => {
    const chain = createChain();
    chain.insert.mockReturnValue({
      ...chain,
      single: vi.fn().mockResolvedValue({ data: { id: 'report-1' }, error: null }),
    });
    mockFrom.mockReturnValue({
      ...chain,
      select: vi.fn().mockReturnValue({
        ...chain,
        single: vi.fn().mockResolvedValue({ data: { id: 'report-1' }, error: null }),
      }),
    });

    const { insert } = chain;
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert,
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'report-1' }, error: null }),
    });

    const chain2 = createChain();
    const insertSpy = chain2.insert;
    chain2.select = vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'report-1' }, error: null }) });
    mockFrom.mockReturnValue(chain2);

    await createMonthlyReport({
      elevator_id: 'e1',
      client_id: 'c1',
      building_id: 'b1',
      report_month: 7,
      report_year: 2026,
    });

    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        elevator_id: 'e1',
        client_id: 'c1',
        building_id: 'b1',
      }),
    );
  });

  it('nunca usa building_id como client_id', async () => {
    const chain = createChain();
    chain.select = vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'report-1' }, error: null }) });
    mockFrom.mockReturnValue(chain);

    await createMonthlyReport({
      elevator_id: 'e1',
      client_id: 'c1',
      building_id: 'b1',
      report_month: 7,
      report_year: 2026,
    });

    const insertArg = chain.insert.mock.calls[0]?.[0] as Record<string, string>;
    expect(insertArg.client_id).toBe('c1');
    expect(insertArg.client_id).not.toBe(insertArg.building_id);
  });

  it('crea period YYYY-MM', async () => {
    const chain = createChain();
    chain.select = vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'report-1' }, error: null }) });
    mockFrom.mockReturnValue(chain);

    await createMonthlyReport({
      elevator_id: 'e1',
      client_id: 'c1',
      building_id: 'b1',
      report_month: 3,
      report_year: 2025,
    });

    const insertArg = chain.insert.mock.calls[0]?.[0] as Record<string, string>;
    expect(insertArg.period).toBe('2025-03');
  });

  it('crea status draft', async () => {
    const chain = createChain();
    chain.select = vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'report-1' }, error: null }) });
    mockFrom.mockReturnValue(chain);

    await createMonthlyReport({
      elevator_id: 'e1',
      client_id: 'c1',
      building_id: 'b1',
      report_month: 7,
      report_year: 2026,
    });

    const insertArg = chain.insert.mock.calls[0]?.[0] as Record<string, string>;
    expect(insertArg.status).toBe('draft');
  });

  it('crea services_count 0', async () => {
    const chain = createChain();
    chain.select = vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'report-1' }, error: null }) });
    mockFrom.mockReturnValue(chain);

    await createMonthlyReport({
      elevator_id: 'e1',
      client_id: 'c1',
      building_id: 'b1',
      report_month: 7,
      report_year: 2026,
    });

    const insertArg = chain.insert.mock.calls[0]?.[0] as Record<string, number>;
    expect(insertArg.services_count).toBe(0);
  });

  it('devuelve id y period', async () => {
    const chain = createChain();
    chain.select = vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'report-99' }, error: null }) });
    mockFrom.mockReturnValue(chain);

    const result = await createMonthlyReport({
      elevator_id: 'e1',
      client_id: 'c1',
      building_id: 'b1',
      report_month: 11,
      report_year: 2024,
    });

    expect(result).toEqual({ id: 'report-99', period: '2024-11' });
  });

  it('propaga error', async () => {
    const chain = createChain();
    chain.select = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'insert failed' } }),
    });
    mockFrom.mockReturnValue(chain);

    await expect(
      createMonthlyReport({
        elevator_id: 'e1',
        client_id: 'c1',
        building_id: 'b1',
        report_month: 7,
        report_year: 2026,
      }),
    ).rejects.toEqual({ message: 'insert failed' });
  });
});

describe('findMonthlyReportByPeriod', () => {
  it('usa maybeSingle', async () => {
    const chain = createChain();
    mockFrom.mockReturnValue(chain);

    await findMonthlyReportByPeriod('e1', 2026, 7);

    expect(chain.maybeSingle).toHaveBeenCalled();
  });

  it('sin fila devuelve null', async () => {
    const chain = createChain();
    chain.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await findMonthlyReportByPeriod('e1', 2026, 7);
    expect(result).toBeNull();
  });

  it('fila existente devuelve id', async () => {
    const chain = createChain();
    chain.maybeSingle.mockResolvedValue({ data: { id: 'existing-report' }, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await findMonthlyReportByPeriod('e1', 2026, 7);
    expect(result).toEqual({ id: 'existing-report' });
  });

  it('error real se propaga', async () => {
    const chain = createChain();
    chain.maybeSingle.mockResolvedValue({ data: null, error: { message: 'db error' } });
    mockFrom.mockReturnValue(chain);

    await expect(findMonthlyReportByPeriod('e1', 2026, 7)).rejects.toEqual({ message: 'db error' });
  });
});

describe('validateReportRelations', () => {
  function setupClientChain(active = true, error: unknown = null) {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'c1', active }, error }),
    };
  }

  function setupBuildingChain(clientId: string, active = true, error: unknown = null) {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'b1', active, client_id: clientId }, error }),
    };
  }

  function setupElevatorChain(buildingId: string, active = true, error: unknown = null) {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'e1', active, building_id: buildingId }, error }),
    };
  }

  it('validación confirma edificio-cliente', async () => {
    mockFrom
      .mockReturnValueOnce(setupClientChain(true))
      .mockReturnValueOnce(setupBuildingChain('c1', true))
      .mockReturnValueOnce(setupElevatorChain('b1', true));

    await expect(
      validateReportRelations('c1', 'b1', 'e1'),
    ).resolves.toBeUndefined();

    const buildingChain = mockFrom.mock.results[1].value;
    expect(buildingChain.eq).toHaveBeenCalledWith('id', 'b1');
  });

  it('validación confirma ascensor-edificio', async () => {
    mockFrom
      .mockReturnValueOnce(setupClientChain(true))
      .mockReturnValueOnce(setupBuildingChain('c1', true))
      .mockReturnValueOnce(setupElevatorChain('b1', true));

    await expect(
      validateReportRelations('c1', 'b1', 'e1'),
    ).resolves.toBeUndefined();

    const elevatorChain = mockFrom.mock.results[2].value;
    expect(elevatorChain.eq).toHaveBeenCalledWith('id', 'e1');
  });

  it('detecta cliente inactivo', async () => {
    mockFrom.mockReturnValueOnce(setupClientChain(false));

    await expect(
      validateReportRelations('c1', 'b1', 'e1'),
    ).rejects.toThrow('El cliente seleccionado ya no está activo.');
  });

  it('detecta edificio inactivo', async () => {
    mockFrom
      .mockReturnValueOnce(setupClientChain(true))
      .mockReturnValueOnce(setupBuildingChain('c1', false));

    await expect(
      validateReportRelations('c1', 'b1', 'e1'),
    ).rejects.toThrow('El edificio seleccionado ya no está activo.');
  });

  it('detecta ascensor inactivo', async () => {
    mockFrom
      .mockReturnValueOnce(setupClientChain(true))
      .mockReturnValueOnce(setupBuildingChain('c1', true))
      .mockReturnValueOnce(setupElevatorChain('b1', false));

    await expect(
      validateReportRelations('c1', 'b1', 'e1'),
    ).rejects.toThrow('El ascensor seleccionado ya no está activo.');
  });

  it('no modifica datos fuera de monthly_reports', async () => {
    mockFrom
      .mockReturnValueOnce(setupClientChain(true))
      .mockReturnValueOnce(setupBuildingChain('c1', true))
      .mockReturnValueOnce(setupElevatorChain('b1', true));

    await validateReportRelations('c1', 'b1', 'e1');

    const tableNames = mockFrom.mock.calls.map((call) => call[0]);
    expect(tableNames).not.toContain('monthly_reports');
  });
});
