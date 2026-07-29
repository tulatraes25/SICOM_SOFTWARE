import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ResponsibleElevatorsPage from './ResponsibleElevatorsPage';
import type { ResponsibleBuilding, ResponsibleElevator } from '@/services/responsiblePortalService';

const mockBuildings: ResponsibleBuilding[] = [
  { id: 'building-1', client_id: 'client-1', code: 'ED-001', name: 'Hospital Regional', address: 'Av. Principal 123', locality: 'Comodoro Rivadavia', province: 'Chubut' },
  { id: 'building-2', client_id: 'client-1', code: 'ED-002', name: 'Clínica 10', address: 'Calle X 456', locality: 'Rawson', province: 'Chubut' },
  { id: 'building-3', client_id: 'client-1', code: 'ED-003', name: 'Clínica 2', address: 'Calle Y 789', locality: 'Trelew', province: 'Chubut' },
];

const mockElevators: ResponsibleElevator[] = [
  { id: 'elevator-10', code: 'ASC-10', building_id: 'building-3', manufacturer: 'Kone', model: 'MiniSpace', elevator_type: 'passenger', capacity_kg: 630, floors_served: '1-3', year_installed: 2021, operational_status: 'operativo', conservation_status: 'conforme', contractual_status: 'active', last_service_date: null, next_service_date: null, active: true },
  { id: 'elevator-2', code: 'ASC-2', building_id: 'building-3', manufacturer: 'Schindler', model: '3300', elevator_type: 'passenger', capacity_kg: 1000, floors_served: '1-8', year_installed: 2019, operational_status: 'operativo', conservation_status: 'conforme', contractual_status: 'active', last_service_date: null, next_service_date: null, active: true },
  { id: 'elevator-1', code: 'ASC-1', building_id: 'building-1', manufacturer: 'Otis', model: 'Gen2', elevator_type: 'passenger', capacity_kg: 800, floors_served: '1-5', year_installed: 2020, operational_status: 'operativo', conservation_status: 'conforme', contractual_status: 'active', last_service_date: null, next_service_date: null, active: true },
  { id: 'elevator-3', code: 'ASC-3', building_id: 'building-2', manufacturer: 'Kone', model: null, elevator_type: 'passenger', capacity_kg: 630, floors_served: '1-3', year_installed: 2021, operational_status: 'operativo', conservation_status: 'conforme', contractual_status: 'active', last_service_date: null, next_service_date: null, active: true },
  { id: 'elevator-foreign', code: 'ASC-9999', building_id: 'building-no-asignado', manufacturer: null, model: 'Desconocido', elevator_type: 'other', capacity_kg: 500, floors_served: '1-2', year_installed: 2018, operational_status: null, conservation_status: null, contractual_status: 'active', last_service_date: null, next_service_date: null, active: true },
];

vi.mock('@/services/responsiblePortalService', () => ({
  getResponsibleElevators: vi.fn(), getResponsibleBuildings: vi.fn(),
  getErrorMessage: vi.fn((e: unknown) => e instanceof Error ? e.message : 'Error'),
}));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'u1' }, profile: { id: 'u1', full_name: 'Test', role: 'responsible', email: 't@t.com', active: true, created_at: '', updated_at: '' }, logout: () => Promise.resolve(), login: () => Promise.resolve({ error: null }), getRedirectPath: () => '/', hasRole: () => true, isAdmin: false, isTechnician: false, isSupervisor: false, isResponsible: true, isAuthenticated: true, loading: false, error: null })),
}));
vi.mock('@/components/layout/Sidebar', () => ({ default: vi.fn(() => <div data-testid="sidebar" />) }));

import { getResponsibleElevators, getResponsibleBuildings } from '@/services/responsiblePortalService';
const mockGetElevators = vi.mocked(getResponsibleElevators);
const mockGetBuildings = vi.mocked(getResponsibleBuildings);

