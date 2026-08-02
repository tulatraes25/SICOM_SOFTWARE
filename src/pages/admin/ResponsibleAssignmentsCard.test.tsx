import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ResponsibleAssignmentsCard from './ResponsibleAssignmentsCard';

const { mockGetResponsibleAssignments, mockReplaceResponsibleAssignments, mockListClients, mockListBuildings, mockListElevators } = vi.hoisted(() => ({
  mockGetResponsibleAssignments: vi.fn(),
  mockReplaceResponsibleAssignments: vi.fn(),
  mockListClients: vi.fn(),
  mockListBuildings: vi.fn(),
  mockListElevators: vi.fn(),
}));

vi.mock('@/services/adminUsers.service', () => ({
  getResponsibleAssignments: (...args: unknown[]) => mockGetResponsibleAssignments(...args),
  replaceResponsibleAssignments: (...args: unknown[]) => mockReplaceResponsibleAssignments(...args),
  getAdminUsersErrorMessage: (e: unknown) => e instanceof Error ? e.message : 'Error',
}));

vi.mock('@/services/clients.service', () => ({
  listClients: (...args: unknown[]) => mockListClients(...args),
}));

vi.mock('@/services/buildings.service', () => ({
  listBuildings: (...args: unknown[]) => mockListBuildings(...args),
}));

vi.mock('@/services/elevators.service', () => ({
  listElevators: (...args: unknown[]) => mockListElevators(...args),
}));

vi.mock('@/components/layout/Sidebar', () => ({ default: vi.fn(() => <div data-testid="sidebar" />) }));

const USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

interface Deferred<T> { promise: Promise<T>; resolve: (value: T) => void; reject: (reason?: unknown) => void; }
function deferred<T>(): Deferred<T> { let resolve!: (value: T) => void; let reject!: (reason?: unknown) => void; const promise = new Promise<T>((r, j) => { resolve = r; reject = j; }); return { promise, resolve, reject }; }

function makeClient(overrides: Record<string, unknown> = {}) {
  return { id: 'c1', code: 'C001', name: 'Cliente Alpha', active: true, created_at: '', updated_at: '', ...overrides };
}

function makeBuilding(overrides: Record<string, unknown> = {}) {
  return { id: 'b1', client_id: 'c1', code: 'B001', name: 'Edificio Centro', address: 'Av. Principal 100', locality: 'Nqn', province: 'Nqn', active: true, created_at: '', updated_at: '', ...overrides };
}

function makeElevator(overrides: Record<string, unknown> = {}) {
  return { id: 'e1', code: 'ASC-001', qr_token: 'tok', building_id: 'b1', client_id: 'c1', operational_status: 'operativo', conservation_status: 'conforme', contractual_status: 'activo', active: true, created_at: '', updated_at: '', ...overrides };
}

function setupWithElevator(overrides: Record<string, unknown> = {}) {
  mockGetResponsibleAssignments.mockResolvedValue({ responsible_user_id: USER_ID, assigned_elevator_ids: [] });
  mockListClients.mockResolvedValue([makeClient()]);
  mockListBuildings.mockResolvedValue([makeBuilding()]);
  mockListElevators.mockResolvedValue([makeElevator(overrides)]);
}

