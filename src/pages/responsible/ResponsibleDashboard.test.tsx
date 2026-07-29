import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import ResponsibleDashboard from './ResponsibleDashboard';
import type { ResponsibleBuilding, ResponsibleElevator, ResponsibleVisitEntry, ResponsibleMonthlyReport } from '@/services/responsiblePortalService';
import type { UserRole } from '@/types/roles';

const RESPONSIBLE_ROLE: UserRole = 'responsible';

// ============================================================
// Mocks
// ============================================================

const mockBuildings: ResponsibleBuilding[] = [
  { id: 'building-1', client_id: 'client-1', code: 'ED-001', name: 'Hospital Regional', address: 'Av. Principal 123', locality: 'Comodoro Rivadavia', province: 'Chubut' },
  { id: 'building-2', client_id: 'client-2', code: 'ED-002', name: 'Clínica del Sur', address: 'Calle X 456', locality: 'Rawson', province: 'Chubut' },
];

const mockElevators: ResponsibleElevator[] = [
  { id: 'elevator-1', code: 'ASC-0001', building_id: 'building-1', manufacturer: 'Otis', model: 'Gen2', elevator_type: 'passenger', capacity_kg: 800, floors_served: '1-5', year_installed: 2020, operational_status: 'operational', conservation_status: 'good', contractual_status: 'active', last_service_date: null, next_service_date: null, active: true },
  { id: 'elevator-2', code: 'ASC-0002', building_id: 'building-1', manufacturer: 'Schindler', model: '3300', elevator_type: 'passenger', capacity_kg: 1000, floors_served: '1-8', year_installed: 2019, operational_status: 'operational', conservation_status: 'good', contractual_status: 'active', last_service_date: null, next_service_date: null, active: true },
  { id: 'elevator-3', code: 'ASC-0010', building_id: 'building-2', manufacturer: 'Kone', model: 'MiniSpace', elevator_type: 'passenger', capacity_kg: 630, floors_served: '1-3', year_installed: 2021, operational_status: 'operational', conservation_status: 'good', contractual_status: 'active', last_service_date: null, next_service_date: null, active: true },
];

function makeVisit(overrides: Partial<ResponsibleVisitEntry> = {}): ResponsibleVisitEntry {
  return {
    id: 'v-1', elevator_id: 'elevator-1', service_case_id: null, service_record_id: null,
    service_order_id: null, entry_number: 1, visit_date: '2026-07-27', entry_type: 'other',
    origin_type: 'maintenance', title: 'Test', description: 'Test desc',
    work_performed: null, observations: null, recommendations: null,
    operational_status: null, conservation_status: null, technician_id: 'tech-1',
    status: 'approved', check_in_at: null, check_out_at: null,
    duration_minutes: null, duration_seconds: null, case_number: null, numbering_mode: null,
    ...overrides,
  };
}

function makeReport(overrides: Partial<ResponsibleMonthlyReport> = {}): ResponsibleMonthlyReport {
  return {
    id: 'r-1', elevator_id: 'elevator-1', period: '2026-07', title: null,
    status: 'approved', general_status: null, services_count: null,
    report_month: 7, report_year: 2026, pdf_generated_at: null, has_pdf: false,
    ...overrides,
  };
}

