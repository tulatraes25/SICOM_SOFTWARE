import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, cleanup } from '@testing-library/react';
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
  { id: 'elevator-foreign', code: 'ASC-9999', building_id: 'building-no-asignado', manufacturer: 'Otro', model: 'Desconocido', elevator_type: 'other', capacity_kg: 500, floors_served: '1-2', year_installed: 2018, operational_status: 'operativo', conservation_status: 'conforme', contractual_status: 'active', last_service_date: null, next_service_date: null, active: true },
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

function getCardByName(name: string): HTMLElement {
  const heading = screen.getByRole('heading', { name });
  return heading.closest('div[class*="rounded"]') || heading.parentElement?.parentElement?.parentElement || heading.parentElement?.parentElement || heading;
}

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
  it('conteos por tarjeta: Hospital Regional 2, Clínica 10 1, Clínica 2 0', async () => {
    renderPage();
    await waitFor(() => { expect(text()).toContain('Hospital Regional'); });
    const hrCard = getCardByName('Hospital Regional');
    expect(within(hrCard).getByText('2 ascensores asignados')).toBeInTheDocument();
    const c10Card = getCardByName('Clínica 10');
    expect(within(c10Card).getByText('1 ascensor asignado')).toBeInTheDocument();
    const c2Card = getCardByName('Clínica 2');
    expect(within(c2Card).getByText('0 ascensores asignados')).toBeInTheDocument();
  });
  it('elevator-foreign no se cuenta y no aparece', async () => {
    renderPage();
    await waitFor(() => { expect(text()).toContain('Hospital Regional'); });
    expect(text()).not.toContain('ASC-9999');
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
  it('estado vacío: sin tarjetas, con botón', async () => {
    mockGetBuildings.mockResolvedValue([]);
    mockGetElevators.mockResolvedValue([]);
    renderPage();
    await waitFor(() => {
      expect(text()).toContain('No tiene edificios asignados');
      expect(screen.getByRole('button', { name: /actualizar/i })).not.toBeDisabled();
    });
    expect(text()).not.toContain('Hospital Regional');
    expect(text()).not.toContain('Clínica 2');
    expect(screen.queryByLabelText(/Ver edificio/)).not.toBeInTheDocument();
  });
  it('estado de carga: spinner y datos ausentes', async () => {
    const bldDef = deferred<ResponsibleBuilding[]>();
    const elsDef = deferred<ResponsibleElevator[]>();
    mockGetBuildings.mockReturnValue(bldDef.promise);
    mockGetElevators.mockReturnValue(elsDef.promise);
    renderPage();
    expect(screen.getByRole('button', { name: /actualizar/i })).toBeDisabled();
    expect(text()).not.toContain('Hospital Regional');
    expect(text()).not.toContain('No tiene edificios asignados');
    const spinners = document.querySelectorAll('.animate-spin');
    expect(spinners.length).toBeGreaterThanOrEqual(1);
    bldDef.resolve(mockBuildings);
    elsDef.resolve(mockElevators);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /actualizar/i })).not.toBeDisabled();
      expect(text()).toContain('Hospital Regional');
    });
    expect(document.querySelectorAll('.animate-spin').length).toBe(0);
  });
  it('actualización pendiente: botón se deshabilita y se recupera', async () => {
    renderPage();
    await waitFor(() => { expect(text()).toContain('Hospital Regional'); });
    const bldDef2 = deferred<ResponsibleBuilding[]>();
    const elsDef2 = deferred<ResponsibleElevator[]>();
    mockGetBuildings.mockReturnValue(bldDef2.promise);
    mockGetElevators.mockReturnValue(elsDef2.promise);
    const btn = screen.getByRole('button', { name: /actualizar/i });
    await userEvent.click(btn);
    expect(btn).toBeDisabled();
    expect(mockGetBuildings).toHaveBeenCalledTimes(2);
    expect(mockGetElevators).toHaveBeenCalledTimes(2);
    bldDef2.resolve(mockBuildings);
    elsDef2.resolve(mockElevators);
    await waitFor(() => {
      expect(btn).not.toBeDisabled();
      expect(text()).toContain('Hospital Regional');
    });
    expect(document.querySelectorAll('.animate-spin').length).toBe(0);
  });
  it('error y reintento: deshabilita durante reintento', async () => {
    mockGetBuildings.mockRejectedValueOnce(new Error('RPC failed'));
    renderPage();
    await waitFor(() => { expect(text()).toContain('RPC failed'); });
    const bldDef3 = deferred<ResponsibleBuilding[]>();
    const elsDef3 = deferred<ResponsibleElevator[]>();
    mockGetBuildings.mockReturnValue(bldDef3.promise);
    mockGetElevators.mockReturnValue(elsDef3.promise);
    const btn = screen.getByRole('button', { name: /actualizar/i });
    await userEvent.click(btn);
    expect(btn).toBeDisabled();
    bldDef3.resolve(mockBuildings);
    elsDef3.resolve(mockElevators);
    await waitFor(() => {
      expect(text()).not.toContain('RPC failed');
      expect(text()).toContain('Hospital Regional');
      expect(btn).not.toBeDisabled();
    });
    expect(mockGetBuildings).toHaveBeenCalledTimes(2);
    expect(mockGetElevators).toHaveBeenCalledTimes(2);
  });
  it('orden por código: ED-2 antes de ED-10', async () => {
    const blds: ResponsibleBuilding[] = [
      { id: 'b-1', client_id: 'c-1', code: 'ED-10', name: 'Clínica Central', address: 'X', locality: 'Y', province: 'Z' },
      { id: 'b-2', client_id: 'c-1', code: 'ED-2', name: 'Clínica Central', address: 'X', locality: 'Y', province: 'Z' },
    ];
    mockGetBuildings.mockResolvedValue(blds);
    renderPage();
    await waitFor(() => { expect(text()).toContain('Clínica Central'); });
    const t = text();
    const idx2 = t.indexOf('ED-2');
    const idx10 = t.indexOf('ED-10');
    expect(idx2).toBeLessThan(idx10);
  });
  it('inmutabilidad: no muta los arreglos originales', async () => {
    const origBlds = [...mockBuildings];
    const origEls = [...mockElevators];
    renderPage();
    await waitFor(() => { expect(text()).toContain('Hospital Regional'); });
    expect(mockBuildings).toEqual(origBlds);
    expect(mockElevators).toEqual(origEls);
  });
  it('enlace tiene aria-label correcto', async () => {
    renderPage();
    await waitFor(() => { expect(text()).toContain('Hospital Regional'); });
    const link = screen.getByLabelText('Ver edificio Hospital Regional');
    expect(link).toBeInTheDocument();
    expect(link.getAttribute('href')).toBe('/responsable/edificios/building-1');
  });
});
