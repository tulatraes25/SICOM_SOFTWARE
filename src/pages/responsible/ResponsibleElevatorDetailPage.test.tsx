import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ResponsibleElevatorDetailPage from './ResponsibleElevatorDetailPage';
import type { ResponsibleElevator, ResponsibleServiceRecord, ResponsibleServiceOrder, ResponsibleVisitEntry, ResponsibleMonthlyReport, ResponsibleTechnician, ResponsibleChecklistItem } from '@/services/responsiblePortalService';

const mockElevator: ResponsibleElevator = {
  id: 'elevator-1', code: 'ASC-0001', building_id: 'building-1', manufacturer: 'Otis', model: 'Gen2',
  elevator_type: 'passenger', capacity_kg: 800, floors_served: '1-5', year_installed: 2020,
  operational_status: 'operativo', conservation_status: 'conforme', contractual_status: 'active',
  last_service_date: '2026-07-15', next_service_date: '2026-08-15', active: true,
};
const mockTech: ResponsibleTechnician = { id: 'tech-1', full_name: 'Juan Pérez' };

function makeRecord(overrides: Partial<ResponsibleServiceRecord> = {}): ResponsibleServiceRecord {
  return { id: 'sr-1', elevator_id: 'elevator-1', technician_id: 'tech-1', service_date: '2026-07-20', service_time: '10:00', service_type: 'preventivo', status: 'approved', description: 'Mant preventivo', technical_report: 'Informe técnico', observations: 'Obs', operational_status_at_service: null, conservation_status_at_service: null, approved_at: null, final_report_text: 'Conclusión', ...overrides };
}
function makeOrder(overrides: Partial<ResponsibleServiceOrder> = {}): ResponsibleServiceOrder {
  return { id: 'so-1', elevator_id: 'elevator-1', subject: 'Orden A', order_type: 'corrective', status: 'approved', completion_summary: 'Completado', reviewed_at: '2026-07-25T10:00:00Z', service_case_id: null, ...overrides };
}
function makeVisit(overrides: Partial<ResponsibleVisitEntry> = {}): ResponsibleVisitEntry {
  return { id: 'v-1', elevator_id: 'elevator-1', service_case_id: null, service_record_id: null, service_order_id: null, entry_number: 1, visit_date: '2026-07-27', entry_type: 'other', origin_type: 'maintenance', title: 'Test', description: 'Test desc', work_performed: null, observations: null, recommendations: null, operational_status: null, conservation_status: null, technician_id: 'tech-1', status: 'approved', check_in_at: null, check_out_at: null, duration_minutes: null, duration_seconds: null, case_number: null, numbering_mode: null, ...overrides };
}
function makeReport(overrides: Partial<ResponsibleMonthlyReport> = {}): ResponsibleMonthlyReport {
  return { id: 'r-1', elevator_id: 'elevator-1', period: '2026-07', title: null, status: 'approved', general_status: null, services_count: null, report_month: 7, report_year: 2026, pdf_generated_at: '2026-07-28', has_pdf: true, ...overrides };
}
function makeChecklist(overrides: Partial<ResponsibleChecklistItem> = {}): ResponsibleChecklistItem {
  return { id: 'cl-1', service_record_id: 'sr-1', item_name: 'Puertas', status: 'ok', notes: null, ...overrides };
}

vi.mock('@/services/responsiblePortalService', () => ({
  getResponsibleElevators: vi.fn(), getResponsibleServiceRecords: vi.fn(), getResponsibleServiceOrders: vi.fn(),
  getResponsibleVisitEntries: vi.fn(), getResponsibleMonthlyReports: vi.fn(), getResponsibleTechnicians: vi.fn(),
  getResponsibleChecklistItems: vi.fn(),
  getErrorMessage: vi.fn((e: unknown) => e instanceof Error ? e.message : 'Error'),
}));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => {
    const profile = { id: 'user-1', full_name: 'Claudio Tula', role: 'responsible', email: 'claudio@test.com', active: true, created_at: '', updated_at: '', phone: undefined };
    return { user: { id: 'user-1', email: 'claudio@test.com', app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '' }, profile, logout: () => Promise.resolve(), login: () => Promise.resolve({ error: null, profile }), getRedirectPath: () => '/responsable', hasRole: () => true, isAdmin: false, isTechnician: false, isSupervisor: false, isResponsible: true, isAuthenticated: true, loading: false, error: null };
  }),
}));
vi.mock('@/components/layout/Sidebar', () => ({ default: vi.fn(() => <div data-testid="sidebar" />) }));