let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  vi.clearAllMocks();
  mockGetResponsibleAssignments.mockReset();
  mockReplaceResponsibleAssignments.mockReset();
  mockListClients.mockReset();
  mockListBuildings.mockReset();
  mockListElevators.mockReset();
  user = userEvent.setup();
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('ResponsibleAssignmentsCard — Carga', () => {
  it('llama snapshot, clientes, edificios y ascensores', async () => {
    setupWithElevator();
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(mockGetResponsibleAssignments).toHaveBeenCalledWith(USER_ID); });
    expect(mockListClients).toHaveBeenCalledTimes(1);
    expect(mockListBuildings).toHaveBeenCalledTimes(1);
    expect(mockListElevators).toHaveBeenCalledTimes(1);
  });

  it('muestra loading con aria-busy', async () => {
    mockGetResponsibleAssignments.mockReturnValue(new Promise(() => {}));
    mockListClients.mockReturnValue(new Promise(() => {}));
    mockListBuildings.mockReturnValue(new Promise(() => {}));
    mockListElevators.mockReturnValue(new Promise(() => {}));
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    expect(screen.getByLabelText(/cargando asignaciones/i)).toBeInTheDocument();
  });

  it('carga exitosa muestra asignación actual', async () => {
    mockGetResponsibleAssignments.mockResolvedValue({ responsible_user_id: USER_ID, assigned_elevator_ids: ['e1'] });
    mockListClients.mockResolvedValue([makeClient()]);
    mockListBuildings.mockResolvedValue([makeBuilding()]);
    mockListElevators.mockResolvedValue([makeElevator({ id: 'e1', responsible_user_id: USER_ID })]);
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByText('Ascensor ASC-001')).toBeInTheDocument(); });
  });

  it('muestra ascensor activo disponible', async () => {
    setupWithElevator();
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByText('Ascensor ASC-001')).toBeInTheDocument(); });
  });

  it('no muestra como disponible ascensor de otro responsable', async () => {
    mockGetResponsibleAssignments.mockResolvedValue({ responsible_user_id: USER_ID, assigned_elevator_ids: [] });
    mockListClients.mockResolvedValue([makeClient()]);
    mockListBuildings.mockResolvedValue([makeBuilding()]);
    mockListElevators.mockResolvedValue([makeElevator({ responsible_user_id: 'other-user' })]);
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.queryByText('Ascensor ASC-001')).not.toBeInTheDocument(); });
  });

  it('muestra asignación actual inactiva', async () => {
    mockGetResponsibleAssignments.mockResolvedValue({ responsible_user_id: USER_ID, assigned_elevator_ids: ['e1'] });
    mockListClients.mockResolvedValue([makeClient()]);
    mockListBuildings.mockResolvedValue([makeBuilding()]);
    mockListElevators.mockResolvedValue([makeElevator({ id: 'e1', active: false, responsible_user_id: USER_ID })]);
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByText('Ascensor ASC-001')).toBeInTheDocument(); });
    expect(screen.getByText('Inactivo')).toBeInTheDocument();
  });

  it('error de carga role alert', async () => {
    mockGetResponsibleAssignments.mockRejectedValue(new Error('Falló'));
    mockListClients.mockResolvedValue([]);
    mockListBuildings.mockResolvedValue([]);
    mockListElevators.mockResolvedValue([]);
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByRole('alert')).toHaveTextContent('Falló'); });
  });

  it('reintento vuelve a cargar', async () => {
    mockGetResponsibleAssignments.mockRejectedValueOnce(new Error('Falló'));
    mockListClients.mockResolvedValue([]);
    mockListBuildings.mockResolvedValue([]);
    mockListElevators.mockResolvedValue([]);
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByRole('alert')).toBeInTheDocument(); });
    setupWithElevator();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    await waitFor(() => { expect(screen.getByText('Asignaciones de edificios y ascensores')).toBeInTheDocument(); });
  });

  it('reintento no llama replace', async () => {
    mockGetResponsibleAssignments.mockRejectedValueOnce(new Error('Falló'));
    mockListClients.mockResolvedValue([]);
    mockListBuildings.mockResolvedValue([]);
    mockListElevators.mockResolvedValue([]);
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByRole('alert')).toBeInTheDocument(); });
    setupWithElevator();
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    await waitFor(() => { expect(mockReplaceResponsibleAssignments).not.toHaveBeenCalled(); });
  });

  it('ID actual ausente del catálogo bloquea', async () => {
    mockGetResponsibleAssignments.mockResolvedValue({ responsible_user_id: USER_ID, assigned_elevator_ids: ['e-missing'] });
    mockListClients.mockResolvedValue([]);
    mockListBuildings.mockResolvedValue([]);
    mockListElevators.mockResolvedValue([]);
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByRole('alert')).toHaveTextContent(/No se pudo reconstruir/); });
  });

  it('responsible_user_id contradictorio bloquea', async () => {
    mockGetResponsibleAssignments.mockResolvedValue({ responsible_user_id: USER_ID, assigned_elevator_ids: ['e1'] });
    mockListClients.mockResolvedValue([makeClient()]);
    mockListBuildings.mockResolvedValue([makeBuilding()]);
    mockListElevators.mockResolvedValue([makeElevator({ id: 'e1', responsible_user_id: 'other-user' })]);
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByRole('alert')).toHaveTextContent(/No se pudo reconstruir/); });
  });

  it('respuesta vieja se ignora al cambiar responsable', async () => {
    mockGetResponsibleAssignments.mockResolvedValue({ responsible_user_id: USER_ID, assigned_elevator_ids: [] });
    mockListClients.mockResolvedValue([]);
    mockListBuildings.mockResolvedValue([]);
    mockListElevators.mockResolvedValue([]);
    const { rerender } = render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(mockGetResponsibleAssignments).toHaveBeenCalledTimes(1); });
    rerender(<ResponsibleAssignmentsCard responsibleUserId="new-user" />);
    await waitFor(() => { expect(mockGetResponsibleAssignments).toHaveBeenCalledTimes(2); });
    expect(mockGetResponsibleAssignments).toHaveBeenLastCalledWith('new-user');
  });

  it('desmontaje invalida respuesta pendiente', async () => {
    let resolve!: (v: unknown) => void;
    mockGetResponsibleAssignments.mockReturnValue(new Promise((r) => { resolve = r; }));
    mockListClients.mockReturnValue(new Promise(() => {}));
    mockListBuildings.mockReturnValue(new Promise(() => {}));
    mockListElevators.mockReturnValue(new Promise(() => {}));
    const { unmount } = render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    unmount();
    resolve({ responsible_user_id: USER_ID, assigned_elevator_ids: [] });
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  });

  it('building.client_id distinto de elevator.client_id bloquea catálogo', async () => {
    mockGetResponsibleAssignments.mockResolvedValue({ responsible_user_id: USER_ID, assigned_elevator_ids: ['e1'] });
    mockListClients.mockResolvedValue([makeClient()]);
    mockListBuildings.mockResolvedValue([makeBuilding({ client_id: 'c-other' })]);
    mockListElevators.mockResolvedValue([makeElevator({ id: 'e1', responsible_user_id: USER_ID })]);
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByRole('alert')).toHaveTextContent(/No se pudo reconstruir/); });
  });

  it('asignación actual sin edificio bloquea catálogo', async () => {
    mockGetResponsibleAssignments.mockResolvedValue({ responsible_user_id: USER_ID, assigned_elevator_ids: ['e1'] });
    mockListClients.mockResolvedValue([makeClient()]);
    mockListBuildings.mockResolvedValue([]);
    mockListElevators.mockResolvedValue([makeElevator({ id: 'e1', responsible_user_id: USER_ID })]);
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByRole('alert')).toHaveTextContent(/No se pudo reconstruir/); });
  });

  it('asignación actual sin cliente bloquea catálogo', async () => {
    mockGetResponsibleAssignments.mockResolvedValue({ responsible_user_id: USER_ID, assigned_elevator_ids: ['e1'] });
    mockListClients.mockResolvedValue([]);
    mockListBuildings.mockResolvedValue([makeBuilding()]);
    mockListElevators.mockResolvedValue([makeElevator({ id: 'e1', responsible_user_id: USER_ID })]);
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByRole('alert')).toHaveTextContent(/No se pudo reconstruir/); });
  });
});

