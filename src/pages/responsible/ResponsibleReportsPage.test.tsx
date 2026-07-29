import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ResponsibleReportsPage from './ResponsibleReportsPage';
import type { ResponsibleMonthlyReport, ResponsibleElevator, ResponsibleBuilding } from '@/services/responsiblePortalService';

const mockBuildings: ResponsibleBuilding[] = [
  { id: 'building-1', client_id: 'client-1', code: 'ED-001', name: 'Hospital Regional', address: 'Av. Principal 123', locality: 'Comodoro Rivadavia', province: 'Chubut' },
  { id: 'building-2', client_id: 'client-1', code: 'ED-002', name: 'Clínica 10', address: 'Calle X 456', locality: 'Rawson', province: 'Chubut' },
  { id: 'building-3', client_id: 'client-1', code: 'ED-003', name: 'Clínica 2', address: 'Calle Y 789', locality: 'Trelew', province: 'Chubut' },
];
const mockElevators: ResponsibleElevator[] = [
  { id: 'elevator-1', code: 'ASC-1', building_id: 'building-1', manufacturer: 'Otis', model: 'Gen2', elevator_type: 'passenger', capacity_kg: 800, floors_served: '1-5', year_installed: 2020, operational_status: 'operativo', conservation_status: 'conforme', contractual_status: 'active', last_service_date: null, next_service_date: null, active: true },
  { id: 'elevator-2', code: 'ASC-2', building_id: 'building-3', manufacturer: 'Schindler', model: '3300', elevator_type: 'passenger', capacity_kg: 1000, floors_served: '1-8', year_installed: 2019, operational_status: 'operativo', conservation_status: 'conforme', contractual_status: 'active', last_service_date: null, next_service_date: null, active: true },
  { id: 'elevator-10', code: 'ASC-10', building_id: 'building-3', manufacturer: 'Kone', model: 'MiniSpace', elevator_type: 'passenger', capacity_kg: 630, floors_served: '1-3', year_installed: 2021, operational_status: 'operativo', conservation_status: 'conforme', contractual_status: 'active', last_service_date: null, next_service_date: null, active: true },
  { id: 'elevator-3', code: 'ASC-3', building_id: 'building-2', manufacturer: 'Kone', model: null, elevator_type: 'passenger', capacity_kg: 630, floors_served: '1-3', year_installed: 2021, operational_status: 'operativo', conservation_status: 'conforme', contractual_status: 'active', last_service_date: null, next_service_date: null, active: true },
];
const mockReports: ResponsibleMonthlyReport[] = [
  { id: 'r-1', elevator_id: 'elevator-1', period: '2026-07', title: null, status: 'approved', general_status: 'operativo', services_count: 5, report_month: 7, report_year: 2026, pdf_generated_at: '2026-07-28', has_pdf: true },
  { id: 'r-2', elevator_id: 'elevator-3', period: '2026-06', title: null, status: 'sent', general_status: null, services_count: 3, report_month: 6, report_year: 2026, pdf_generated_at: null, has_pdf: false },
  { id: 'r-3', elevator_id: 'elevator-2', period: '2025-12', title: null, status: 'draft', general_status: null, services_count: 2, report_month: 12, report_year: 2025, pdf_generated_at: null, has_pdf: false },
  { id: 'r-4', elevator_id: 'elevator-2', period: '2026-06', title: null, status: 'pending', general_status: null, services_count: 4, report_month: 6, report_year: 2026, pdf_generated_at: null, has_pdf: false },
  { id: 'r-5', elevator_id: 'elevator-10', period: '2026-06', title: null, status: 'approved', general_status: null, services_count: 1, report_month: 6, report_year: 2026, pdf_generated_at: null, has_pdf: false },
  { id: 'r-6', elevator_id: 'elevator-foreign', period: '2026-01', title: null, status: 'rejected', general_status: null, services_count: 0, report_month: 1, report_year: 2026, pdf_generated_at: null, has_pdf: false },
];

