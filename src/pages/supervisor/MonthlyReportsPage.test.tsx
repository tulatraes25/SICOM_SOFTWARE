import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MonthlyReportsPage from './MonthlyReportsPage';

const mocks = vi.hoisted(() => ({
  mockListMonthlyReports: vi.fn(),
  mockGetMonthlyReportStats: vi.fn(),
  mockCreateMonthlyReport: vi.fn(),
  mockFindMonthlyReportByPeriod: vi.fn(),
  mockValidateReportRelations: vi.fn(),
  mockListMonthlyReportsBasic: vi.fn(),
  mockNavigate: vi.fn(),
  mockSupabaseFrom: vi.fn(),
}));
vi.mock('@/services/monthlyReportEnhanced.service', () => ({
  listMonthlyReports: (...a: unknown[]) => mocks.mockListMonthlyReports(...a),
  getMonthlyReportStats: (...a: unknown[]) => mocks.mockGetMonthlyReportStats(...a),
  createMonthlyReport: (...a: unknown[]) => mocks.mockCreateMonthlyReport(...a),
  findMonthlyReportByPeriod: (...a: unknown[]) => mocks.mockFindMonthlyReportByPeriod(...a),
  validateReportRelations: (...a: unknown[]) => mocks.mockValidateReportRelations(...a),
}));
vi.mock('@/services/monthlyReports.service', () => ({
  listMonthlyReports: (...a: unknown[]) => mocks.mockListMonthlyReportsBasic(...a),
}));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mocks.mockNavigate };
});
vi.mock('@/config/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mocks.mockSupabaseFrom(...args),
  },
}));
vi.mock('@/components/layout/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function makeChain(data: unknown, error: unknown = null) {
  const result = { data, error };
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    or: vi.fn().mockReturnThis(),
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
      if (error && reject) reject(error); else resolve(result);
      return { catch: () => ({}) };
    },
  };
  return chain;
}

let chainIdx: number;
function setupSequentialChains(chains: Record<string, unknown>[]) {
  chainIdx = 0;
  mocks.mockSupabaseFrom.mockImplementation(() => {
    const chain = chains[chainIdx] ?? makeChain([]);
    chainIdx++;
    return chain;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockListMonthlyReports.mockResolvedValue([]);
  mocks.mockGetMonthlyReportStats.mockResolvedValue({ total: 0, pending: 0, generated: 0, sent: 0 });
  mocks.mockCreateMonthlyReport.mockResolvedValue({ id: 'new-report', period: '2026-07' });
  mocks.mockFindMonthlyReportByPeriod.mockResolvedValue(null);
  mocks.mockValidateReportRelations.mockResolvedValue(undefined);
  mocks.mockListMonthlyReportsBasic.mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/informes-mensuales']}>
      <Routes>
        <Route path="/admin/informes-mensuales" element={<MonthlyReportsPage />} />
        <Route path="/admin/informes-mensuales/:id" element={<div>Detail View</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MonthlyReportsPage — listado', () => {
  it('carga informes', async () => {
    mocks.mockListMonthlyReports.mockResolvedValue([
      { id: 'r1', report_month: 7, report_year: 2026, status: 'draft', pdf_url: null, elevator: { code: 'ASC-01' } },
    ]);
    mocks.mockGetMonthlyReportStats.mockResolvedValue({ total: 1, pending: 1, generated: 0, sent: 0 });
    setupSequentialChains([makeChain([{ id: 'c1', name: 'Cliente A' }])]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('ASC-01')).toBeInTheDocument();
    });
    expect(mocks.mockListMonthlyReports).toHaveBeenCalled();
    expect(mocks.mockGetMonthlyReportStats).toHaveBeenCalled();
  });

  it('muestra estado de carga', async () => {
    mocks.mockListMonthlyReports.mockReturnValue(new Promise(() => {}));
    setupSequentialChains([makeChain([])]);

    renderPage();

    await waitFor(() => {
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  it('error visible del listado', async () => {
    mocks.mockListMonthlyReports.mockRejectedValue(new Error('Network'));
    setupSequentialChains([makeChain([])]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByText(/No se pudieron cargar/)).toBeInTheDocument();
  });

  it('Reintentar', async () => {
    mocks.mockListMonthlyReports.mockRejectedValueOnce(new Error('fail'));
    setupSequentialChains([makeChain([])]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    mocks.mockListMonthlyReports.mockResolvedValue([
      { id: 'r1', report_month: 7, report_year: 2026, status: 'draft', pdf_url: null, elevator: { code: 'ASC-02' } },
    ]);
    mocks.mockGetMonthlyReportStats.mockResolvedValue({ total: 1, pending: 1, generated: 0, sent: 0 });

    fireEvent.click(screen.getByText(/Reintentar/));

    await waitFor(() => {
      expect(screen.getByText('ASC-02')).toBeInTheDocument();
    });
  });

  it('filtro por estado', async () => {
    setupSequentialChains([makeChain([])]);

    renderPage();

    await waitFor(() => {
      expect(mocks.mockListMonthlyReports).toHaveBeenCalledTimes(1);
    });

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'approved' } });

    await waitFor(() => {
      expect(mocks.mockListMonthlyReports).toHaveBeenCalledWith({ status: 'approved' });
    });
  });

  it('respuesta antigua ignorada', async () => {
    mocks.mockListMonthlyReports
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'r2', report_month: 6, report_year: 2026, status: 'draft', pdf_url: null, elevator: { code: 'ASC-FINAL' } },
      ]);
    mocks.mockGetMonthlyReportStats
      .mockResolvedValueOnce({ total: 0, pending: 0, generated: 0, sent: 0 })
      .mockResolvedValueOnce({ total: 1, pending: 1, generated: 0, sent: 0 });
    setupSequentialChains([makeChain([])]);

    renderPage();

    await waitFor(() => {
      expect(mocks.mockListMonthlyReports).toHaveBeenCalledTimes(1);
    });

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'approved' } });

    await waitFor(() => {
      expect(screen.getByText('ASC-FINAL')).toBeInTheDocument();
    });
  });
});