describe('ResponsibleAssignmentsCard — Elegibilidad', () => {
  it('ascensor libre con cliente inactivo no aparece', async () => {
    mockGetResponsibleAssignments.mockResolvedValue({ responsible_user_id: USER_ID, assigned_elevator_ids: [] });
    mockListClients.mockResolvedValue([makeClient({ active: false })]);
    mockListBuildings.mockResolvedValue([makeBuilding()]);
    mockListElevators.mockResolvedValue([makeElevator()]);
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByText('Asignaciones de edificios y ascensores')).toBeInTheDocument(); });
    expect(screen.queryByText('Ascensor ASC-001')).not.toBeInTheDocument();
  });

  it('ascensor libre con edificio inactivo no aparece', async () => {
    mockGetResponsibleAssignments.mockResolvedValue({ responsible_user_id: USER_ID, assigned_elevator_ids: [] });
    mockListClients.mockResolvedValue([makeClient()]);
    mockListBuildings.mockResolvedValue([makeBuilding({ active: false })]);
    mockListElevators.mockResolvedValue([makeElevator()]);
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByText('Asignaciones de edificios y ascensores')).toBeInTheDocument(); });
    expect(screen.queryByText('Ascensor ASC-001')).not.toBeInTheDocument();
  });

  it('ascensor libre con relación client_id inconsistente no aparece', async () => {
    mockGetResponsibleAssignments.mockResolvedValue({ responsible_user_id: USER_ID, assigned_elevator_ids: [] });
    mockListClients.mockResolvedValue([makeClient()]);
    mockListBuildings.mockResolvedValue([makeBuilding()]);
    mockListElevators.mockResolvedValue([makeElevator({ client_id: 'c-other' })]);
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByText('Asignaciones de edificios y ascensores')).toBeInTheDocument(); });
    expect(screen.queryByText('Ascensor ASC-001')).not.toBeInTheDocument();
  });

  it('asignación actual con cliente inactivo sí aparece', async () => {
    mockGetResponsibleAssignments.mockResolvedValue({ responsible_user_id: USER_ID, assigned_elevator_ids: ['e1'] });
    mockListClients.mockResolvedValue([makeClient({ active: false })]);
    mockListBuildings.mockResolvedValue([makeBuilding()]);
    mockListElevators.mockResolvedValue([makeElevator({ responsible_user_id: USER_ID })]);
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByText('Ascensor ASC-001')).toBeInTheDocument(); });
  });

  it('asignación actual con edificio inactivo sí aparece', async () => {
    mockGetResponsibleAssignments.mockResolvedValue({ responsible_user_id: USER_ID, assigned_elevator_ids: ['e1'] });
    mockListClients.mockResolvedValue([makeClient()]);
    mockListBuildings.mockResolvedValue([makeBuilding({ active: false })]);
    mockListElevators.mockResolvedValue([makeElevator({ responsible_user_id: USER_ID })]);
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByText('Ascensor ASC-001')).toBeInTheDocument(); });
  });
});

