import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ResponsibleBuildingsPage from './ResponsibleBuildingsPage';
import type { ResponsibleBuilding, ResponsibleElevator } from '@/services/responsiblePortalService';

const mockBuildings: ResponsibleBuilding[] = [
  { id: 'building-1', client_id: 'client-1', code: 'ED-001', name: 'Hospital Regional', address: 'Av. Principal 123', locality: 'Comodoro Rivadavia', province: 'Chubut' },
  { id: 'building-2', client_id: 'client-1', code: 'ED-002', name: 'Clínica 10', address: 'Calle X 456', locality: 'Rawson', province: 'Chubut' },
  { id: 'building-3', client_id: 'client-1', code: 'ED-003', name: 'Clínica 2', address: 'Calle Y 789', locality: 'Trelew', province: 'Chubut' },
];
const mockElevators: ResponsibleElevator[] = [
  { id: 'elevator-1', code: 'ASC-0001', building_id: 'building-1', manufacturer: 'Otis', model: 'Gen2', elevator_type: 'passenger', capacity_kg: 800, floors_served: '1-5', year_installed: 2020, operational_status: 'operativo', conservation_status: 'conforme', contractual_status: 'active', last_service_date: null, next_service_date: null, active: true },
  { id: 'elevator-2', code: 'ASC-0002', building_id: 'building-1', manufacturer: 'Schindler', model: '3300', elevator_type: 'passenger', capacity_kg: 1000, floors_served: '1-8', year_installed: 2019, operational_status: 'operativo', conservation_status: 'conforme', contractual_status: 'active', last_service_date: null, next_service_date: null, active: true },
  { id: 'elevator-3', code: 'ASC-0010', building_id: 'building-2', manufacturer: 'Kone', model: 'MiniSpace', elevator_type: 'passenger', capacity_kg: 630, floors_served: '1-3', year_installed: 2021, operational_status: 'operativo', conservation_status: 'conforme', contractual_status: 'active', last_service_date: null, next_service_date: null, active: true },
];

vi.mock('@/services/responsiblePortalService', () => ({
  getResponsibleBuildings: vi.fn(), getResponsibleElevators: vi.fn(),
  getErrorMessage: vi.fn((e: unknown) => e instanceof Error ? e.message : 'Error'),
}));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'u1' }, profile: { id: 'u1', full_name: 'Test', role: 'responsible', email: 't@t.com', active: true, created_at: '', updated_at: '' }, logout: () => Promise.resolve(), login: () => Promise.resolve({ error: null }), getRedirectPath: () => '/', hasRole: () => true, isAdmin: false, isTechnician: false, isSupervisor: false, isResponsible: true, isAuthenticated: true, loading: false, error: null })),
}));
vi.mock('@/components/layout/Sidebar', () => ({ default: vi.fn(() => <div data-testid="sidebar" />) }));

import { getResponsibleBuildings, getResponsibleElevators } from '@/services/responsiblePortalService';
const mockGetBuildings = vi.mocked(getResponsibleBuildings);
const mockGetElevators = vi.mocked(getResponsibleElevators);