interface Deferred<T> { promise: Promise<T>; resolve: (value: T) => void; }
function deferred<T>(): Deferred<T> { let resolve!: (value: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; }

function renderPage() {
  return render(<MemoryRouter><ResponsibleElevatorsPage /></MemoryRouter>);
}

function text() { return document.body.textContent || ''; }

beforeEach(() => {
  vi.clearAllMocks();
  mockGetElevators.mockResolvedValue(mockElevators);
  mockGetBuildings.mockResolvedValue(mockBuildings);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('ResponsibleElevatorsPage', () => {
  it('muestra código, edificio, fabricante/modelo y estados', async () => {
    renderPage();
    await waitFor(() => {
      expect(text()).toContain('ASC-1');
      expect(text()).toContain('Hospital Regional');
      expect(text()).toContain('Otis Gen2');
      expect(text()).toContain('Operativo');
      expect(text()).toContain('Conforme');
    });
  });
  it('orden visual exacto', async () => {
    renderPage();
    await waitFor(() => { expect(text()).toContain('ASC-1'); });
    const t = text();
    const idx = [
      t.indexOf('Clínica 2'),
      t.indexOf('Clínica 10'),
      t.indexOf('Hospital Regional'),
      t.indexOf('Edificio desconocido'),
    ].filter((i) => i >= 0);
    for (let i = 1; i < idx.length; i++) { expect(idx[i - 1]).toBeLessThan(idx[i]); }
  });
  it('ASC-2 antes de ASC-10', async () => {
    renderPage();
    await waitFor(() => { expect(text()).toContain('ASC-1'); });
    const t = text();
    expect(t.indexOf('ASC-2')).toBeLessThan(t.indexOf('ASC-10'));
  });
  it('fabricante/modelo: los 4 casos', async () => {
    renderPage();
    await waitFor(() => { expect(text()).toContain('ASC-1'); });
    expect(text()).toContain('Otis Gen2');
    expect(text()).toContain('Kone');
    expect(text()).toContain('Schindler 3300');
    expect(text()).toContain('Desconocido');
  });
  it('edificio faltante muestra "-"', async () => {
    renderPage();
    await waitFor(() => { expect(text()).toContain('ASC-9999'); });
    const t = text();
    expect(t).toContain('ASC-9999');
    expect(t).not.toContain('building-no-asignado');
  });
  it('estados con fallback "-"', async () => {
    renderPage();
    await waitFor(() => { expect(text()).toContain('ASC-9999'); });
    const t = text();
    expect(t).toContain('Operativo');
    expect(t).toContain('Conforme');
  });
  it('enlaces correctos', async () => {
    renderPage();
    await waitFor(() => { expect(text()).toContain('ASC-1'); });
    const links = screen.getAllByRole('link');
    const hrefs = links.map((l) => l.getAttribute('href'));
    expect(hrefs).toContain('/responsable/ascensores/elevator-1');
    expect(hrefs).toContain('/responsable/ascensores/elevator-2');
    expect(hrefs).toContain('/responsable/ascensores/elevator-10');
  });
  it('aria-label correcto', async () => {
    renderPage();
    await waitFor(() => { expect(text()).toContain('ASC-1'); });
    expect(screen.getByLabelText('Ver ascensor ASC-1')).toBeInTheDocument();
    expect(screen.getByLabelText('Ver ascensor ASC-2')).toBeInTheDocument();
  });
  it('privacidad: no muestra IDs', async () => {
    renderPage();
    await waitFor(() => { expect(text()).toContain('ASC-1'); });
    expect(text()).not.toContain('elevator-1');
    expect(text()).not.toContain('building-1');
    expect(text()).not.toContain('building-no-asignado');
  });
  it('estado vacío', async () => {
    mockGetElevators.mockResolvedValue([]);
    mockGetBuildings.mockResolvedValue([]);
    renderPage();
    await waitFor(() => {
      expect(text()).toContain('No tiene ascensores asignados');
      expect(screen.getByRole('button', { name: /actualizar/i })).not.toBeDisabled();
    });
    expect(screen.queryByLabelText(/Ver ascensor/)).not.toBeInTheDocument();
  });
  it('estado de carga', async () => {
    const elsDef = deferred<ResponsibleElevator[]>();
    const bldDef = deferred<ResponsibleBuilding[]>();
    mockGetElevators.mockReturnValue(elsDef.promise);
    mockGetBuildings.mockReturnValue(bldDef.promise);
    renderPage();
    expect(screen.getByRole('button', { name: /actualizar/i })).toBeDisabled();
    expect(text()).not.toContain('ASC-1');
    expect(text()).not.toContain('No tiene ascensores');
    elsDef.resolve(mockElevators);
    bldDef.resolve(mockBuildings);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /actualizar/i })).not.toBeDisabled();
      expect(text()).toContain('ASC-1');
    });
  });
  it('error y reintento exacto', async () => {
    mockGetElevators.mockRejectedValueOnce(new Error('RPC failed'));
    renderPage();
    await waitFor(() => { expect(text()).toContain('RPC failed'); });
    const elsDef2 = deferred<ResponsibleElevator[]>();
    const bldDef2 = deferred<ResponsibleBuilding[]>();
    mockGetElevators.mockReturnValue(elsDef2.promise);
    mockGetBuildings.mockReturnValue(bldDef2.promise);
    const btn = screen.getByRole('button', { name: /actualizar/i });
    await userEvent.click(btn);
    expect(btn).toBeDisabled();
    elsDef2.resolve(mockElevators);
    bldDef2.resolve(mockBuildings);
    await waitFor(() => {
      expect(text()).not.toContain('RPC failed');
      expect(text()).toContain('ASC-1');
      expect(btn).not.toBeDisabled();
    });
    expect(mockGetElevators).toHaveBeenCalledTimes(2);
    expect(mockGetBuildings).toHaveBeenCalledTimes(2);
  });
  it('actualización pendiente', async () => {
    renderPage();
    await waitFor(() => { expect(text()).toContain('ASC-1'); });
    const elsDef2 = deferred<ResponsibleElevator[]>();
    const bldDef2 = deferred<ResponsibleBuilding[]>();
    mockGetElevators.mockReturnValue(elsDef2.promise);
    mockGetBuildings.mockReturnValue(bldDef2.promise);
    const btn = screen.getByRole('button', { name: /actualizar/i });
    await userEvent.click(btn);
    expect(btn).toBeDisabled();
    elsDef2.resolve(mockElevators);
    bldDef2.resolve(mockBuildings);
    await waitFor(() => {
      expect(btn).not.toBeDisabled();
      expect(text()).toContain('ASC-1');
    });
    expect(mockGetElevators).toHaveBeenCalledTimes(2);
    expect(mockGetBuildings).toHaveBeenCalledTimes(2);
  });
  it('inmutabilidad', async () => {
    const origEls = [...mockElevators];
    const origBlds = [...mockBuildings];
    renderPage();
    await waitFor(() => { expect(text()).toContain('ASC-1'); });
    expect(mockElevators).toEqual(origEls);
    expect(mockBuildings).toEqual(origBlds);
  });
});