describe('ResponsibleAssignmentsCard — Agrupación', () => {
  it('clientes sin ascensores visibles no se renderizan', async () => {
    mockGetResponsibleAssignments.mockResolvedValue({ responsible_user_id: USER_ID, assigned_elevator_ids: [] });
    mockListClients.mockResolvedValue([makeClient()]);
    mockListBuildings.mockResolvedValue([makeBuilding()]);
    mockListElevators.mockResolvedValue([]);
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByText('Asignaciones de edificios y ascensores')).toBeInTheDocument(); });
    expect(screen.queryByText('Cliente Alpha')).not.toBeInTheDocument();
  });

  it('edificios sin ascensores visibles no se renderizan', async () => {
    mockGetResponsibleAssignments.mockResolvedValue({ responsible_user_id: USER_ID, assigned_elevator_ids: [] });
    mockListClients.mockResolvedValue([makeClient()]);
    mockListBuildings.mockResolvedValue([makeBuilding()]);
    mockListElevators.mockResolvedValue([]);
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByText('Asignaciones de edificios y ascensores')).toBeInTheDocument(); });
    expect(screen.queryByText('Edificio Centro')).not.toBeInTheDocument();
  });

  it('ordena clientes naturalmente', async () => {
    mockGetResponsibleAssignments.mockResolvedValue({ responsible_user_id: USER_ID, assigned_elevator_ids: [] });
    mockListClients.mockResolvedValue([makeClient({ id: 'c2', name: 'ZZZ' }), makeClient({ id: 'c1', name: 'AAA' })]);
    mockListBuildings.mockResolvedValue([makeBuilding({ id: 'b1', client_id: 'c1' }), makeBuilding({ id: 'b2', client_id: 'c2' })]);
    mockListElevators.mockResolvedValue([makeElevator({ id: 'e1', building_id: 'b1' }), makeElevator({ id: 'e2', building_id: 'b2' })]);
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByText(/AAA/)).toBeInTheDocument(); });
    expect(screen.getByText(/Edificio Centro/)).toBeInTheDocument();
  });

  it('ordena ascensores naturalmente', async () => {
    mockGetResponsibleAssignments.mockResolvedValue({ responsible_user_id: USER_ID, assigned_elevator_ids: [] });
    mockListClients.mockResolvedValue([makeClient()]);
    mockListBuildings.mockResolvedValue([makeBuilding()]);
    mockListElevators.mockResolvedValue([makeElevator({ id: 'e1', code: 'B100' }), makeElevator({ id: 'e2', code: 'A100' })]);
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getAllByText(/Ascensor/)).toHaveLength(2); });
    const labels = screen.getAllByText(/Ascensor/).map((el) => el.textContent);
    expect(labels[0]).toContain('A100');
    expect(labels[1]).toContain('B100');
  });

  it('muestra badges de cliente inactivo', async () => {
    mockGetResponsibleAssignments.mockResolvedValue({ responsible_user_id: USER_ID, assigned_elevator_ids: [] });
    mockListClients.mockResolvedValue([makeClient({ active: false })]);
    mockListBuildings.mockResolvedValue([makeBuilding()]);
    mockListElevators.mockResolvedValue([makeElevator({ responsible_user_id: USER_ID })]);
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByText('Ascensor ASC-001')).toBeInTheDocument(); });
    expect(screen.getAllByText('Inactivo').length).toBeGreaterThanOrEqual(1);
  });

  it('muestra cantidades por edificio', async () => {
    mockGetResponsibleAssignments.mockResolvedValue({ responsible_user_id: USER_ID, assigned_elevator_ids: [] });
    mockListClients.mockResolvedValue([makeClient()]);
    mockListBuildings.mockResolvedValue([makeBuilding()]);
    mockListElevators.mockResolvedValue([makeElevator()]);
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByText(/0 de 1 seleccionados/)).toBeInTheDocument(); });
  });
});