describe('MonthlyReportsPage — modal', () => {
  it('abre modal Nuevo informe mensual', async () => {
    setupSequentialChains([makeChain([])]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Nuevo informe mensual')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Nuevo informe mensual'));

    await waitFor(() => {
      expect(screen.getByText('Crear borrador')).toBeInTheDocument();
    });
  });

  it('exige cliente', async () => {
    setupSequentialChains([makeChain([])]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Nuevo informe mensual')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Nuevo informe mensual'));
    await waitFor(() => {
      expect(screen.getByText('Crear borrador')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Crear borrador'));

    await waitFor(() => {
      expect(screen.getByText('Seleccioná un cliente.')).toBeInTheDocument();
    });
  });

  it('exige edificio', async () => {
    setupSequentialChains([
      makeChain([{ id: 'c1', name: 'Cliente A' }]),
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Nuevo informe mensual')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Nuevo informe mensual'));
    await waitFor(() => {
      expect(screen.getByText('Crear borrador')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Cliente A')).toBeInTheDocument();
    });

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'c1' } });

    fireEvent.click(screen.getByText('Crear borrador'));

    await waitFor(() => {
      expect(screen.getByText('Seleccioná un edificio.')).toBeInTheDocument();
    });
  });

  it('exige ascensor', async () => {
    setupSequentialChains([
      makeChain([{ id: 'c1', name: 'Cliente A' }]),
      makeChain([{ id: 'b1', name: 'Edificio 1' }]),
      makeChain([{ id: 'e1', code: 'ASC-01' }]),
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Nuevo informe mensual')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Nuevo informe mensual'));
    await waitFor(() => {
      expect(screen.getByText('Crear borrador')).toBeInTheDocument();
    });

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Edificio 1')).toBeInTheDocument(); });

    fireEvent.change(selects[2], { target: { value: 'b1' } });
    await waitFor(() => { expect(screen.getByText('ASC-01')).toBeInTheDocument(); });

    fireEvent.click(screen.getByText('Crear borrador'));

    await waitFor(() => {
      expect(screen.getByText('Seleccioná un ascensor.')).toBeInTheDocument();
    });
  });

  it('carga edificios al elegir cliente', async () => {
    setupSequentialChains([
      makeChain([{ id: 'c1', name: 'Cliente A' }]),
      makeChain([{ id: 'b1', name: 'Edificio 1' }]),
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Nuevo informe mensual')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Nuevo informe mensual'));
    await waitFor(() => {
      expect(screen.getByText('Crear borrador')).toBeInTheDocument();
    });

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'c1' } });

    await waitFor(() => {
      expect(screen.getByText('Edificio 1')).toBeInTheDocument();
    });
  });

  it('limpia edificio y ascensor al cambiar cliente', async () => {
    setupSequentialChains([
      makeChain([{ id: 'c1', name: 'Cliente A' }]),
      makeChain([{ id: 'b1', name: 'Edificio 1' }]),
      makeChain([]),
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Nuevo informe mensual')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Nuevo informe mensual'));
    await waitFor(() => {
      expect(screen.getByText('Crear borrador')).toBeInTheDocument();
    });

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Edificio 1')).toBeInTheDocument(); });

    fireEvent.change(selects[1], { target: { value: 'c2' } });

    await waitFor(() => {
      expect(selects[2]).toHaveValue('');
    });
  });

  it('carga ascensores al elegir edificio', async () => {
    setupSequentialChains([
      makeChain([{ id: 'c1', name: 'Cliente A' }]),
      makeChain([{ id: 'b1', name: 'Edificio 1' }]),
      makeChain([{ id: 'e1', code: 'ASC-01' }]),
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Nuevo informe mensual')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Nuevo informe mensual'));
    await waitFor(() => {
      expect(screen.getByText('Crear borrador')).toBeInTheDocument();
    });

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Edificio 1')).toBeInTheDocument(); });

    fireEvent.change(selects[2], { target: { value: 'b1' } });

    await waitFor(() => {
      expect(screen.getByText('ASC-01')).toBeInTheDocument();
    });
  });

  it('limpia ascensor al cambiar edificio', async () => {
    setupSequentialChains([
      makeChain([{ id: 'c1', name: 'Cliente A' }]),
      makeChain([{ id: 'b1', name: 'Edificio 1' }]),
      makeChain([{ id: 'e1', code: 'ASC-01' }]),
      makeChain([]),
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Nuevo informe mensual')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Nuevo informe mensual'));
    await waitFor(() => {
      expect(screen.getByText('Crear borrador')).toBeInTheDocument();
    });

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Edificio 1')).toBeInTheDocument(); });

    fireEvent.change(selects[2], { target: { value: 'b1' } });
    await waitFor(() => { expect(screen.getByText('ASC-01')).toBeInTheDocument(); });

    fireEvent.change(selects[2], { target: { value: 'b2' } });

    await waitFor(() => {
      expect(selects[3]).toHaveValue('');
    });
  });

  it('error al cargar edificios', async () => {
    setupSequentialChains([
      makeChain([{ id: 'c1', name: 'Cliente A' }]),
      makeChain(null, { message: 'load failed' }),
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Nuevo informe mensual')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Nuevo informe mensual'));
    await waitFor(() => {
      expect(screen.getByText('Crear borrador')).toBeInTheDocument();
    });

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'c1' } });

    await waitFor(() => {
      expect(screen.queryByText('Edificio 1')).not.toBeInTheDocument();
    });
  });

  it('error al cargar ascensores', async () => {
    setupSequentialChains([
      makeChain([{ id: 'c1', name: 'Cliente A' }]),
      makeChain([{ id: 'b1', name: 'Edificio 1' }]),
      makeChain(null, { message: 'load failed' }),
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Nuevo informe mensual')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Nuevo informe mensual'));
    await waitFor(() => {
      expect(screen.getByText('Crear borrador')).toBeInTheDocument();
    });

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Edificio 1')).toBeInTheDocument(); });

    fireEvent.change(selects[2], { target: { value: 'b1' } });

    await waitFor(() => {
      expect(screen.queryByText('ASC-01')).not.toBeInTheDocument();
    });
  });

  it('valida relaciones antes de crear', async () => {
    setupSequentialChains([
      makeChain([{ id: 'c1', name: 'Cliente A' }]),
      makeChain([{ id: 'b1', name: 'Edificio 1' }]),
      makeChain([{ id: 'e1', code: 'ASC-01' }]),
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Nuevo informe mensual')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Nuevo informe mensual'));
    await waitFor(() => {
      expect(screen.getByText('Crear borrador')).toBeInTheDocument();
    });

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Edificio 1')).toBeInTheDocument(); });

    fireEvent.change(selects[2], { target: { value: 'b1' } });
    await waitFor(() => { expect(screen.getByText('ASC-01')).toBeInTheDocument(); });

    fireEvent.change(selects[3], { target: { value: 'e1' } });

    fireEvent.click(screen.getByText('Crear borrador'));

    await waitFor(() => {
      expect(mocks.mockValidateReportRelations).toHaveBeenCalledWith('c1', 'b1', 'e1');
    });
  });

  it('busca duplicado', async () => {
    setupSequentialChains([
      makeChain([{ id: 'c1', name: 'Cliente A' }]),
      makeChain([{ id: 'b1', name: 'Edificio 1' }]),
      makeChain([{ id: 'e1', code: 'ASC-01' }]),
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Nuevo informe mensual')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Nuevo informe mensual'));
    await waitFor(() => {
      expect(screen.getByText('Crear borrador')).toBeInTheDocument();
    });

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Edificio 1')).toBeInTheDocument(); });

    fireEvent.change(selects[2], { target: { value: 'b1' } });
    await waitFor(() => { expect(screen.getByText('ASC-01')).toBeInTheDocument(); });

    fireEvent.change(selects[3], { target: { value: 'e1' } });

    fireEvent.click(screen.getByText('Crear borrador'));

    await waitFor(() => {
      expect(mocks.mockFindMonthlyReportByPeriod).toHaveBeenCalledWith(
        'e1',
        expect.any(Number),
        expect.any(Number),
      );
    });
  });

  it('duplicado no inserta', async () => {
    mocks.mockFindMonthlyReportByPeriod.mockResolvedValue({ id: 'existing' });
    setupSequentialChains([
      makeChain([{ id: 'c1', name: 'Cliente A' }]),
      makeChain([{ id: 'b1', name: 'Edificio 1' }]),
      makeChain([{ id: 'e1', code: 'ASC-01' }]),
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Nuevo informe mensual')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Nuevo informe mensual'));
    await waitFor(() => {
      expect(screen.getByText('Crear borrador')).toBeInTheDocument();
    });

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Edificio 1')).toBeInTheDocument(); });

    fireEvent.change(selects[2], { target: { value: 'b1' } });
    await waitFor(() => { expect(screen.getByText('ASC-01')).toBeInTheDocument(); });

    fireEvent.change(selects[3], { target: { value: 'e1' } });

    fireEvent.click(screen.getByText('Crear borrador'));

    await waitFor(() => {
      expect(screen.getByText(/Ya existe un informe/)).toBeInTheDocument();
    });
    expect(mocks.mockCreateMonthlyReport).not.toHaveBeenCalled();
  });

  it('creación usa createMonthlyReport', async () => {
    setupSequentialChains([
      makeChain([{ id: 'c1', name: 'Cliente A' }]),
      makeChain([{ id: 'b1', name: 'Edificio 1' }]),
      makeChain([{ id: 'e1', code: 'ASC-01' }]),
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Nuevo informe mensual')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Nuevo informe mensual'));
    await waitFor(() => {
      expect(screen.getByText('Crear borrador')).toBeInTheDocument();
    });

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Edificio 1')).toBeInTheDocument(); });

    fireEvent.change(selects[2], { target: { value: 'b1' } });
    await waitFor(() => { expect(screen.getByText('ASC-01')).toBeInTheDocument(); });

    fireEvent.change(selects[3], { target: { value: 'e1' } });

    fireEvent.click(screen.getByText('Crear borrador'));

    await waitFor(() => {
      expect(mocks.mockCreateMonthlyReport).toHaveBeenCalled();
    });
  });

  it('pasa client_id correcto', async () => {
    setupSequentialChains([
      makeChain([{ id: 'c1', name: 'Cliente A' }]),
      makeChain([{ id: 'b1', name: 'Edificio 1' }]),
      makeChain([{ id: 'e1', code: 'ASC-01' }]),
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Nuevo informe mensual')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Nuevo informe mensual'));
    await waitFor(() => {
      expect(screen.getByText('Crear borrador')).toBeInTheDocument();
    });

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Edificio 1')).toBeInTheDocument(); });

    fireEvent.change(selects[2], { target: { value: 'b1' } });
    await waitFor(() => { expect(screen.getByText('ASC-01')).toBeInTheDocument(); });

    fireEvent.change(selects[3], { target: { value: 'e1' } });

    fireEvent.click(screen.getByText('Crear borrador'));

    await waitFor(() => {
      expect(mocks.mockCreateMonthlyReport).toHaveBeenCalledWith(
        expect.objectContaining({ client_id: 'c1' }),
      );
    });
  });

  it('pasa building_id correcto', async () => {
    setupSequentialChains([
      makeChain([{ id: 'c1', name: 'Cliente A' }]),
      makeChain([{ id: 'b1', name: 'Edificio 1' }]),
      makeChain([{ id: 'e1', code: 'ASC-01' }]),
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Nuevo informe mensual')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Nuevo informe mensual'));
    await waitFor(() => {
      expect(screen.getByText('Crear borrador')).toBeInTheDocument();
    });

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Edificio 1')).toBeInTheDocument(); });

    fireEvent.change(selects[2], { target: { value: 'b1' } });
    await waitFor(() => { expect(screen.getByText('ASC-01')).toBeInTheDocument(); });

    fireEvent.change(selects[3], { target: { value: 'e1' } });

    fireEvent.click(screen.getByText('Crear borrador'));

    await waitFor(() => {
      expect(mocks.mockCreateMonthlyReport).toHaveBeenCalledWith(
        expect.objectContaining({ building_id: 'b1' }),
      );
    });
  });

  it('pasa elevator_id correcto', async () => {
    setupSequentialChains([
      makeChain([{ id: 'c1', name: 'Cliente A' }]),
      makeChain([{ id: 'b1', name: 'Edificio 1' }]),
      makeChain([{ id: 'e1', code: 'ASC-01' }]),
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Nuevo informe mensual')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Nuevo informe mensual'));
    await waitFor(() => {
      expect(screen.getByText('Crear borrador')).toBeInTheDocument();
    });

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Edificio 1')).toBeInTheDocument(); });

    fireEvent.change(selects[2], { target: { value: 'b1' } });
    await waitFor(() => { expect(screen.getByText('ASC-01')).toBeInTheDocument(); });

    fireEvent.change(selects[3], { target: { value: 'e1' } });

    fireEvent.click(screen.getByText('Crear borrador'));

    await waitFor(() => {
      expect(mocks.mockCreateMonthlyReport).toHaveBeenCalledWith(
        expect.objectContaining({ elevator_id: 'e1' }),
      );
    });
  });

  it('pasa mes y año correctos', async () => {
    setupSequentialChains([
      makeChain([{ id: 'c1', name: 'Cliente A' }]),
      makeChain([{ id: 'b1', name: 'Edificio 1' }]),
      makeChain([{ id: 'e1', code: 'ASC-01' }]),
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Nuevo informe mensual')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Nuevo informe mensual'));
    await waitFor(() => {
      expect(screen.getByText('Crear borrador')).toBeInTheDocument();
    });

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Edificio 1')).toBeInTheDocument(); });

    fireEvent.change(selects[2], { target: { value: 'b1' } });
    await waitFor(() => { expect(screen.getByText('ASC-01')).toBeInTheDocument(); });

    fireEvent.change(selects[3], { target: { value: 'e1' } });

    fireEvent.change(selects[4], { target: { value: '3' } });
    fireEvent.change(selects[5], { target: { value: '2025' } });

    fireEvent.click(screen.getByText('Crear borrador'));

    await waitFor(() => {
      expect(mocks.mockCreateMonthlyReport).toHaveBeenCalledWith(
        expect.objectContaining({ report_month: 3, report_year: 2025 }),
      );
    });
  });

  it('navega al ID creado', async () => {
    mocks.mockCreateMonthlyReport.mockResolvedValue({ id: 'new-report-123', period: '2026-07' });
    setupSequentialChains([
      makeChain([{ id: 'c1', name: 'Cliente A' }]),
      makeChain([{ id: 'b1', name: 'Edificio 1' }]),
      makeChain([{ id: 'e1', code: 'ASC-01' }]),
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Nuevo informe mensual')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Nuevo informe mensual'));
    await waitFor(() => {
      expect(screen.getByText('Crear borrador')).toBeInTheDocument();
    });

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Edificio 1')).toBeInTheDocument(); });

    fireEvent.change(selects[2], { target: { value: 'b1' } });
    await waitFor(() => { expect(screen.getByText('ASC-01')).toBeInTheDocument(); });

    fireEvent.change(selects[3], { target: { value: 'e1' } });

    fireEvent.click(screen.getByText('Crear borrador'));

    await waitFor(() => {
      expect(mocks.mockNavigate).toHaveBeenCalledWith('/admin/informes-mensuales/new-report-123');
    });
  });

  it('error de creación visible', async () => {
    mocks.mockCreateMonthlyReport.mockRejectedValue(new Error('Creation failed'));
    setupSequentialChains([
      makeChain([{ id: 'c1', name: 'Cliente A' }]),
      makeChain([{ id: 'b1', name: 'Edificio 1' }]),
      makeChain([{ id: 'e1', code: 'ASC-01' }]),
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Nuevo informe mensual')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Nuevo informe mensual'));
    await waitFor(() => {
      expect(screen.getByText('Crear borrador')).toBeInTheDocument();
    });

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Edificio 1')).toBeInTheDocument(); });

    fireEvent.change(selects[2], { target: { value: 'b1' } });
    await waitFor(() => { expect(screen.getByText('ASC-01')).toBeInTheDocument(); });

    fireEvent.change(selects[3], { target: { value: 'e1' } });

    fireEvent.click(screen.getByText('Crear borrador'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Creation failed');
    });
  });

  it('doble clic genera una sola creación', async () => {
    setupSequentialChains([
      makeChain([{ id: 'c1', name: 'Cliente A' }]),
      makeChain([{ id: 'b1', name: 'Edificio 1' }]),
      makeChain([{ id: 'e1', code: 'ASC-01' }]),
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Nuevo informe mensual')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Nuevo informe mensual'));
    await waitFor(() => {
      expect(screen.getByText('Crear borrador')).toBeInTheDocument();
    });

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Edificio 1')).toBeInTheDocument(); });

    fireEvent.change(selects[2], { target: { value: 'b1' } });
    await waitFor(() => { expect(screen.getByText('ASC-01')).toBeInTheDocument(); });

    fireEvent.change(selects[3], { target: { value: 'e1' } });

    const btn = screen.getByText('Crear borrador');
    fireEvent.click(btn);
    fireEvent.click(btn);

    await waitFor(() => {
      expect(mocks.mockCreateMonthlyReport).toHaveBeenCalledTimes(1);
    });
  });

  it('no realiza insert directo desde la página', async () => {
    setupSequentialChains([
      makeChain([{ id: 'c1', name: 'Cliente A' }]),
      makeChain([{ id: 'b1', name: 'Edificio 1' }]),
      makeChain([{ id: 'e1', code: 'ASC-01' }]),
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Nuevo informe mensual')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Nuevo informe mensual'));
    await waitFor(() => {
      expect(screen.getByText('Crear borrador')).toBeInTheDocument();
    });

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Edificio 1')).toBeInTheDocument(); });

    fireEvent.change(selects[2], { target: { value: 'b1' } });
    await waitFor(() => { expect(screen.getByText('ASC-01')).toBeInTheDocument(); });

    fireEvent.change(selects[3], { target: { value: 'e1' } });

    fireEvent.click(screen.getByText('Crear borrador'));

    await waitFor(() => {
      expect(mocks.mockCreateMonthlyReport).toHaveBeenCalled();
    });

    const fromCalls = mocks.mockSupabaseFrom.mock.calls.map((call) => call[0]);
    expect(fromCalls).not.toContain('monthly_reports');
  });

  it('cancelar cierra modal sin crear', async () => {
    setupSequentialChains([makeChain([])]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Nuevo informe mensual')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Nuevo informe mensual'));
    await waitFor(() => {
      expect(screen.getByText('Crear borrador')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Cancelar'));

    await waitFor(() => {
      expect(screen.queryByText('Crear borrador')).not.toBeInTheDocument();
    });
    expect(mocks.mockCreateMonthlyReport).not.toHaveBeenCalled();
  });
});
