import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, cleanup } from '@testing-library/react';
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

function renderPage() { return render(<MemoryRouter><ResponsibleReportsPage /></MemoryRouter>); }
function t() { return document.body.textContent || ''; }

beforeEach(() => {
  vi.clearAllMocks();
  mockGetReports.mockResolvedValue(mockReports);
  mockGetElevators.mockResolvedValue(mockElevators);
  mockGetBuildings.mockResolvedValue(mockBuildings);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('ResponsibleReportsPage', () => {
  it('datos de r-1 por tarjeta', async () => {
    renderPage();
    await waitFor(() => { expect(t()).toContain('ASC-1'); });
    const card = screen.getByTestId('responsible-report-r-1');
    const ct = card.textContent || '';
    expect(ct).toContain('ASC-1');
    expect(ct).toContain('Hospital Regional');
    expect(ct).toContain('2026-07');
    expect(ct).toContain('Aprobado');
    expect(ct).toContain('operativo');
    expect(ct).toContain('Descarga segura pendiente de habilitación');
    expect(within(card).getByRole('button', { name: /descarga/i })).toBeDisabled();
  });
  it('orden temporal con period fallback', async () => {
    mockGetReports.mockResolvedValue([
      { id: 'r-august', elevator_id: 'elevator-1', period: '2026-08', title: null, status: 'approved', general_status: null, services_count: 1, report_month: null, report_year: null, pdf_generated_at: null, has_pdf: false },
      { id: 'r-july', elevator_id: 'elevator-1', period: '2026-07', title: null, status: 'approved', general_status: null, services_count: 1, report_month: 7, report_year: 2026, pdf_generated_at: null, has_pdf: false },
      { id: 'r-invalid', elevator_id: 'elevator-1', period: 'invalid', title: null, status: 'draft', general_status: null, services_count: 1, report_month: null, report_year: null, pdf_generated_at: null, has_pdf: false },
    ]);
    renderPage();
    await waitFor(() => { expect(t()).toContain('ASC-1'); });
    const ids = screen.getAllByTestId(/^responsible-report-/).map((el) => el.getAttribute('data-testid'));
    expect(ids).toEqual(['responsible-report-r-august', 'responsible-report-r-july', 'responsible-report-r-invalid']);
  });
  it('referencias completas antes que incompletas', async () => {
    mockGetReports.mockResolvedValue([
      { id: 'r-asc2', elevator_id: 'elevator-2', period: '2026-06', title: null, status: 'approved', general_status: null, services_count: 1, report_month: 6, report_year: 2026, pdf_generated_at: null, has_pdf: false },
      { id: 'r-asc10', elevator_id: 'elevator-10', period: '2026-06', title: null, status: 'approved', general_status: null, services_count: 1, report_month: 6, report_year: 2026, pdf_generated_at: null, has_pdf: false },
      { id: 'r-orphan', elevator_id: 'elevator-missing-building', period: '2026-06', title: null, status: 'approved', general_status: null, services_count: 1, report_month: 6, report_year: 2026, pdf_generated_at: null, has_pdf: false },
      { id: 'r-noelev', elevator_id: 'nonexistent', period: '2026-06', title: null, status: 'approved', general_status: null, services_count: 1, report_month: 6, report_year: 2026, pdf_generated_at: null, has_pdf: false },
    ]);
    renderPage();
    await waitFor(() => { expect(t()).toContain('ASC-2'); });
    const cards = [
      screen.getByTestId('responsible-report-r-asc2'),
      screen.getByTestId('responsible-report-r-asc10'),
      screen.getByTestId('responsible-report-r-orphan'),
      screen.getByTestId('responsible-report-r-noelev'),
    ];
    expect(cards[0].textContent).toContain('ASC-2');
    expect(cards[1].textContent).toContain('ASC-10');
    expect(cards[2].textContent).toContain('-');
    expect(cards[2].textContent).not.toContain('building-inexistente');
    expect(cards[3].textContent).toContain('-');
    expect(cards[3].textContent).not.toContain('elevator-inexistente');
  });
  it('estados traducidos por tarjeta', async () => {
    renderPage();
    await waitFor(() => { expect(t()).toContain('ASC-1'); });
    const check = (id: string, expected: string, notExpected: string) => {
      const card = screen.getByTestId(id);
      expect(card.textContent).toContain(expected);
      expect(card.textContent).not.toContain(notExpected);
    };
    check('responsible-report-r-1', 'Aprobado', 'approved');
    check('responsible-report-r-2', 'Enviado', 'sent');
    check('responsible-report-r-3', 'Borrador', 'draft');
    check('responsible-report-r-4', 'Pendiente', 'pending');
    check('responsible-report-r-6', 'Rechazado', 'rejected');
  });
  it('estado desconocido conserva el valor', async () => {
    mockGetReports.mockResolvedValue([
      { id: 'r-u', elevator_id: 'elevator-1', period: '2026-01', title: null, status: 'archived', general_status: null, services_count: 1, report_month: 1, report_year: 2026, pdf_generated_at: null, has_pdf: false },
    ]);
    renderPage();
    await waitFor(() => { expect(t()).toContain('ASC-1'); });
    const card = screen.getByTestId('responsible-report-r-u');
    expect(card.textContent).toContain('archived');
  });
  it('estado vacío muestra guion', async () => {
    mockGetReports.mockResolvedValue([
      { id: 'r-e', elevator_id: 'elevator-1', period: '2026-02', title: null, status: '', general_status: null, services_count: 1, report_month: 2, report_year: 2026, pdf_generated_at: null, has_pdf: false },
    ]);
    renderPage();
    await waitFor(() => { expect(t()).toContain('ASC-1'); });
    const card = screen.getByTestId('responsible-report-r-e');
    expect(card.textContent).toContain('-');
  });
  it('PDF disponible por tarjeta', async () => {
    renderPage();
    await waitFor(() => { expect(t()).toContain('ASC-1'); });
    const card = screen.getByTestId('responsible-report-r-1');
    expect(card.textContent).toContain('Descarga segura pendiente de habilitación');
    expect(within(card).getByRole('button', { name: /descarga/i })).toBeDisabled();
  });
  it('Sin PDF por tarjeta', async () => {
    renderPage();
    await waitFor(() => { expect(t()).toContain('ASC-1'); });
    const card = screen.getByTestId('responsible-report-r-3');
    expect(card.textContent).toContain('Sin PDF');
    expect(within(card).queryByRole('button')).not.toBeInTheDocument();
  });
  it('privacidad', async () => {
    renderPage();
    await waitFor(() => { expect(t()).toContain('ASC-1'); });
    expect(t()).not.toContain('elevator-1');
    expect(t()).not.toContain('building-1');
    expect(t()).not.toContain('bucket');
    expect(t()).not.toContain('storage');
  });
  it('estado vacío', async () => {
    mockGetReports.mockResolvedValue([]);
    renderPage();
    await waitFor(() => {
      expect(t()).toContain('No hay informes disponibles');
      expect(screen.getByRole('button', { name: /actualizar/i })).not.toBeDisabled();
    });
    expect(screen.queryByTestId(/^responsible-report-/)).not.toBeInTheDocument();
    expect(screen.queryAllByRole('button', { name: /descarga/i })).toHaveLength(0);
    expect(document.querySelectorAll('.animate-spin').length).toBe(0);
  });
  it('carga: deferred y tarjetas', async () => {
    const repDef = deferred<ResponsibleMonthlyReport[]>();
    const elsDef = deferred<ResponsibleElevator[]>();
    const bldDef = deferred<ResponsibleBuilding[]>();
    mockGetReports.mockReturnValue(repDef.promise);
    mockGetElevators.mockReturnValue(elsDef.promise);
    mockGetBuildings.mockReturnValue(bldDef.promise);
    renderPage();
    expect(screen.getByRole('button', { name: /actualizar/i })).toBeDisabled();
    expect(t()).not.toContain('ASC-1');
    repDef.resolve(mockReports);
    elsDef.resolve(mockElevators);
    bldDef.resolve(mockBuildings);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /actualizar/i })).not.toBeDisabled();
      expect(t()).toContain('ASC-1');
    });
  });
  it('error y reintento', async () => {
    mockGetReports.mockRejectedValueOnce(new Error('RPC failed'));
    renderPage();
    await waitFor(() => { expect(t()).toContain('RPC failed'); });
    expect(screen.getByRole('button', { name: /actualizar/i })).not.toBeDisabled();
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
      expect(t()).not.toContain('RPC failed');
      expect(t()).toContain('ASC-1');
      expect(btn).not.toBeDisabled();
    });
    expect(mockGetReports).toHaveBeenCalledTimes(2);
    expect(mockGetElevators).toHaveBeenCalledTimes(2);
    expect(mockGetBuildings).toHaveBeenCalledTimes(2);
  });
  it('actualización manual', async () => {
    renderPage();
    await waitFor(() => { expect(t()).toContain('ASC-1'); });
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
      expect(t()).toContain('ASC-1');
    });
    expect(mockGetReports).toHaveBeenCalledTimes(2);
    expect(mockGetElevators).toHaveBeenCalledTimes(2);
    expect(mockGetBuildings).toHaveBeenCalledTimes(2);
  });
  it('inmutabilidad', async () => {
    const origRep = mockReports.map((r) => ({ ...r }));
    const origEls = mockElevators.map((e) => ({ ...e }));
    const origBlds = mockBuildings.map((b) => ({ ...b }));
    renderPage();
    await waitFor(() => { expect(t()).toContain('ASC-1'); });
    expect(mockReports).toEqual(origRep);
    expect(mockElevators).toEqual(origEls);
    expect(mockBuildings).toEqual(origBlds);
  });
});