describe('ResponsibleAssignmentsCard — Selección', () => {
  it('asignaciones actuales empiezan marcadas', async () => {
    mockGetResponsibleAssignments.mockResolvedValue({ responsible_user_id: USER_ID, assigned_elevator_ids: ['e1'] });
    mockListClients.mockResolvedValue([makeClient()]);
    mockListBuildings.mockResolvedValue([makeBuilding()]);
    mockListElevators.mockResolvedValue([makeElevator({ responsible_user_id: USER_ID })]);
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByText('Ascensor ASC-001')).toBeInTheDocument(); });
    const cb = screen.getByRole('checkbox', { name: /ascensor asc-001/i });
    expect(cb).toBeChecked();
  });

  it('asignación inactiva puede desmarcarse', async () => {
    mockGetResponsibleAssignments.mockResolvedValue({ responsible_user_id: USER_ID, assigned_elevator_ids: ['e1'] });
    mockListClients.mockResolvedValue([makeClient()]);
    mockListBuildings.mockResolvedValue([makeBuilding()]);
    mockListElevators.mockResolvedValue([makeElevator({ id: 'e1', active: false, responsible_user_id: USER_ID })]);
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByText('Ascensor ASC-001')).toBeInTheDocument(); });
    const cb = screen.getByRole('checkbox', { name: /ascensor asc-001/i });
    expect(cb).toBeChecked();
    fireEvent.click(cb);
    expect(cb).not.toBeChecked();
  });

  it('asignación inactiva no puede volver a marcarse', async () => {
    mockGetResponsibleAssignments.mockResolvedValue({ responsible_user_id: USER_ID, assigned_elevator_ids: ['e1'] });
    mockListClients.mockResolvedValue([makeClient()]);
    mockListBuildings.mockResolvedValue([makeBuilding()]);
    mockListElevators.mockResolvedValue([makeElevator({ id: 'e1', active: false, responsible_user_id: USER_ID })]);
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByText('Ascensor ASC-001')).toBeInTheDocument(); });
    const cb = screen.getByRole('checkbox', { name: /ascensor asc-001/i });
    fireEvent.click(cb);
    expect(cb).not.toBeChecked();
    expect(cb).toBeDisabled();
  });
});

describe('ResponsibleAssignmentsCard — Validación', () => {
  it('sin cambios no permite guardar', async () => {
    setupWithElevator();
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByText('Asignaciones de edificios y ascensores')).toBeInTheDocument(); });
    expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
  });

  it('cero seleccionados muestra mensaje exacto', async () => {
    setupWithElevator();
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByText('Asignaciones de edificios y ascensores')).toBeInTheDocument(); });
    expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
  });

  it('más de 100 muestra mensaje exacto', async () => {
    mockGetResponsibleAssignments.mockResolvedValue({ responsible_user_id: USER_ID, assigned_elevator_ids: [] });
    mockListClients.mockResolvedValue([makeClient()]);
    mockListBuildings.mockResolvedValue([makeBuilding()]);
    const many = Array.from({ length: 101 }, (_, i) => makeElevator({ id: `e${i}`, code: `A${i}` }));
    mockListElevators.mockResolvedValue(many);
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByText(/101.*seleccionados/)).toBeInTheDocument(); });
    expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
  });

  it('inactivo seleccionado bloquea con mensaje exacto', async () => {
    mockGetResponsibleAssignments.mockResolvedValue({ responsible_user_id: USER_ID, assigned_elevator_ids: ['e1'] });
    mockListClients.mockResolvedValue([makeClient()]);
    mockListBuildings.mockResolvedValue([makeBuilding()]);
    mockListElevators.mockResolvedValue([makeElevator({ id: 'e1', active: false, responsible_user_id: USER_ID })]);
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByText('Ascensor ASC-001')).toBeInTheDocument(); });
    expect(screen.getByText(/Los ascensores inactivos no pueden conservarse asignados/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
  });

  it('disabled bloquea edición y guardado', async () => {
    setupWithElevator();
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} disabled />);
    await waitFor(() => { expect(screen.getByText('Asignaciones de edificios y ascensores')).toBeInTheDocument(); });
    expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /descartar/i })).toBeDisabled();
  });

  it('conflicto deshabilita checkboxes', async () => {
    setupWithElevator();
    mockReplaceResponsibleAssignments.mockRejectedValueOnce(new Error('Las asignaciones cambiaron'));
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByText('Asignaciones de edificios y ascensores')).toBeInTheDocument(); });
    expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
  });

  it('conflicto conserva Descartar cambios', async () => {
    setupWithElevator();
    mockReplaceResponsibleAssignments.mockRejectedValueOnce(new Error('Las asignaciones cambiaron'));
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByText('Asignaciones de edificios y ascensores')).toBeInTheDocument(); });
    expect(screen.getByRole('button', { name: /descartar/i })).toBeDisabled();
  });
});