import { getResponsibleElevators, getResponsibleServiceRecords, getResponsibleServiceOrders, getResponsibleVisitEntries, getResponsibleMonthlyReports, getResponsibleTechnicians, getResponsibleChecklistItems } from '@/services/responsiblePortalService';
const mockGetElevators = vi.mocked(getResponsibleElevators);
const mockGetRecords = vi.mocked(getResponsibleServiceRecords);
const mockGetOrders = vi.mocked(getResponsibleServiceOrders);
const mockGetVisits = vi.mocked(getResponsibleVisitEntries);
const mockGetReports = vi.mocked(getResponsibleMonthlyReports);
const mockGetTechnicians = vi.mocked(getResponsibleTechnicians);
const mockGetChecklist = vi.mocked(getResponsibleChecklistItems);

interface Deferred<T> { promise: Promise<T>; resolve: (value: T) => void; }
function deferred<T>(): Deferred<T> { let resolve!: (value: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; }

function renderPage(elevatorId = 'elevator-1') {
  return render(
    <MemoryRouter initialEntries={[`/responsable/ascensores/${elevatorId}`]}>
      <Routes>
        <Route path="/responsable/ascensores/:elevatorId" element={<ResponsibleElevatorDetailPage />} />
        <Route path="/responsable/ascensores" element={<div data-testid="ascensores-list">Ascensores list</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function text() { return document.body.textContent || ''; }

beforeEach(() => {
  vi.clearAllMocks();
  mockGetElevators.mockResolvedValue([mockElevator]);
  mockGetRecords.mockResolvedValue([]);
  mockGetOrders.mockResolvedValue([]);
  mockGetVisits.mockResolvedValue([]);
  mockGetReports.mockResolvedValue([]);
  mockGetTechnicians.mockResolvedValue([mockTech]);
  mockGetChecklist.mockResolvedValue([]);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('ResponsibleElevatorDetailPage', () => {
  it('muestra datos generales del ascensor', async () => {
    renderPage();
    await waitFor(() => {
      const t = text();
      expect(t).toContain('ASC-0001');
      expect(t).toContain('Operativo');
      expect(t).toContain('Otis');
      expect(t).toContain('Gen2');
      expect(t).toContain('Pasajeros');
      expect(t).toContain('800 kg');
      expect(t).toContain('1-5');
      expect(t).toContain('2020');
      expect(t).toContain('Conforme');
      expect(t).toContain('Activo');
      expect(t).toContain('15/7/2026');
      expect(t).toContain('15/8/2026');
    });
  });
  it('valores faltantes muestran "-"', async () => {
    mockGetElevators.mockResolvedValue([{ ...mockElevator, manufacturer: null, model: null, elevator_type: null, capacity_kg: null, floors_served: null, year_installed: null, conservation_status: null, contractual_status: null, last_service_date: null, next_service_date: null }]);
    renderPage();
    await waitFor(() => { expect(text()).toContain('ASC-0001'); });
    expect(text().split('-').length).toBeGreaterThan(5);
  });
  it('mantenimientos ordenados por fecha descendente', async () => {
    mockGetRecords.mockResolvedValue([
      makeRecord({ id: 'sr-1', service_date: '2026-07-10', service_time: '08:00' }),
      makeRecord({ id: 'sr-2', service_date: '2026-07-20', service_time: '14:00' }),
      makeRecord({ id: 'sr-3', service_date: '2026-07-20', service_time: '10:00' }),
    ]);
    renderPage();
    await waitFor(() => { expect(text()).toContain('Mantenimientos (3)'); });
    const t = text();
    const idx20 = t.indexOf('20/7/2026');
    const idx10 = t.indexOf('10/7/2026');
    expect(idx20).toBeLessThan(idx10);
  });
  it('tipo de mantenimiento traducido', async () => {
    mockGetRecords.mockResolvedValue([makeRecord({ service_type: 'correctivo' })]);
    renderPage();
    await waitFor(() => { expect(text()).toContain('Correctivo'); });
  });
  it('checklist agrupado por service_record_id', async () => {
    mockGetRecords.mockResolvedValue([makeRecord({ id: 'sr-1' }), makeRecord({ id: 'sr-2', service_date: '2026-07-15' })]);
    mockGetChecklist.mockResolvedValue([
      makeChecklist({ id: 'cl-1', service_record_id: 'sr-1', item_name: 'Puertas' }),
      makeChecklist({ id: 'cl-2', service_record_id: 'sr-1', item_name: 'Freno' }),
      makeChecklist({ id: 'cl-3', service_record_id: 'sr-2', item_name: 'Iluminación' }),
    ]);
    renderPage();
    await waitFor(() => {
      const t = text();
      expect(t).toContain('Puertas');
      expect(t).toContain('Freno');
      expect(t).toContain('Iluminación');
    });
    expect(mockGetChecklist).toHaveBeenCalledWith(['sr-1', 'sr-2']);
  });
  it('estados de checklist traducidos', async () => {
    mockGetRecords.mockResolvedValue([makeRecord()]);
    mockGetChecklist.mockResolvedValue([
      makeChecklist({ status: 'ok' }),
      makeChecklist({ id: 'cl-2', item_name: 'Freno', status: 'failed' }),
      makeChecklist({ id: 'cl-3', item_name: 'Obs', status: 'needs_attention', notes: 'Revisar' }),
    ]);
    renderPage();
    await waitFor(() => {
      const t = text();
      expect(t).toContain('Correcto');
      expect(t).toContain('Falló');
      expect(t).toContain('Requiere atención');
      expect(t).toContain('(Revisar)');
    });
  });
  it('órdenes ordenadas por reviewed_at descendente', async () => {
    mockGetOrders.mockResolvedValue([
      makeOrder({ id: 'so-1', subject: 'Orden B', reviewed_at: '2026-07-20T10:00:00Z' }),
      makeOrder({ id: 'so-2', subject: 'Orden A', reviewed_at: '2026-07-25T10:00:00Z' }),
      makeOrder({ id: 'so-3', subject: 'Orden Sin', reviewed_at: null }),
    ]);
    renderPage();
    await waitFor(() => { expect(text()).toContain('Órdenes (3)'); });
    const t = text();
    const idxA = t.indexOf('Orden A');
    const idxB = t.indexOf('Orden B');
    const idxSin = t.indexOf('Orden Sin');
    expect(idxA).toBeLessThan(idxB);
    expect(idxB).toBeLessThan(idxSin);
  });
  it('tipo de orden traducido', async () => {
    mockGetOrders.mockResolvedValue([makeOrder({ order_type: 'emergency' })]);
    renderPage();
    await waitFor(() => { expect(text()).toContain('Emergencia'); });
  });
  it('visitas: encabezado muestra total, máximo 10 visibles', async () => {
    mockGetVisits.mockResolvedValue(Array.from({ length: 15 }, (_, i) => makeVisit({ id: `v-${i}`, visit_date: `2026-07-${String(i + 1).padStart(2, '0')}`, entry_number: i + 1, title: `V${i + 1}` })));
    renderPage();
    await waitFor(() => {
      const t = text();
      expect(t).toContain('V15');
      expect(t).toContain('V6');
      expect(t).not.toMatch(/V5[^0-9]/);
      expect(t).not.toMatch(/V1[^0-9]/);
    });
  });
  it('visitas muestra expediente 1913', async () => {
    mockGetVisits.mockResolvedValue([makeVisit({ case_number: 1913 })]);
    renderPage();
    await waitFor(() => { expect(text()).toContain('N.º 1913'); });
  });
  it('duraciones formateadas', async () => {
    mockGetVisits.mockResolvedValue([
      makeVisit({ id: 'v-1', duration_seconds: 30, title: 'Corta' }),
      makeVisit({ id: 'v-2', duration_seconds: 180, title: 'Media' }),
      makeVisit({ id: 'v-3', duration_seconds: 3900, title: 'Larga' }),
    ]);
    renderPage();
    await waitFor(() => {
      const t = text();
      expect(t).toContain('<1 min');
      expect(t).toContain('3 min');
      expect(t).toContain('1h 5m');
    });
  });
  it('informes ordenados por año y mes descendente', async () => {
    mockGetReports.mockResolvedValue([
      makeReport({ id: 'r-1', period: '2026-06', report_year: 2026, report_month: 6 }),
      makeReport({ id: 'r-2', period: '2026-07', report_year: 2026, report_month: 7 }),
      makeReport({ id: 'r-3', period: '2025-12', report_year: 2025, report_month: 12 }),
    ]);
    renderPage();
    await waitFor(() => { expect(text()).toContain('Informes (3)'); });
    const t = text();
    const idxJul = t.indexOf('2026-07');
    const idxJun = t.indexOf('2026-06');
    const idxDec = t.indexOf('2025-12');
    expect(idxJul).toBeLessThan(idxJun);
    expect(idxJun).toBeLessThan(idxDec);
  });
  it('traducciones de estado de informe', async () => {
    mockGetReports.mockResolvedValue([
      makeReport({ status: 'approved' }),
      makeReport({ id: 'r-2', status: 'sent' }),
      makeReport({ id: 'r-3', status: 'draft' }),
    ]);
    renderPage();
    await waitFor(() => {
      const t = text();
      expect(t).toContain('Aprobado');
      expect(t).toContain('Enviado');
      expect(t).toContain('Borrador');
    });
  });
  it('estados vacíos por separado', async () => {
    renderPage();
    await waitFor(() => {
      expect(text()).toContain('No hay mantenimientos');
      expect(text()).toContain('No hay órdenes');
      expect(text()).toContain('No hay visitas');
      expect(text()).toContain('No hay informes');
    });
  });
  it('acceso no autorizado', async () => {
    renderPage('elevator-prohibido');
    await waitFor(() => { expect(text()).toContain('No tiene permiso para consultar este recurso'); });
    const t = text();
    expect(t).not.toContain('ASC-0001');
    expect(t).not.toContain('Otis');
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
  });
  it('error de RPC y reintento exacto', async () => {
    mockGetElevators.mockRejectedValueOnce(new Error('RPC failed'));
    renderPage();
    await waitFor(() => { expect(text()).toContain('RPC failed'); });
    mockGetElevators.mockResolvedValue([mockElevator]);
    mockGetRecords.mockResolvedValue([]); mockGetOrders.mockResolvedValue([]);
    mockGetVisits.mockResolvedValue([]); mockGetReports.mockResolvedValue([]);
    mockGetTechnicians.mockResolvedValue([mockTech]); mockGetChecklist.mockResolvedValue([]);
    await userEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    await waitFor(() => { expect(text()).toContain('ASC-0001'); });
    expect(mockGetElevators).toHaveBeenCalledTimes(2);
    expect(mockGetRecords).toHaveBeenCalledTimes(2);
    expect(mockGetOrders).toHaveBeenCalledTimes(2);
    expect(mockGetVisits).toHaveBeenCalledTimes(2);
    expect(mockGetReports).toHaveBeenCalledTimes(2);
    expect(mockGetTechnicians.mock.calls.length).toBeGreaterThanOrEqual(1);
  });
  it('estado de carga: promesas pendientes', async () => {
    const els = deferred<ResponsibleElevator[]>(); const rec = deferred<ResponsibleServiceRecord[]>();
    const ord = deferred<ResponsibleServiceOrder[]>(); const vis = deferred<ResponsibleVisitEntry[]>();
    const rep = deferred<ResponsibleMonthlyReport[]>(); const tech = deferred<ResponsibleTechnician[]>();
    mockGetElevators.mockReturnValue(els.promise); mockGetRecords.mockReturnValue(rec.promise);
    mockGetOrders.mockReturnValue(ord.promise); mockGetVisits.mockReturnValue(vis.promise);
    mockGetReports.mockReturnValue(rep.promise); mockGetTechnicians.mockReturnValue(tech.promise);
    mockGetChecklist.mockResolvedValue([]);
    renderPage();
    expect(text()).not.toContain('ASC-0001');
    els.resolve([mockElevator]); rec.resolve([]); ord.resolve([]); vis.resolve([]); rep.resolve([]); tech.resolve([mockTech]);
    await waitFor(() => { expect(text()).toContain('ASC-0001'); });
  });
  it('Volver navega a /responsable/ascensores', async () => {
    renderPage();
    await waitFor(() => { expect(text()).toContain('ASC-0001'); });
    await userEvent.click(screen.getByRole('button', { name: /volver/i }));
    await waitFor(() => { expect(screen.getByTestId('ascensores-list')).toBeInTheDocument(); });
  });
});