function dateInRelativeMonth(offset: number, day: number): string {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() + offset, day);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function currentMonthDay(day: number): string {
  return dateInRelativeMonth(0, day);
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

vi.mock('@/services/responsiblePortalService', () => ({
  getResponsibleBuildings: vi.fn(),
  getResponsibleElevators: vi.fn(),
  getResponsibleVisitEntries: vi.fn(),
  getResponsibleMonthlyReports: vi.fn(),
  getErrorMessage: vi.fn((e: unknown) => e instanceof Error ? e.message : 'Error'),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/components/layout/Sidebar', () => ({
  default: vi.fn(() => <div data-testid="sidebar" />),
}));

// ============================================================
// Setup
// ============================================================

import { getResponsibleBuildings, getResponsibleElevators, getResponsibleVisitEntries, getResponsibleMonthlyReports } from '@/services/responsiblePortalService';

const mockGetBuildings = vi.mocked(getResponsibleBuildings);
const mockGetElevators = vi.mocked(getResponsibleElevators);
const mockGetVisitEntries = vi.mocked(getResponsibleVisitEntries);
const mockGetReports = vi.mocked(getResponsibleMonthlyReports);
const mockUseAuth = vi.mocked(useAuth);

function makeAuthContext(fullName = 'Claudio Tula') {
  return {
    user: { id: 'user-1', email: 'claudio@test.com', app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '' },
    profile: { id: 'user-1', full_name: fullName, role: RESPONSIBLE_ROLE, email: 'claudio@test.com', active: true, created_at: '', updated_at: '', phone: undefined },
    logout: () => Promise.resolve(),
    login: () => Promise.resolve({ error: null, profile: { id: 'user-1', full_name: fullName, role: RESPONSIBLE_ROLE, email: 'claudio@test.com', active: true, created_at: '', updated_at: '', phone: undefined } }),
    getRedirectPath: () => '/responsable',
    hasRole: () => true,
    isAdmin: false,
    isTechnician: false,
    isSupervisor: false,
    isResponsible: true,
    isAuthenticated: true,
    loading: false,
    error: null,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ResponsibleDashboard />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue(makeAuthContext());
  mockGetBuildings.mockResolvedValue(mockBuildings);
  mockGetElevators.mockResolvedValue(mockElevators);
  mockGetVisitEntries.mockResolvedValue([]);
  mockGetReports.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ============================================================
// Tests
// ============================================================

describe('ResponsibleDashboard', () => {
  describe('Saludo', () => {
    it('muestra full_name del perfil y no muestra el correo', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Bienvenido/a, Claudio Tula')).toBeInTheDocument();
      });
      expect(screen.queryByText('claudio@test.com')).not.toBeInTheDocument();
      expect(screen.queryByText('claudio')).not.toBeInTheDocument();
    });

    it('muestra "Responsable" cuando full_name está vacío', async () => {
      mockUseAuth.mockReturnValue(makeAuthContext(''));
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Bienvenido/a, Responsable')).toBeInTheDocument();
      });
    });
  });

  describe('Métricas', () => {
    it('muestra 2 edificios, 3 ascensores y 4 informes', async () => {
      mockGetReports.mockResolvedValue([makeReport(), makeReport({ id: 'r-2' }), makeReport({ id: 'r-3' }), makeReport({ id: 'r-4' })]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Edificios')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('Ascensores')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(screen.getByText('Informes')).toBeInTheDocument();
        expect(screen.getByText('4')).toBeInTheDocument();
      });
    });

    it('cuenta visitas del mes actual correctamente', async () => {
      const visits = Array.from({ length: 15 }, (_, i) =>
        makeVisit({ id: `v-${i + 1}`, visit_date: currentMonthDay(Math.min(i + 1, 28)), title: `Visita ${String(i + 1).padStart(2, '0')}` })
      );
      mockGetVisitEntries.mockResolvedValue(visits);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Visitas del mes')).toBeInTheDocument();
        expect(screen.getByText('15')).toBeInTheDocument();
      });
    });
  });

  describe('Filtro del mes actual', () => {
    it('no cuenta visitas de otros meses', async () => {
      const current = Array.from({ length: 10 }, (_, i) =>
        makeVisit({ id: `cur-${i}`, visit_date: currentMonthDay(i + 1), title: `Actual ${i}` })
      );
      const prev = Array.from({ length: 5 }, (_, i) =>
        makeVisit({ id: `prev-${i}`, visit_date: dateInRelativeMonth(-1, i + 1), title: `Anterior ${i}` })
      );
      const next = Array.from({ length: 3 }, (_, i) =>
        makeVisit({ id: `next-${i}`, visit_date: dateInRelativeMonth(1, i + 1), title: `Futuro ${i}` })
      );
      mockGetVisitEntries.mockResolvedValue([...current, ...prev, ...next]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('10')).toBeInTheDocument();
      });
    });
  });

  describe('Última actividad', () => {
    it('muestra exactamente 10 actividades en orden descendente', async () => {
      const visits = Array.from({ length: 15 }, (_, i) => {
        const day = Math.min(i + 1, 28);
        return makeVisit({ id: `v-${i + 1}`, visit_date: currentMonthDay(day), title: `Visita ${String(i + 1).padStart(2, '0')}` });
      });
      mockGetVisitEntries.mockResolvedValue(visits);
      renderPage();
      await waitFor(() => {
        const items = screen.getAllByText(/Visita \d{2}/);
        expect(items).toHaveLength(10);
        expect(items[0]).toHaveTextContent('Visita 15');
        expect(items[9]).toHaveTextContent('Visita 06');
        expect(screen.queryByText(/Visita 05/)).not.toBeInTheDocument();
      });
    });

    it('muestra "No hay visitas recientes" cuando no hay visitas', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('No hay visitas recientes')).toBeInTheDocument();
      });
    });
  });

  describe('Edificio y ascensor', () => {
    it('muestra nombre del edificio y código del ascensor', async () => {
      mockGetVisitEntries.mockResolvedValue([
        makeVisit({ id: 'v-1', elevator_id: 'elevator-1', visit_date: '2026-07-27', title: 'Test elevator-1' }),
        makeVisit({ id: 'v-2', elevator_id: 'elevator-3', visit_date: '2026-07-26', title: 'Test elevator-3' }),
      ]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/Hospital Regional · ASC-0001/)).toBeInTheDocument();
        expect(screen.getByText(/Clínica del Sur · ASC-0010/)).toBeInTheDocument();
      });
    });

    it('no muestra elevator_id ni building_id como texto visible', async () => {
      mockGetVisitEntries.mockResolvedValue([makeVisit({ id: 'v-1', elevator_id: 'elevator-1', visit_date: '2026-07-27', title: 'Test' })]);
      renderPage();
      await waitFor(() => {
        expect(screen.queryByText('elevator-1')).not.toBeInTheDocument();
        expect(screen.queryByText('building-1')).not.toBeInTheDocument();
      });
    });
  });

  describe('Orígenes traducidos', () => {
    it('traduce todos los orígenes al español', async () => {
      mockGetVisitEntries.mockResolvedValue([
        makeVisit({ id: 'v-1', visit_date: currentMonthDay(1), origin_type: 'maintenance', title: 'Mant' }),
        makeVisit({ id: 'v-2', visit_date: currentMonthDay(2), origin_type: 'service_order', title: 'Orden' }),
        makeVisit({ id: 'v-3', visit_date: currentMonthDay(3), origin_type: 'inspection', title: 'Insp' }),
        makeVisit({ id: 'v-4', visit_date: currentMonthDay(4), origin_type: 'manual', title: 'Manual' }),
        makeVisit({ id: 'v-5', visit_date: currentMonthDay(5), origin_type: 'claim', title: 'Reclamo' }),
      ]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/Mantenimiento/)).toBeInTheDocument();
        expect(screen.getByText(/Orden de servicio/)).toBeInTheDocument();
        expect(screen.getByText(/Inspección/)).toBeInTheDocument();
        expect(screen.getByText(/Registro manual/)).toBeInTheDocument();
        expect(screen.getByText(/Reclamo/)).toBeInTheDocument();
      });
    });

    it('no muestra valores técnicos en inglés', async () => {
      mockGetVisitEntries.mockResolvedValue([
        makeVisit({ id: 'v-1', visit_date: currentMonthDay(1), origin_type: 'maintenance', title: 'M' }),
        makeVisit({ id: 'v-2', visit_date: currentMonthDay(2), origin_type: 'service_order', title: 'O' }),
      ]);
      renderPage();
      await waitFor(() => {
        const text = document.body.textContent || '';
        expect(text).not.toContain('maintenance');
        expect(text).not.toContain('service_order');
      });
    });
  });

  describe('Expediente y duración', () => {
    it('muestra case_number como N.º 1913', async () => {
      mockGetVisitEntries.mockResolvedValue([
        makeVisit({ id: 'v-1', visit_date: '2026-07-27', case_number: 1913, title: 'Test' }),
      ]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('N.º 1913')).toBeInTheDocument();
      });
    });

    it('duration_seconds < 60 muestra "<1 min"', async () => {
      mockGetVisitEntries.mockResolvedValue([
        makeVisit({ id: 'v-1', visit_date: '2026-07-27', duration_seconds: 30, title: 'Test' }),
      ]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('<1 min')).toBeInTheDocument();
      });
    });

    it('duration_seconds = 180 muestra "3 min"', async () => {
      mockGetVisitEntries.mockResolvedValue([
        makeVisit({ id: 'v-1', visit_date: '2026-07-27', duration_seconds: 180, title: 'Test' }),
      ]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('3 min')).toBeInTheDocument();
      });
    });

    it('duration_seconds = 3900 muestra "1h 5m"', async () => {
      mockGetVisitEntries.mockResolvedValue([
        makeVisit({ id: 'v-1', visit_date: '2026-07-27', duration_seconds: 3900, title: 'Test' }),
      ]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('1h 5m')).toBeInTheDocument();
      });
    });

    it('usa duration_minutes cuando duration_seconds no existe', async () => {
      mockGetVisitEntries.mockResolvedValue([
        makeVisit({ id: 'v-1', visit_date: '2026-07-27', duration_seconds: null, duration_minutes: 45, title: 'Test' }),
      ]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('45 min')).toBeInTheDocument();
      });
    });
  });

  describe('Estado vacío', () => {
    it('muestra métricas con 0 visitas', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Visitas del mes')).toBeInTheDocument();
        expect(screen.getByText('No hay visitas recientes')).toBeInTheDocument();
      });
      const cards = screen.getAllByText('0');
      expect(cards.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Carga', () => {
    it('botón deshabilitado durante carga, luego habilitado', async () => {
      const bldDeferred = deferred<ResponsibleBuilding[]>();
      const elsDeferred = deferred<ResponsibleElevator[]>();
      const visDeferred = deferred<ResponsibleVisitEntry[]>();
      const repDeferred = deferred<ResponsibleMonthlyReport[]>();
      mockGetBuildings.mockReturnValue(bldDeferred.promise);
      mockGetElevators.mockReturnValue(elsDeferred.promise);
      mockGetVisitEntries.mockReturnValue(visDeferred.promise);
      mockGetReports.mockReturnValue(repDeferred.promise);

      renderPage();
      const btn = screen.getByRole('button', { name: /actualizar/i });
      expect(btn).toBeDisabled();
      expect(screen.queryByText('No hay visitas recientes')).not.toBeInTheDocument();

      bldDeferred.resolve(mockBuildings);
      elsDeferred.resolve(mockElevators);
      visDeferred.resolve([]);
      repDeferred.resolve([]);

      await waitFor(() => {
        expect(btn).not.toBeDisabled();
        expect(screen.getByText('Edificios')).toBeInTheDocument();
      });
    });
  });

  describe('Error y reintento', () => {
    it('muestra error y reintenta con éxito', async () => {
      mockGetBuildings.mockRejectedValueOnce(new Error('RPC failed'));
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('RPC failed')).toBeInTheDocument();
      });
      mockGetBuildings.mockResolvedValue(mockBuildings);
      mockGetElevators.mockResolvedValue(mockElevators);
      mockGetVisitEntries.mockResolvedValue([]);
      mockGetReports.mockResolvedValue([]);
      const btn = screen.getByRole('button', { name: /actualizar/i });
      await userEvent.click(btn);
      await waitFor(() => {
        expect(screen.queryByText('RPC failed')).not.toBeInTheDocument();
        expect(screen.getByText('Edificios')).toBeInTheDocument();
      });
      expect(mockGetBuildings).toHaveBeenCalledTimes(2);
      expect(mockGetElevators).toHaveBeenCalledTimes(2);
      expect(mockGetVisitEntries).toHaveBeenCalledTimes(2);
      expect(mockGetReports).toHaveBeenCalledTimes(2);
    });
  });

  describe('Botón Actualizar', () => {
    it('vuelve a llamar a todas las funciones exactamente 2 veces', async () => {
      renderPage();
      await waitFor(() => { expect(screen.getByText('Edificios')).toBeInTheDocument(); });
      const btn = screen.getByRole('button', { name: /actualizar/i });
      await userEvent.click(btn);
      await waitFor(() => {
        expect(mockGetBuildings).toHaveBeenCalledTimes(2);
        expect(mockGetElevators).toHaveBeenCalledTimes(2);
        expect(mockGetVisitEntries).toHaveBeenCalledTimes(2);
        expect(mockGetReports).toHaveBeenCalledTimes(2);
      });
    });
  });
});