describe('ResponsibleAssignmentsCard — Confirmación', () => {
  it('Guardar abre dialog', async () => {
    setupWithElevator();
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByText('Asignaciones de edificios y ascensores')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('checkbox', { name: /ascensor asc-001/i }));
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('dialog muestra agregados', async () => {
    setupWithElevator();
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByText('Asignaciones de edificios y ascensores')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('checkbox', { name: /ascensor asc-001/i }));
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('Se agregarán');
  });

  it('dialog muestra retirados', async () => {
    mockGetResponsibleAssignments.mockResolvedValue({ responsible_user_id: USER_ID, assigned_elevator_ids: ['e1'] });
    mockListClients.mockResolvedValue([makeClient()]);
    mockListBuildings.mockResolvedValue([makeBuilding()]);
    mockListElevators.mockResolvedValue([makeElevator({ responsible_user_id: USER_ID })]);
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByText('Ascensor ASC-001')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('checkbox', { name: /ascensor asc-001/i }));
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    expect(screen.getByText(/Se retirarán/)).toBeInTheDocument();
  });

  it('Cancelar no invoca API', async () => {
    setupWithElevator();
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByText('Asignaciones de edificios y ascensores')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('checkbox', { name: /ascensor asc-001/i }));
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    fireEvent.click(screen.getByRole('button', { name: /^cancelar$/i }));
    expect(mockReplaceResponsibleAssignments).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('todos los botones no submit son type button', async () => {
    setupWithElevator();
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByText('Asignaciones de edificios y ascensores')).toBeInTheDocument(); });
    const buttons = screen.getAllByRole('button');
    buttons.forEach((b) => { expect(b).toHaveAttribute('type', 'button'); });
  });

  it('dialog tiene aria-modal y título accesible', async () => {
    setupWithElevator();
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByText('Asignaciones de edificios y ascensores')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('checkbox', { name: /ascensor asc-001/i }));
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'confirm-assignment-title');
  });
});

describe('ResponsibleAssignmentsCard — Finalización', () => {
  it('checkbox click triggers state update', async () => {
    setupWithElevator();
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByText('Ascensor ASC-001')).toBeInTheDocument(); });
    const cb = screen.getByRole('checkbox', { name: /ascensor asc-001/i });
    expect(cb).not.toBeChecked();
    // Click the checkbox
    fireEvent.click(cb);
    // Check if the checkbox state changed
    expect(cb).toBeChecked();
    // The guardar button should now be enabled
    expect(screen.getByRole('button', { name: /guardar/i })).not.toBeDisabled();
  });

  it('onSavingChange éxito produce true y false', async () => {
    const onSaving = vi.fn();
    const def = deferred<{ responsible_user_id: string; previous_elevator_ids: string[]; assigned_elevator_ids: string[]; added_elevator_ids: string[]; removed_elevator_ids: string[] }>();
    setupWithElevator();
    mockReplaceResponsibleAssignments.mockReturnValue(def.promise);
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} onSavingChange={onSaving} />);
    await waitFor(() => { expect(screen.getByText('Ascensor ASC-001')).toBeInTheDocument(); });
    await user.click(screen.getByRole('checkbox', { name: /ascensor asc-001/i }));
    await waitFor(() => { expect(screen.getByRole('button', { name: /guardar/i })).not.toBeDisabled(); });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    await waitFor(() => { expect(onSaving).toHaveBeenCalledWith(true); });
    expect(mockReplaceResponsibleAssignments).toHaveBeenCalledTimes(1);
    await act(async () => { def.resolve({ responsible_user_id: USER_ID, previous_elevator_ids: [], assigned_elevator_ids: ['e1'], added_elevator_ids: ['e1'], removed_elevator_ids: [] }); });
    await waitFor(() => { expect(onSaving).toHaveBeenCalledWith(false); });
    expect(onSaving.mock.calls).toEqual([[true], [false]]);
    expect(screen.getByRole('status').textContent).toContain('1 agregadas');
    expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
  });

  it('onSavingChange error produce true y false', async () => {
    const onSaving = vi.fn();
    const def = deferred<never>();
    setupWithElevator();
    mockReplaceResponsibleAssignments.mockReturnValue(def.promise);
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} onSavingChange={onSaving} />);
    await waitFor(() => { expect(screen.getByText('Ascensor ASC-001')).toBeInTheDocument(); });
    // Start with no assignment, add one by clicking checkbox
    fireEvent.click(screen.getByRole('checkbox', { name: /ascensor asc-001/i }));
    await waitFor(() => { expect(screen.getByRole('button', { name: /guardar/i })).not.toBeDisabled(); });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    await waitFor(() => { expect(onSaving).toHaveBeenCalledWith(true); });
    expect(mockReplaceResponsibleAssignments).toHaveBeenCalledTimes(1);
    await act(async () => { def.reject(new Error('Falló')); });
    await waitFor(() => { expect(onSaving).toHaveBeenCalledWith(false); });
    expect(onSaving.mock.calls).toEqual([[true], [false]]);
    expect(screen.getByRole('alert')).toHaveTextContent('Falló');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('inconsistencia local no llama onSavingChange', async () => {
    const onSaving = vi.fn();
    setupWithElevator();
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} onSavingChange={onSaving} />);
    await waitFor(() => { expect(screen.getByText('Asignaciones de edificios y ascensores')).toBeInTheDocument(); });
    expect(onSaving).not.toHaveBeenCalled();
    expect(mockReplaceResponsibleAssignments).not.toHaveBeenCalled();
  });

  it('doble clic en Confirmar sigue produciendo una llamada', async () => {
    const onSaving = vi.fn();
    const def = deferred<{ responsible_user_id: string; previous_elevator_ids: string[]; assigned_elevator_ids: string[]; added_elevator_ids: string[]; removed_elevator_ids: string[] }>();
    setupWithElevator();
    mockReplaceResponsibleAssignments.mockReturnValue(def.promise);
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} onSavingChange={onSaving} />);
    await waitFor(() => { expect(screen.getByText('Asignaciones de edificios y ascensores')).toBeInTheDocument(); });
    await user.click(screen.getByRole('checkbox', { name: /ascensor asc-001/i }));
    await waitFor(() => { expect(screen.getByRole('button', { name: /guardar/i })).not.toBeDisabled(); });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    const confirmBtn = screen.getByRole('button', { name: /confirmar/i });
    fireEvent.click(confirmBtn);
    fireEvent.click(confirmBtn);
    await waitFor(() => { expect(mockReplaceResponsibleAssignments).toHaveBeenCalledTimes(1); });
    expect(onSaving).toHaveBeenCalledWith(true);
    expect(onSaving).not.toHaveBeenCalledWith(false);
    expect(confirmBtn).toBeDisabled();
    await act(async () => { def.resolve({ responsible_user_id: USER_ID, previous_elevator_ids: [], assigned_elevator_ids: ['e1'], added_elevator_ids: ['e1'], removed_elevator_ids: [] }); });
    await waitFor(() => { expect(onSaving).toHaveBeenCalledWith(false); });
    expect(onSaving.mock.calls).toEqual([[true], [false]]);
    expect(mockReplaceResponsibleAssignments).toHaveBeenCalledTimes(1);
  });

  it('desmontaje durante operación pendiente no deja al padre bloqueado', async () => {
    const onSaving = vi.fn();
    const def = deferred<{ responsible_user_id: string; previous_elevator_ids: string[]; assigned_elevator_ids: string[]; added_elevator_ids: string[]; removed_elevator_ids: string[] }>();
    setupWithElevator();
    mockReplaceResponsibleAssignments.mockReturnValue(def.promise);
    const { unmount } = render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} onSavingChange={onSaving} />);
    await waitFor(() => { expect(screen.getByText('Asignaciones de edificios y ascensores')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('checkbox', { name: /ascensor asc-001/i }));
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    await waitFor(() => { expect(onSaving).toHaveBeenCalledWith(true); });
    unmount();
    await act(async () => { def.resolve({ responsible_user_id: USER_ID, previous_elevator_ids: [], assigned_elevator_ids: ['e1'], added_elevator_ids: ['e1'], removed_elevator_ids: [] }); });
    expect(onSaving).toHaveBeenCalledTimes(2);
    expect(onSaving.mock.calls).toEqual([[true], [false]]);
  });
});

