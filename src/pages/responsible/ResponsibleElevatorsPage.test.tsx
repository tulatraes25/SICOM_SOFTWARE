import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, cleanup } from '@testing-library/react';
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
  { id: 'elevator-10', code: 'ASC-10', building_id: 'building-3', manufacturer: null, model: null, elevator_type: 'passenger', capacity_kg: 630, floors_served: '1-3', year_installed: 2021, operational_status: null, conservation_status: null, contractual_status: 'active', last_service_date: null, next_service_date: null, active: true },
  { id: 'elevator-2', code: 'ASC-2', building_id: 'building-3', manufacturer: 'Schindler', model: null, elevator_type: 'passenger', capacity_kg: 1000, floors_served: '1-8', year_installed: 2019, operational_status: 'operativo', conservation_status: 'conforme', contractual_status: 'active', last_service_date: null, next_service_date: null, active: true },
  { id: 'elevator-1', code: 'ASC-1', building_id: 'building-1', manufacturer: 'Otis', model: 'Gen2', elevator_type: 'passenger', capacity_kg: 800, floors_served: '1-5', year_installed: 2020, operational_status: 'operativo', conservation_status: 'conforme', contractual_status: 'active', last_service_date: null, next_service_date: null, active: true },
  { id: 'elevator-3', code: 'ASC-3', building_id: 'building-2', manufacturer: null, model: 'Modelo 300', elevator_type: 'passenger', capacity_kg: 630, floors_served: '1-3', year_installed: 2021, operational_status: 'operativo', conservation_status: 'conforme', contractual_status: 'active', last_service_date: null, next_service_date: null, active: true },
  { id: 'elevator-foreign', code: 'ASC-9999', building_id: 'building-no-asignado', manufacturer: 'Extra', model: 'X', elevator_type: 'other', capacity_kg: 500, floors_served: '1-2', year_installed: 2018, operational_status: null, conservation_status: null, contractual_status: 'active', last_service_date: null, next_service_date: null, active: true },
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
    await waitFor(() => { expect(text()).toContain('ASC-1'); });
    const card = screen.getByTestId('responsible-elevator-elevator-1');
    expect(within(card).getByText('ASC-1')).toBeInTheDocument();
    expect(within(card).getByText('Hospital Regional')).toBeInTheDocument();
    expect(within(card).getByText('Otis Gen2')).toBeInTheDocument();
    expect(within(card).getByText('Operativo')).toBeInTheDocument();
    expect(within(card).getByText('Conforme')).toBeInTheDocument();
  });
  it('orden visual exacto', async () => {
    renderPage();
    await waitFor(() => { expect(text()).toContain('ASC-1'); });
    const cards = screen.getAllByTestId(/^responsible-elevator-/);
    const codes = cards.map((c) => within(c).getByText(/^ASC-/).textContent);
    expect(codes).toEqual(['ASC-2', 'ASC-10', 'ASC-3', 'ASC-1', 'ASC-9999']);
  });
  it('ASC-2 antes de ASC-10', async () => {
    renderPage();
    await waitFor(() => { expect(text()).toContain('ASC-1'); });
    const codes = screen.getAllByTestId(/^responsible-elevator-/).map((c) => within(c).getByText(/^ASC-/).textContent);
    expect(codes.indexOf('ASC-2')).toBeLessThan(codes.indexOf('ASC-10'));
  });
  it('fabricante/modelo por tarjeta', async () => {
    renderPage();
    await waitFor(() => { expect(text()).toContain('ASC-1'); });
    const check = (id: string, expected: string) => {
      const card = screen.getByTestId(id);
      const texts = within(card).getAllByText(expected);
      expect(texts.length).toBeGreaterThanOrEqual(1);
    };
    check('responsible-elevator-elevator-1', 'Otis Gen2');
    check('responsible-elevator-elevator-2', 'Schindler');
    check('responsible-elevator-elevator-3', 'Modelo 300');
    check('responsible-elevator-elevator-10', '-');
    check('responsible-elevator-elevator-foreign', 'Extra X');
  });
  it('edificio faltante muestra "-"', async () => {
    renderPage();
    await waitFor(() => { expect(text()).toContain('ASC-9999'); });
    const card = screen.getByTestId('responsible-elevator-elevator-foreign');
    expect(within(card).getAllByText('-').length).toBeGreaterThanOrEqual(1);
    expect(within(card).queryByText('building-no-asignado')).not.toBeInTheDocument();
  });
  it('estados por tarjeta', async () => {
    renderPage();
    await waitFor(() => { expect(text()).toContain('ASC-1'); });
    const c1 = screen.getByTestId('responsible-elevator-elevator-1');
    expect(within(c1).getByText('Operativo')).toBeInTheDocument();
    expect(within(c1).getByText('Conforme')).toBeInTheDocument();
    const cf = screen.getByTestId('responsible-elevator-elevator-foreign');
    const badges = within(cf).getAllByText('-');
    expect(badges.length).toBeGreaterThanOrEqual(2);
  });
  it('enlaces y aria-label', async () => {
    renderPage();
    await waitFor(() => { expect(text()).toContain('ASC-1'); });
    expect(screen.getByLabelText('Ver ascensor ASC-1').getAttribute('href')).toBe('/responsable/ascensores/elevator-1');
    expect(screen.getByLabelText('Ver ascensor ASC-2').getAttribute('href')).toBe('/responsable/ascensores/elevator-2');
    expect(screen.getByLabelText('Ver ascensor ASC-3').getAttribute('href')).toBe('/responsable/ascensores/elevator-3');
    expect(screen.getByLabelText('Ver ascensor ASC-10').getAttribute('href')).toBe('/responsable/ascensores/elevator-10');
    expect(screen.getByLabelText('Ver ascensor ASC-9999').getAttribute('href')).toBe('/responsable/ascensores/elevator-foreign');
  });
  it('privacidad: no muestra IDs', async () => {
    renderPage();
    await waitFor(() => { expect(text()).toContain('ASC-1'); });
    expect(text()).not.toContain('elevator-1');
    expect(text()).not.toContain('building-1');
  });
  it('estado vacío', async () => {
    mockGetElevators.mockResolvedValue([]);
    mockGetBuildings.mockResolvedValue([]);
    renderPage();
    await waitFor(() => {
      expect(text()).toContain('No tiene ascensores asignados');
      expect(screen.getByRole('button', { name: /actualizar/i })).not.toBeDisabled();
    });
    expect(screen.queryByTestId(/^responsible-elevator-/)).not.toBeInTheDocument();
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
    expect(document.querySelectorAll('.animate-spin')).toHaveLength(1);
    elsDef.resolve(mockElevators);
    bldDef.resolve(mockBuildings);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /actualizar/i })).not.toBeDisabled();
      expect(text()).toContain('ASC-1');
      expect(document.querySelectorAll('.animate-spin')).toHaveLength(0);
      expect(screen.getAllByTestId(/^responsible-elevator-/)).toHaveLength(5);
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
  it('inmutabilidad profunda', async () => {
    const origEls = mockElevators.map((e) => ({ ...e }));
    const origBlds = mockBuildings.map((b) => ({ ...b }));
    renderPage();
    await waitFor(() => { expect(text()).toContain('ASC-1'); });
    expect(mockElevators).toEqual(origEls);
    expect(mockBuildings).toEqual(origBlds);
  });
});