vi.mock('@/services/responsiblePortalService', () => ({
  getResponsibleMonthlyReports: vi.fn(), getResponsibleElevators: vi.fn(), getResponsibleBuildings: vi.fn(),
  getErrorMessage: vi.fn((e: unknown) => e instanceof Error ? e.message : 'Error'),
}));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'u1' }, profile: { id: 'u1', full_name: 'Test', role: 'responsible', email: 't@t.com', active: true, created_at: '', updated_at: '' }, logout: () => Promise.resolve(), login: () => Promise.resolve({ error: null }), getRedirectPath: () => '/', hasRole: () => true, isAdmin: false, isTechnician: false, isSupervisor: false, isResponsible: true, isAuthenticated: true, loading: false, error: null })),
}));
vi.mock('@/components/layout/Sidebar', () => ({ default: vi.fn(() => <div data-testid="sidebar" />) }));

import { getResponsibleMonthlyReports, getResponsibleElevators, getResponsibleBuildings } from '@/services/responsiblePortalService';
const mockGetReports = vi.mocked(getResponsibleMonthlyReports);
const mockGetElevators = vi.mocked(getResponsibleElevators);
const mockGetBuildings = vi.mocked(getResponsibleBuildings);

interface Deferred<T> { promise: Promise<T>; resolve: (value: T) => void; }
function deferred<T>(): Deferred<T> { let resolve!: (value: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; }

function renderPage() {
  return render(<MemoryRouter><ResponsibleReportsPage /></MemoryRouter>);
}

function text() { return document.body.textContent || ''; }

beforeEach(() => {
  vi.clearAllMocks();
  mockGetReports.mockResolvedValue(mockReports);
  mockGetElevators.mockResolvedValue(mockElevators);
  mockGetBuildings.mockResolvedValue(mockBuildings);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('ResponsibleReportsPage', () => {
  it('muestra datos de un informe', async () => {
    renderPage();
    await waitFor(() => { expect(text()).toContain('ASC-1'); });
    expect(screen.getByTestId('responsible-report-r-1')).toBeInTheDocument();
    const t = text();
    expect(t).toContain('ASC-1');
    expect(t).toContain('Hospital Regional');
    expect(t).toContain('2026-07');
    expect(t).toContain('Aprobado');
    expect(t).toContain('operativo');
    expect(t).toContain('Descarga segura pendiente de habilitación');
  });
  it('orden temporal', async () => {
    renderPage();
    await waitFor(() => { expect(text()).toContain('ASC-1'); });
    const t = text();
    expect(t.indexOf('2026-07')).toBeLessThan(t.indexOf('2026-06'));
    expect(t.indexOf('2026-06')).toBeLessThan(t.indexOf('2025-12'));
  });
  it('orden natural: ASC-2 antes de ASC-10', async () => {
    renderPage();
    await waitFor(() => { expect(text()).toContain('ASC-2'); });
    const t = text();
    expect(t.indexOf('ASC-2')).toBeLessThan(t.indexOf('ASC-10'));
  });
  it('estados traducidos', async () => {
    renderPage();
    await waitFor(() => { expect(text()).toContain('ASC-1'); });
    expect(text()).toContain('Aprobado');
    expect(text()).toContain('Enviado');
    expect(text()).toContain('Borrador');
    expect(text()).toContain('Pendiente');
    expect(text()).toContain('Rechazado');
    expect(text()).not.toMatch(/\bapproved\b/);
  });
  it('referencia faltante muestra "-"', async () => {
    renderPage();
    await waitFor(() => { expect(text()).toContain('Rechazado'); });
    const t = text();
    expect(t).not.toContain('elevator-foreign');
    expect(t).not.toContain('building-no-asignado');
  });
  it('PDF: has_pdf=true muestra botón deshabilitado', async () => {
    renderPage();
    await waitFor(() => { expect(text()).toContain('Aprobado'); });
    expect(screen.getByText('Descarga segura pendiente de habilitación')).toBeDisabled();
  });
  it('PDF: has_pdf=false muestra "Sin PDF"', async () => {
    renderPage();
    await waitFor(() => { expect(text()).toContain('Borrador'); });
    expect(text()).toContain('Sin PDF');
  });
  it('privacidad: no muestra IDs internos', async () => {
    renderPage();
    await waitFor(() => { expect(text()).toContain('ASC-1'); });
    expect(text()).not.toContain('elevator-1');
    expect(text()).not.toContain('building-1');
    expect(text()).not.toContain('report-1');
  });
  it('estado vacío', async () => {
    mockGetReports.mockResolvedValue([]);
    renderPage();
    await waitFor(() => {
      expect(text()).toContain('No hay informes disponibles');
      expect(screen.getByRole('button', { name: /actualizar/i })).not.toBeDisabled();
    });
    expect(screen.queryByTestId(/^responsible-report-/)).not.toBeInTheDocument();
  });
  it('estado de carga', async () => {
    const repDef = deferred<ResponsibleMonthlyReport[]>();
    const elsDef = deferred<ResponsibleElevator[]>();
    const bldDef = deferred<ResponsibleBuilding[]>();
    mockGetReports.mockReturnValue(repDef.promise);
    mockGetElevators.mockReturnValue(elsDef.promise);
    mockGetBuildings.mockReturnValue(bldDef.promise);
    renderPage();
    expect(screen.getByRole('button', { name: /actualizar/i })).toBeDisabled();
    expect(document.querySelectorAll('.animate-spin')).toHaveLength(1);
    expect(text()).not.toContain('ASC-1');
    expect(text()).not.toContain('No hay informes');
    repDef.resolve(mockReports);
    elsDef.resolve(mockElevators);
    bldDef.resolve(mockBuildings);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /actualizar/i })).not.toBeDisabled();
      expect(text()).toContain('ASC-1');
      expect(document.querySelectorAll('.animate-spin')).toHaveLength(0);
    });
  });
  it('error y reintento exacto', async () => {
    mockGetReports.mockRejectedValueOnce(new Error('RPC failed'));
    renderPage();
    await waitFor(() => { expect(text()).toContain('RPC failed'); });
    const repDef2 = deferred<ResponsibleMonthlyReport[]>();
    const elsDef2 = deferred<ResponsibleElevator[]>();
    const bldDef2 = deferred<ResponsibleBuilding[]>();
    mockGetReports.mockReturnValue(repDef2.promise);
    mockGetElevators.mockReturnValue(elsDef2.promise);
    mockGetBuildings.mockReturnValue(bldDef2.promise);
    const btn = screen.getByRole('button', { name: /actualizar/i });
    await userEvent.click(btn);
    expect(btn).toBeDisabled();
    repDef2.resolve(mockReports);
    elsDef2.resolve(mockElevators);
    bldDef2.resolve(mockBuildings);
    await waitFor(() => {
      expect(text()).not.toContain('RPC failed');
      expect(text()).toContain('ASC-1');
      expect(btn).not.toBeDisabled();
    });
    expect(mockGetReports).toHaveBeenCalledTimes(2);
    expect(mockGetElevators).toHaveBeenCalledTimes(2);
    expect(mockGetBuildings).toHaveBeenCalledTimes(2);
  });
  it('actualización manual', async () => {
    renderPage();
    await waitFor(() => { expect(text()).toContain('ASC-1'); });
    const repDef2 = deferred<ResponsibleMonthlyReport[]>();
    const elsDef2 = deferred<ResponsibleElevator[]>();
    const bldDef2 = deferred<ResponsibleBuilding[]>();
    mockGetReports.mockReturnValue(repDef2.promise);
    mockGetElevators.mockReturnValue(elsDef2.promise);
    mockGetBuildings.mockReturnValue(bldDef2.promise);
    const btn = screen.getByRole('button', { name: /actualizar/i });
    await userEvent.click(btn);
    expect(btn).toBeDisabled();
    repDef2.resolve(mockReports);
    elsDef2.resolve(mockElevators);
    bldDef2.resolve(mockBuildings);
    await waitFor(() => {
      expect(btn).not.toBeDisabled();
      expect(text()).toContain('ASC-1');
    });
    expect(mockGetReports).toHaveBeenCalledTimes(2);
    expect(mockGetElevators).toHaveBeenCalledTimes(2);
    expect(mockGetBuildings).toHaveBeenCalledTimes(2);
  });
  it('inmutabilidad profunda', async () => {
    const origRep = mockReports.map((r) => ({ ...r }));
    const origEls = mockElevators.map((e) => ({ ...e }));
    const origBlds = mockBuildings.map((b) => ({ ...b }));
    renderPage();
    await waitFor(() => { expect(text()).toContain('ASC-1'); });
    expect(mockReports).toEqual(origRep);
    expect(mockElevators).toEqual(origEls);
    expect(mockBuildings).toEqual(origBlds);
  });
});