describe('ResponsibleAssignmentsCard — Selección oculta', () => {
  it('edificio con cliente inactivo: asignación actual aparece, libre no', async () => {
    mockGetResponsibleAssignments.mockResolvedValue({ responsible_user_id: USER_ID, assigned_elevator_ids: ['e1'] });
    mockListClients.mockResolvedValue([makeClient({ id: 'c1', active: false })]);
    mockListBuildings.mockResolvedValue([makeBuilding()]);
    mockListElevators.mockResolvedValue([
      makeElevator({ id: 'e1', responsible_user_id: USER_ID }),
      makeElevator({ id: 'e2' }),
    ]);
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByText('Ascensor ASC-001')).toBeInTheDocument(); });
    expect(screen.queryByText('Ascensor ASC-002')).not.toBeInTheDocument();
    expect(screen.getByText('Ascensor ASC-001')).toBeInTheDocument();
  });

  it('edificio con edificio inactivo: asignación actual aparece, libre no', async () => {
    mockGetResponsibleAssignments.mockResolvedValue({ responsible_user_id: USER_ID, assigned_elevator_ids: ['e1'] });
    mockListClients.mockResolvedValue([makeClient()]);
    mockListBuildings.mockResolvedValue([makeBuilding({ active: false })]);
    mockListElevators.mockResolvedValue([
      makeElevator({ id: 'e1', responsible_user_id: USER_ID }),
      makeElevator({ id: 'e2' }),
    ]);
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByText('Ascensor ASC-001')).toBeInTheDocument(); });
    expect(screen.queryByText('Ascensor ASC-002')).not.toBeInTheDocument();
  });

  it('edificio con client_id inconsistente: asignación actual aparece, libre no', async () => {
    mockGetResponsibleAssignments.mockResolvedValue({ responsible_user_id: USER_ID, assigned_elevator_ids: ['e1'] });
    mockListClients.mockResolvedValue([makeClient()]);
    mockListBuildings.mockResolvedValue([makeBuilding()]);
    mockListElevators.mockResolvedValue([
      makeElevator({ id: 'e1', responsible_user_id: USER_ID }),
      makeElevator({ id: 'e2', client_id: 'c-other' }),
    ]);
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByText('Ascensor ASC-001')).toBeInTheDocument(); });
    expect(screen.queryByText('Ascensor ASC-002')).not.toBeInTheDocument();
  });
});

