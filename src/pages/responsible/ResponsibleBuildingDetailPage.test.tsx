import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ResponsibleBuildingDetailPage from './ResponsibleBuildingDetailPage';
import type { ResponsibleBuilding, ResponsibleClient, ResponsibleElevator, ResponsibleVisitEntry } from '@/services/responsiblePortalService';

const mockBuilding: ResponsibleBuilding = {
  id: 'building-1', client_id: 'client-1', code: 'ED-001', name: 'Hospital Regional',
  address: 'Av. Principal 123', locality: 'Comodoro Rivadavia', province: 'Chubut',
};
const mockClient: ResponsibleClient = { id: 'client-1', code: 'CLI-001', name: 'Hospital Regional S.A.' };
const mockElevators: ResponsibleElevator[] = [
  { id: 'elevator-10', code: 'ASC-10', building_id: 'building-1', manufacturer: 'Kone', model: 'MiniSpace', elevator_type: 'passenger', capacity_kg: 630, floors_served: '1-3', year_installed: 2021, operational_status: 'operativo', conservation_status: 'conforme', contractual_status: 'active', last_service_date: null, next_service_date: null, active: true },
  { id: 'elevator-2', code: 'ASC-0002', building_id: 'building-1', manufacturer: 'Schindler', model: '3300', elevator_type: 'passenger', capacity_kg: 1000, floors_served: '1-8', year_installed: 2019, operational_status: 'operativo', conservation_status: 'conforme', contractual_status: 'active', last_service_date: null, next_service_date: null, active: true },
  { id: 'elevator-1', code: 'ASC-0001', building_id: 'building-1', manufacturer: 'Otis', model: 'Gen2', elevator_type: 'passenger', capacity_kg: 800, floors_served: '1-5', year_installed: 2020, operational_status: 'operativo', conservation_status: 'conforme', contractual_status: 'active', last_service_date: null, next_service_date: null, active: true },
];
function makeVisit(overrides: Partial<ResponsibleVisitEntry> = {}): ResponsibleVisitEntry {
  return { id: 'v-1', elevator_id: 'elevator-1', service_case_id: null, service_record_id: null, service_order_id: null, entry_number: 1, visit_date: '2026-07-27', entry_type: 'other', origin_type: 'maintenance', title: 'Test', description: 'Test desc', work_performed: null, observations: null, recommendations: null, operational_status: null, conservation_status: null, technician_id: 'tech-1', status: 'approved', check_in_at: null, check_out_at: null, duration_minutes: null, duration_seconds: null, case_number: null, numbering_mode: null, ...overrides };
}

vi.mock('@/services/responsiblePortalService', () => ({
  getResponsibleBuildings: vi.fn(), getResponsibleElevators: vi.fn(), getResponsibleClients: vi.fn(), getResponsibleVisitEntries: vi.fn(),
  getErrorMessage: vi.fn((e: unknown) => e instanceof Error ? e.message : 'Error'),
}));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => {
    const profile = { id: 'user-1', full_name: 'Claudio Tula', role: 'responsible', email: 'claudio@test.com', active: true, created_at: '', updated_at: '', phone: undefined };
    return { user: { id: 'user-1', email: 'claudio@test.com', app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '' }, profile, logout: () => Promise.resolve(), login: () => Promise.resolve({ error: null, profile }), getRedirectPath: () => '/responsable', hasRole: () => true, isAdmin: false, isTechnician: false, isSupervisor: false, isResponsible: true, isAuthenticated: true, loading: false, error: null };
  }),
}));
vi.mock('@/components/layout/Sidebar', () => ({ default: vi.fn(() => <div data-testid="sidebar" />) }));

import { getResponsibleBuildings, getResponsibleElevators, getResponsibleClients, getResponsibleVisitEntries } from '@/services/responsiblePortalService';
const mockGetBuildings = vi.mocked(getResponsibleBuildings);
const mockGetElevators = vi.mocked(getResponsibleElevators);
const mockGetClients = vi.mocked(getResponsibleClients);
const mockGetVisitEntries = vi.mocked(getResponsibleVisitEntries);