interface Deferred<T> { promise: Promise<T>; resolve: (value: T) => void; }
function deferred<T>(): Deferred<T> { let resolve!: (value: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; }

function renderPage() {
  return render(<MemoryRouter><ResponsibleBuildingsPage /></MemoryRouter>);
}

function text() { return document.body.textContent || ''; }

beforeEach(() => {
  vi.clearAllMocks();
  mockGetBuildings.mockResolvedValue(mockBuildings);
  mockGetElevators.mockResolvedValue(mockElevators);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('ResponsibleBuildingsPage', () => {
  it('muestra datos de los edificios', async () => {
    renderPage();
    await waitFor(() => {
      expect(text()).toContain('Hospital Regional');
      expect(text()).toContain('ED-001');
      expect(text()).toContain('Av. Principal 123');
      expect(text()).toContain('Comodoro Rivadavia');
    });
  });
  it('ordena por nombre: Clínica 2, Clínica 10, Hospital Regional', async () => {
    renderPage();
    await waitFor(() => { expect(text()).toContain('Hospital Regional'); });
    const t = text();
    const idx2 = t.indexOf('Clínica 2');
    const idx10 = t.indexOf('Clínica 10');
    const idxH = t.indexOf('Hospital Regional');
    expect(idx2).toBeLessThan(idx10);
    expect(idx10).toBeLessThan(idxH);
  });
  it('conteos de ascensores correctos', async () => {
    renderPage();
    await waitFor(() => { expect(text()).toContain('Hospital Regional'); });
    const t = text();
    expect(t).toContain('2 ascensores asignados');
    expect(t).toContain('1 ascensor asignado');
    expect(t).toContain('0 ascensores asignados');
  });
  it('enlaces correctos', async () => {
    renderPage();
    await waitFor(() => { expect(text()).toContain('Hospital Regional'); });
    const links = screen.getAllByRole('link');
    const hrefs = links.map((l) => l.getAttribute('href'));
    expect(hrefs).toContain('/responsable/edificios/building-1');
    expect(hrefs).toContain('/responsable/edificios/building-2');
    expect(hrefs).toContain('/responsable/edificios/building-3');
  });
  it('privacidad: no muestra IDs', async () => {
    renderPage();
    await waitFor(() => { expect(text()).toContain('Hospital Regional'); });
    expect(text()).not.toContain('building-1');
    expect(text()).not.toContain('elevator-1');
  });
  it('estado vacío', async () => {
    mockGetBuildings.mockResolvedValue([]);
    mockGetElevators.mockResolvedValue([]);
    renderPage();
    await waitFor(() => { expect(text()).toContain('No tiene edificios asignados'); });
  });
  it('estado de carga', async () => {
    const bldDef = deferred<ResponsibleBuilding[]>();
    const elsDef = deferred<ResponsibleElevator[]>();
    mockGetBuildings.mockReturnValue(bldDef.promise);
    mockGetElevators.mockReturnValue(elsDef.promise);
    renderPage();
    expect(screen.getByRole('button', { name: /actualizar/i })).toBeDisabled();
    expect(text()).not.toContain('Hospital Regional');
    bldDef.resolve(mockBuildings);
    elsDef.resolve(mockElevators);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /actualizar/i })).not.toBeDisabled();
      expect(text()).toContain('Hospital Regional');
    });
  });
  it('error y reintento', async () => {
    mockGetBuildings.mockRejectedValueOnce(new Error('RPC failed'));
    renderPage();
    await waitFor(() => { expect(text()).toContain('RPC failed'); });
    mockGetBuildings.mockResolvedValue(mockBuildings);
    mockGetElevators.mockResolvedValue(mockElevators);
    await userEvent.click(screen.getByRole('button', { name: /actualizar/i }));
    await waitFor(() => {
      expect(text()).not.toContain('RPC failed');
      expect(text()).toContain('Hospital Regional');
    });
    expect(mockGetBuildings).toHaveBeenCalledTimes(2);
    expect(mockGetElevators).toHaveBeenCalledTimes(2);
  });
  it('actualizar ejecuta dos llamadas', async () => {
    renderPage();
    await waitFor(() => { expect(text()).toContain('Hospital Regional'); });
    await userEvent.click(screen.getByRole('button', { name: /actualizar/i }));
    await waitFor(() => {
      expect(mockGetBuildings).toHaveBeenCalledTimes(2);
      expect(mockGetElevators).toHaveBeenCalledTimes(2);
    });
  });
  it('inmutabilidad: no muta los arreglos originales', async () => {
    const origBlds = [...mockBuildings];
    const origEls = [...mockElevators];
    renderPage();
    await waitFor(() => { expect(text()).toContain('Hospital Regional'); });
    expect(mockBuildings).toEqual(origBlds);
    expect(mockElevators).toEqual(origEls);
  });
  it('enlace tiene aria-label', async () => {
    renderPage();
    await waitFor(() => { expect(text()).toContain('Hospital Regional'); });
    const link = screen.getByLabelText('Ver edificio Hospital Regional');
    expect(link).toBeInTheDocument();
    expect(link.getAttribute('href')).toBe('/responsable/edificios/building-1');
  });
  it('elevator-foreign no se cuenta en building-2', async () => {
    renderPage();
    await waitFor(() => { expect(text()).toContain('Clínica 10'); });
    const t = text();
    expect(t).toContain('1 ascensor');
    const idx10 = t.indexOf('Clínica 10');
    const nextSection = t.indexOf('Hospital', idx10);
    expect(t.substring(idx10, nextSection)).toContain('1 ascensor');
    expect(t.substring(idx10, nextSection)).not.toContain('2 ascensores');
  });
  it('loading deshabilita Actualizar', async () => {
    const bldDef = deferred<ResponsibleBuilding[]>();
    const elsDef = deferred<ResponsibleElevator[]>();
    mockGetBuildings.mockReturnValue(bldDef.promise);
    mockGetElevators.mockReturnValue(elsDef.promise);
    renderPage();
    expect(screen.getByRole('button', { name: /actualizar/i })).toBeDisabled();
    bldDef.resolve([]);
    elsDef.resolve([]);
    await waitFor(() => { expect(screen.getByRole('button', { name: /actualizar/i })).not.toBeDisabled(); });
  });
});