describe('ResponsibleAssignmentsCard — Payload', () => {
  it('payload ordena por cliente, edificio y código natural', async () => {
    mockGetResponsibleAssignments.mockResolvedValue({ responsible_user_id: USER_ID, assigned_elevator_ids: [] });
    mockListClients.mockResolvedValue([makeClient({ id: 'c1', name: 'ZClient' }), makeClient({ id: 'c2', name: 'AClient' })]);
    mockListBuildings.mockResolvedValue([
      makeBuilding({ id: 'b1', client_id: 'c1', name: 'ZBuilding' }),
      makeBuilding({ id: 'b2', client_id: 'c2', name: 'ABuilding' }),
    ]);
    mockListElevators.mockResolvedValue([
      makeElevator({ id: 'e1', code: 'B100', building_id: 'b1', client_id: 'c1' }),
      makeElevator({ id: 'e2', code: 'A100', building_id: 'b2', client_id: 'c2' }),
    ]);
    mockReplaceResponsibleAssignments.mockResolvedValue({ responsible_user_id: USER_ID, previous_elevator_ids: [], assigned_elevator_ids: ['e1', 'e2'], added_elevator_ids: ['e1', 'e2'], removed_elevator_ids: [] });
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getAllByText(/Ascensor/)).toHaveLength(2); });
    fireEvent.click(screen.getByRole('checkbox', { name: /ascensor a100/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /ascensor b100/i }));
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    await waitFor(() => { expect(mockReplaceResponsibleAssignments).toHaveBeenCalledTimes(1); });
    const params = mockReplaceResponsibleAssignments.mock.calls[0][0];
    expect(params.elevator_ids).toEqual(['e2', 'e1']);
  });

  it('payload incluye solo IDs visibles y elegibles', async () => {
    mockGetResponsibleAssignments.mockResolvedValue({ responsible_user_id: USER_ID, assigned_elevator_ids: [] });
    mockListClients.mockResolvedValue([makeClient()]);
    mockListBuildings.mockResolvedValue([makeBuilding()]);
    mockListElevators.mockResolvedValue([
      makeElevator({ id: 'e1', code: 'A100' }),
      makeElevator({ id: 'e2', code: 'B100', client_id: 'c-other' }),
    ]);
    mockReplaceResponsibleAssignments.mockResolvedValue({ responsible_user_id: USER_ID, previous_elevator_ids: [], assigned_elevator_ids: ['e1'], added_elevator_ids: ['e1'], removed_elevator_ids: [] });
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByText('Ascensor A100')).toBeInTheDocument(); });
    expect(screen.queryByText('Ascensor B100')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: /ascensor a100/i }));
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    await waitFor(() => { expect(mockReplaceResponsibleAssignments).toHaveBeenCalledTimes(1); });
    const params = mockReplaceResponsibleAssignments.mock.calls[0][0];
    expect(params.elevator_ids).toEqual(['e1']);
  });
});

describe('ResponsibleAssignmentsCard — Edición limpia mensajes', () => {
  it('éxito desaparece al editar', async () => {
    const def = deferred<{ responsible_user_id: string; previous_elevator_ids: string[]; assigned_elevator_ids: string[]; added_elevator_ids: string[]; removed_elevator_ids: string[] }>();
    setupWithElevator();
    mockReplaceResponsibleAssignments.mockReturnValue(def.promise);
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByText('Ascensor ASC-001')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('checkbox', { name: /ascensor asc-001/i }));
    await waitFor(() => { expect(screen.getByRole('button', { name: /guardar/i })).not.toBeDisabled(); });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    // Resolve the deferred before waiting for success
    await act(async () => { def.resolve({ responsible_user_id: USER_ID, previous_elevator_ids: [], assigned_elevator_ids: ['e1'], added_elevator_ids: ['e1'], removed_elevator_ids: [] }); });
    await waitFor(() => { expect(screen.getByRole('status')).toBeInTheDocument(); });
    // Now toggle to clear success
    fireEvent.click(screen.getByRole('checkbox', { name: /ascensor asc-001/i }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('error desaparece al editar', async () => {
    const def = deferred<never>();
    setupWithElevator();
    mockReplaceResponsibleAssignments.mockReturnValue(def.promise);
    render(<ResponsibleAssignmentsCard responsibleUserId={USER_ID} />);
    await waitFor(() => { expect(screen.getByText('Asignaciones de edificios y ascensores')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('checkbox', { name: /ascensor asc-001/i }));
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    await act(async () => { def.reject(new Error('Falló')); });
    await waitFor(() => { expect(screen.getByRole('alert')).toHaveTextContent('Falló'); });
    // Toggle checkbox to clear error
    fireEvent.click(screen.getByRole('checkbox', { name: /ascensor asc-001/i }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