interface Deferred<T> { promise: Promise<T>; resolve: (value: T) => void; }
function deferred<T>(): Deferred<T> { let resolve!: (value: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; }

function renderPage(buildingId = 'building-1') {
  return render(
    <MemoryRouter initialEntries={[`/responsable/edificios/${buildingId}`]}>
      <Routes>
        <Route path="/responsable/edificios/:buildingId" element={<ResponsibleBuildingDetailPage />} />
        <Route path="/responsable/edificios" element={<div data-testid="edificios-list">Edificios list</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => { vi.clearAllMocks(); mockGetBuildings.mockResolvedValue([mockBuilding]); mockGetElevators.mockResolvedValue(mockElevators); mockGetClients.mockResolvedValue([mockClient]); mockGetVisitEntries.mockResolvedValue([]); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('ResponsibleBuildingDetailPage', () => {
  it('muestra datos del edificio', async () => {
    renderPage();
    await waitFor(() => { expect(screen.getByText('ED-001')).toBeInTheDocument(); expect(screen.getByText('Av. Principal 123')).toBeInTheDocument(); expect(screen.getByText('Comodoro Rivadavia')).toBeInTheDocument(); expect(screen.getByText('Hospital Regional S.A.')).toBeInTheDocument(); });
  });
  it('muestra código, fabricante y modelo de ascensores', async () => {
    renderPage();
    await waitFor(() => { expect(screen.getByText('ASC-0001')).toBeInTheDocument(); expect(screen.getByText('Otis Gen2')).toBeInTheDocument(); expect(screen.getByText('ASC-0002')).toBeInTheDocument(); expect(screen.getByText('Schindler 3300')).toBeInTheDocument(); });
  });
  it('ordena por código natural: ASC-0001, ASC-0002, ASC-10', async () => {
    renderPage();
    await waitFor(() => { expect(screen.getByText('ASC-0001')).toBeInTheDocument(); });
    const links = screen.getAllByRole('link').filter((l) => l.getAttribute('href')?.startsWith('/responsable/ascensores/'));
    const codes = links.map((l) => l.querySelector('p.font-mono')?.textContent?.trim() || '');
    expect(codes).toEqual(['ASC-0001', 'ASC-0002', 'ASC-10']);
  });
  it('muestra estado traducido', async () => {
    renderPage();
    await waitFor(() => { expect(document.body.textContent).toContain('Operativo'); });
  });
  it('enlaces apuntan a /responsable/ascensores/<id>', async () => {
    renderPage();
    await waitFor(() => { expect(screen.getByText('ASC-0001')).toBeInTheDocument(); });
    const links = screen.getAllByRole('link').filter((l) => l.getAttribute('href')?.startsWith('/responsable/ascensores/'));
    expect(links[0].getAttribute('href')).toBe('/responsable/ascensores/elevator-1');
  });
  it('enlace Libro consolidado con buildingId', async () => {
    renderPage();
    await waitFor(() => { expect(screen.getByText('ASC-0001')).toBeInTheDocument(); });
    expect(screen.getByText('Libro consolidado').closest('a')?.getAttribute('href')).toBe('/responsable/libro-visitas?buildingId=building-1');
  });
  it('muestra exactamente 10 visitas, las más recientes', async () => {
    mockGetVisitEntries.mockResolvedValue(Array.from({ length: 15 }, (_, i) => makeVisit({ id: `v-${i}`, visit_date: `2026-07-${String(i + 1).padStart(2, '0')}`, entry_number: i + 1, title: `V${i + 1}` })));
    renderPage();
    await waitFor(() => {
      const text = document.body.textContent || '';
      expect(text).toContain('V15');
      expect(text).toContain('V6');
      expect(text).not.toMatch(/V5[^0-9]/);
      expect(text).not.toMatch(/V1[^0-9]/);
    });
  });
  it('ordena visitas: fecha descendente, entry_number descendente', async () => {
    mockGetVisitEntries.mockResolvedValue([
      makeVisit({ id: 'v-1', visit_date: '2026-07-10', entry_number: 1, title: 'Primera' }),
      makeVisit({ id: 'v-2', visit_date: '2026-07-10', entry_number: 2, title: 'Segunda' }),
      makeVisit({ id: 'v-3', visit_date: '2026-07-15', entry_number: 1, title: 'Tercera' }),
    ]);
    renderPage();
    await waitFor(() => {
      const text = document.body.textContent || '';
      const idxTercera = text.indexOf('Tercera');
      const idxSegunda = text.indexOf('Segunda');
      const idxPrimera = text.indexOf('Primera');
      expect(idxTercera).toBeGreaterThan(0);
      expect(idxTercera).toBeLessThan(idxSegunda);
      expect(idxSegunda).toBeLessThan(idxPrimera);
    });
  });
  it('filtra visitas de otros edificios', async () => {
    mockGetVisitEntries.mockResolvedValue([
      makeVisit({ id: 'v-1', elevator_id: 'elevator-1', visit_date: '2026-07-27', title: 'X' }),
      makeVisit({ id: 'v-2', elevator_id: 'elevator-99', visit_date: '2026-07-27', title: 'Y' }),
    ]);
    renderPage();
    await waitFor(() => { const text = document.body.textContent || ''; expect(text).toContain('X'); expect(text).not.toContain('Y'); });
  });
  it('muestra código del ascensor en cada visita', async () => {
    mockGetVisitEntries.mockResolvedValue([makeVisit({ id: 'v-1', elevator_id: 'elevator-1', visit_date: '2026-07-27', title: 'Test' })]);
    renderPage();
    await waitFor(() => { expect(document.body.textContent).toContain('ASC-0001'); });
  });
  it('sin ascensores muestra "No hay ascensores"', async () => {
    mockGetElevators.mockResolvedValue([]);
    renderPage();
    await waitFor(() => { expect(screen.getByText('No hay ascensores')).toBeInTheDocument(); });
  });
  it('sin visitas muestra "No hay visitas"', async () => {
    renderPage();
    await waitFor(() => { expect(screen.getByText('No hay visitas')).toBeInTheDocument(); });
  });
  it('cliente faltante muestra "-"', async () => {
    mockGetClients.mockResolvedValue([]);
    renderPage();
    await waitFor(() => { expect(screen.getByText('ED-001')).toBeInTheDocument(); });
    expect(screen.getAllByText('-').length).toBeGreaterThanOrEqual(1);
  });
  it('acceso no autorizado: no muestra datos privados', async () => {
    renderPage('building-prohibido');
    await waitFor(() => { expect(screen.getByText('No tiene permiso para consultar este recurso')).toBeInTheDocument(); });
    const text = document.body.textContent || '';
    expect(text).not.toContain('ED-001');
    expect(text).not.toContain('Hospital Regional');
    expect(text).not.toContain('Av. Principal 123');
    expect(text).not.toContain('Hospital Regional S.A.');
    expect(text).not.toContain('ASC-0001');
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /volver/i })).toBeInTheDocument();
  });
  it('error de RPC y reintento exacto', async () => {
    mockGetBuildings.mockRejectedValueOnce(new Error('RPC failed'));
    renderPage();
    await waitFor(() => { expect(screen.getByText('RPC failed')).toBeInTheDocument(); });
    mockGetBuildings.mockResolvedValue([mockBuilding]); mockGetElevators.mockResolvedValue(mockElevators); mockGetClients.mockResolvedValue([mockClient]); mockGetVisitEntries.mockResolvedValue([]);
    await userEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    await waitFor(() => { expect(screen.queryByText('RPC failed')).not.toBeInTheDocument(); expect(screen.getByText('ED-001')).toBeInTheDocument(); });
    expect(mockGetBuildings).toHaveBeenCalledTimes(2);
    expect(mockGetElevators).toHaveBeenCalledTimes(2);
    expect(mockGetClients).toHaveBeenCalledTimes(2);
    expect(mockGetVisitEntries).toHaveBeenCalledTimes(2);
  });
  it('estado de carga: promesas pendientes muestran spinner', async () => {
    const bld = deferred<ResponsibleBuilding[]>(); const els = deferred<ResponsibleElevator[]>(); const vis = deferred<ResponsibleVisitEntry[]>(); const cls = deferred<ResponsibleClient[]>();
    mockGetBuildings.mockReturnValue(bld.promise); mockGetElevators.mockReturnValue(els.promise); mockGetVisitEntries.mockReturnValue(vis.promise); mockGetClients.mockReturnValue(cls.promise);
    renderPage();
    expect(screen.queryByText('ED-001')).not.toBeInTheDocument();
    expect(screen.queryByText('ASC-0001')).not.toBeInTheDocument();
    bld.resolve([mockBuilding]); els.resolve(mockElevators); vis.resolve([]); cls.resolve([mockClient]);
    await waitFor(() => { expect(screen.getByText('ED-001')).toBeInTheDocument(); });
  });
  it('Volver navega a /responsable/edificios', async () => {
    renderPage();
    await waitFor(() => { expect(screen.getByText('ED-001')).toBeInTheDocument(); });
    await userEvent.click(screen.getByRole('button', { name: /volver/i }));
    await waitFor(() => { expect(screen.getByTestId('edificios-list')).toBeInTheDocument(); });
  });
});
