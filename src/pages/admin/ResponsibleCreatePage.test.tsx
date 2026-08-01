import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ResponsibleCreatePage from './ResponsibleCreatePage';

const { mockListClients, mockGetBuildingsByClient, mockFilterElevators, mockCreateResponsible, mockNavigate } = vi.hoisted(() => ({
  mockListClients: vi.fn(),
  mockGetBuildingsByClient: vi.fn(),
  mockFilterElevators: vi.fn(),
  mockCreateResponsible: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock('@/services/adminUsers.service', () => ({
  createResponsible: (...args: unknown[]) => mockCreateResponsible(...args),
  getAdminUsersErrorMessage: (e: unknown) => e instanceof Error ? e.message : 'Error',
}));

vi.mock('@/services/clients.service', () => ({
  listClients: (...args: unknown[]) => mockListClients(...args),
}));

vi.mock('@/services/buildings.service', () => ({
  getBuildingsByClient: (...args: unknown[]) => mockGetBuildingsByClient(...args),
}));

vi.mock('@/services/elevators.service', () => ({
  filterElevators: (...args: unknown[]) => mockFilterElevators(...args),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'admin1' },
    profile: { id: 'admin1', full_name: 'Admin', role: 'admin', email: 'a@a.com', active: true, created_at: '', updated_at: '' },
    logout: () => Promise.resolve(), login: () => Promise.resolve({ error: null }),
    getRedirectPath: () => '/', hasRole: () => true, isAdmin: true, isTechnician: false,
    isSupervisor: false, isResponsible: false, isAuthenticated: true, loading: false, error: null,
  })),
}));

vi.mock('@/components/layout/Sidebar', () => ({ default: vi.fn(() => <div data-testid="sidebar" />) }));

interface Deferred<T> { promise: Promise<T>; resolve: (value: T) => void; }
function deferred<T>(): Deferred<T> { let resolve!: (value: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; }

function makeClient(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1', code: 'C001', name: 'Cliente Alpha', active: true,
    created_at: '', updated_at: '', ...overrides,
  };
}

function makeBuilding(overrides: Record<string, unknown> = {}) {
  return {
    id: 'b1', client_id: 'c1', code: 'B001', name: 'Edificio Centro', address: 'Av. Principal 100',
    locality: 'Neuquén', province: 'Neuquén', active: true,
    created_at: '', updated_at: '', ...overrides,
  };
}

function makeElevator(overrides: Record<string, unknown> = {}) {
  return {
    id: 'e1', code: 'ASC-001', qr_token: 'tok', building_id: 'b1', client_id: 'c1',
    operational_status: 'operativo', conservation_status: 'conforme', contractual_status: 'activo',
    active: true, created_at: '', updated_at: '', ...overrides,
  };
}

let user: ReturnType<typeof userEvent.setup>;

function renderPage() {
  return render(<MemoryRouter initialEntries={['/admin/usuarios/responsables/nuevo']}><ResponsibleCreatePage /></MemoryRouter>);
}

function waitForReady() {
  return waitFor(() => { expect(screen.getAllByRole('heading', { name: /nuevo responsable/i }).length).toBeGreaterThanOrEqual(1); });
}

async function selectClient(cid: string) {
  fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: cid } });
  await waitFor(() => { expect(screen.getByText('Edificio Centro')).toBeInTheDocument(); });
}

async function toggleBuilding() {
  await user.click(screen.getByRole('checkbox', { name: /edificio centro/i }));
}

async function toggleElevator(name: RegExp) {
  await user.click(screen.getByRole('checkbox', { name }));
}

function getForm(): HTMLFormElement {
  const form = document.querySelector('form');
  if (!(form instanceof HTMLFormElement)) throw new Error('No se encontró el formulario');
  return form;
}

function fillPersonal(name: string, email: string, pw: string) {
  fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: name } });
  fireEvent.change(screen.getByLabelText(/email \*/i), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/contraseña temporal/i), { target: { value: pw } });
  fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), { target: { value: pw } });
}

beforeEach(() => { vi.clearAllMocks(); user = userEvent.setup(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('ResponsibleCreatePage — Renderizado', () => {
  it('muestra título y descripción', async () => {
    mockListClients.mockResolvedValue([]);
    renderPage();
    await waitForReady();
    expect(screen.getByText(/Creá el acceso y asigná los ascensores/i)).toBeInTheDocument();
  });

  it('muestra cuatro campos personales', async () => {
    mockListClients.mockResolvedValue([]);
    renderPage();
    await waitFor(() => { expect(screen.getByLabelText(/nombre completo/i)).toBeInTheDocument(); });
    expect(screen.getByLabelText(/email \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña temporal/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirmar contraseña/i)).toBeInTheDocument();
  });

  it('muestra aviso de contraseña temporal', async () => {
    mockListClients.mockResolvedValue([]);
    renderPage();
    await waitFor(() => { expect(screen.getByText(/contraseña es temporal/i)).toBeInTheDocument(); });
  });

  it('Volver y Cancelar apuntan a tab responsables', async () => {
    mockListClients.mockResolvedValue([]);
    renderPage();
    await waitForReady();
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/usuarios?tab=responsables');
  });

  it('la contraseña no aparece en el resumen', async () => {
    mockListClients.mockResolvedValue([makeClient()]);
    mockGetBuildingsByClient.mockResolvedValue([makeBuilding()]);
    mockFilterElevators.mockResolvedValue([makeElevator()]);
    renderPage();
    await waitFor(() => { expect(screen.getByText('Cliente Alpha')).toBeInTheDocument(); });
    fireEvent.change(screen.getByLabelText(/contraseña temporal/i), { target: { value: 'Secret123!' } });
    expect(screen.queryByText('Secret123!')).not.toBeInTheDocument();
  });
});

describe('ResponsibleCreatePage — Clientes', () => {
  it('listClients se llama una sola vez', async () => {
    mockListClients.mockResolvedValue([]);
    renderPage();
    await waitFor(() => { expect(mockListClients).toHaveBeenCalledTimes(1); });
  });

  it('muestra solo clientes activos', async () => {
    mockListClients.mockResolvedValue([makeClient({ id: 'c1', name: 'Activo' }), makeClient({ id: 'c2', name: 'Inactivo', active: false })]);
    renderPage();
    await waitFor(() => { expect(screen.getByText('Activo')).toBeInTheDocument(); });
    expect(screen.queryByText('Inactivo')).not.toBeInTheDocument();
  });

  it('cliente inactivo no aparece', async () => {
    mockListClients.mockResolvedValue([makeClient({ active: false })]);
    renderPage();
    await waitFor(() => { expect(screen.getByText('No hay clientes activos disponibles.')).toBeInTheDocument(); });
  });

  it('error de clientes permite reintentar', async () => {
    mockListClients.mockRejectedValueOnce(new Error('Falló'));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Falló')).toBeInTheDocument(); });
    expect(screen.getByRole('button', { name: /reintentar carga de clientes/i })).toBeInTheDocument();
    mockListClients.mockResolvedValue([makeClient()]);
    fireEvent.click(screen.getByRole('button', { name: /reintentar carga de clientes/i }));
    await waitFor(() => { expect(screen.getByText('Cliente Alpha')).toBeInTheDocument(); });
  });

  it('ausencia de clientes activos muestra estado vacío', async () => {
    mockListClients.mockResolvedValue([]);
    renderPage();
    await waitFor(() => { expect(screen.getByText('No hay clientes activos disponibles.')).toBeInTheDocument(); });
  });
});

describe('ResponsibleCreatePage — Carga por cliente', () => {
  it('seleccionar cliente llama getBuildingsByClient', async () => {
    mockListClients.mockResolvedValue([makeClient()]);
    mockGetBuildingsByClient.mockResolvedValue([]);
    mockFilterElevators.mockResolvedValue([]);
    renderPage();
    await waitFor(() => { expect(screen.getByText('Cliente Alpha')).toBeInTheDocument(); });
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } });
    await waitFor(() => { expect(mockGetBuildingsByClient).toHaveBeenCalledWith('c1'); });
  });

  it('llama filterElevators con client_id', async () => {
    mockListClients.mockResolvedValue([makeClient()]);
    mockGetBuildingsByClient.mockResolvedValue([]);
    mockFilterElevators.mockResolvedValue([]);
    renderPage();
    await waitFor(() => { expect(screen.getByText('Cliente Alpha')).toBeInTheDocument(); });
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } });
    await waitFor(() => { expect(mockFilterElevators).toHaveBeenCalledWith({ client_id: 'c1' }); });
  });

  it('ambas llamadas se realizan una vez', async () => {
    mockListClients.mockResolvedValue([makeClient()]);
    mockGetBuildingsByClient.mockResolvedValue([makeBuilding()]);
    mockFilterElevators.mockResolvedValue([makeElevator()]);
    renderPage();
    await waitFor(() => { expect(screen.getByText('Cliente Alpha')).toBeInTheDocument(); });
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } });
    await waitFor(() => {
      expect(mockGetBuildingsByClient).toHaveBeenCalledTimes(1);
      expect(mockFilterElevators).toHaveBeenCalledTimes(1);
    });
  });

  it('cambiar cliente limpia selección', async () => {
    mockListClients.mockResolvedValue([makeClient({ id: 'c1', name: 'A' }), makeClient({ id: 'c2', name: 'B' })]);
    mockGetBuildingsByClient.mockResolvedValueOnce([makeBuilding({ id: 'b1', name: 'Edificio 1' })]);
    mockFilterElevators.mockResolvedValueOnce([makeElevator({ id: 'e1' })]);
    renderPage();
    await waitFor(() => { expect(screen.getByText('A')).toBeInTheDocument(); });
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Edificio 1')).toBeInTheDocument(); });
    mockGetBuildingsByClient.mockResolvedValueOnce([makeBuilding({ id: 'b2', name: 'Edificio 2' })]);
    mockFilterElevators.mockResolvedValueOnce([makeElevator({ id: 'e2', building_id: 'b2' })]);
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c2' } });
    await waitFor(() => { expect(screen.getByText('Edificio 2')).toBeInTheDocument(); });
    expect(screen.queryByText('Edificio 1')).not.toBeInTheDocument();
  });

  it('respuesta vieja no sobrescribe cliente nuevo', async () => {
    mockListClients.mockResolvedValue([makeClient({ id: 'c1', name: 'A' }), makeClient({ id: 'c2', name: 'B' })]);
    const def1 = deferred<void>();
    const def2 = deferred<void>();
    mockGetBuildingsByClient.mockImplementationOnce(() => { def1.resolve(); return new Promise(() => {}); });
    mockFilterElevators.mockImplementationOnce(() => new Promise(() => {}));
    renderPage();
    await waitFor(() => { expect(screen.getByText('A')).toBeInTheDocument(); });
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } });
    await act(async () => { def1.resolve(); });
    mockGetBuildingsByClient.mockResolvedValueOnce([makeBuilding({ id: 'b2', name: 'Edificio 2' })]);
    mockFilterElevators.mockResolvedValueOnce([makeElevator({ id: 'e2', building_id: 'b2' })]);
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c2' } });
    await waitFor(() => { expect(screen.getByText('Edificio 2')).toBeInTheDocument(); });
  });

  it('error permite reintentar', async () => {
    mockListClients.mockResolvedValue([makeClient()]);
    mockGetBuildingsByClient.mockRejectedValueOnce(new Error('Falló'));
    mockFilterElevators.mockResolvedValue([]);
    renderPage();
    await waitFor(() => { expect(screen.getByText('Cliente Alpha')).toBeInTheDocument(); });
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Falló')).toBeInTheDocument(); });
    expect(screen.getByRole('button', { name: /reintentar edificios/i })).toBeInTheDocument();
  });
});

describe('ResponsibleCreatePage — Elegibilidad', () => {
  it('excluye ascensor inactivo', async () => {
    mockListClients.mockResolvedValue([makeClient()]);
    mockGetBuildingsByClient.mockResolvedValue([makeBuilding()]);
    mockFilterElevators.mockResolvedValue([makeElevator({ id: 'e1', active: false })]);
    renderPage();
    await waitForReady();
    await waitFor(() => { expect(screen.getByText('Cliente Alpha')).toBeInTheDocument(); });
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText(/No hay ascensores disponibles/)).toBeInTheDocument(); });
  });

  it('excluye ascensor con responsible_user_id', async () => {
    mockListClients.mockResolvedValue([makeClient()]);
    mockGetBuildingsByClient.mockResolvedValue([makeBuilding()]);
    mockFilterElevators.mockResolvedValue([makeElevator({ id: 'e1', responsible_user_id: 'u-existing' })]);
    renderPage();
    await waitForReady();
    await waitFor(() => { expect(screen.getByText('Cliente Alpha')).toBeInTheDocument(); });
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText(/No hay ascensores disponibles/)).toBeInTheDocument(); });
  });

  it('excluye ascensor de edificio ajeno', async () => {
    mockListClients.mockResolvedValue([makeClient()]);
    mockGetBuildingsByClient.mockResolvedValue([makeBuilding({ id: 'b1' })]);
    mockFilterElevators.mockResolvedValue([makeElevator({ id: 'e1', building_id: 'b-other' })]);
    renderPage();
    await waitForReady();
    await waitFor(() => { expect(screen.getByText('Cliente Alpha')).toBeInTheDocument(); });
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText(/No hay ascensores disponibles/)).toBeInTheDocument(); });
  });

  it('edificio sin disponibles queda deshabilitado', async () => {
    mockListClients.mockResolvedValue([makeClient()]);
    mockGetBuildingsByClient.mockResolvedValue([makeBuilding()]);
    mockFilterElevators.mockResolvedValue([]);
    renderPage();
    await waitForReady();
    await waitFor(() => { expect(screen.getByText('Cliente Alpha')).toBeInTheDocument(); });
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } });
    await waitFor(() => {
      const cb = screen.getByRole('checkbox', { name: /edificio centro/i });
      expect(cb).toBeDisabled();
    });
  });

  it('muestra estado sin ascensores disponibles', async () => {
    mockListClients.mockResolvedValue([makeClient()]);
    mockGetBuildingsByClient.mockResolvedValue([makeBuilding()]);
    mockFilterElevators.mockResolvedValue([]);
    renderPage();
    await waitForReady();
    await waitFor(() => { expect(screen.getByText('Cliente Alpha')).toBeInTheDocument(); });
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText(/No hay ascensores disponibles para asignar en este cliente/)).toBeInTheDocument(); });
  });
});

describe('ResponsibleCreatePage — Selección', () => {
  function toggle(cb: HTMLElement) {
    fireEvent.click(cb);
    fireEvent.change(cb, { target: { checked: !(cb as HTMLInputElement).checked } });
  }

  it('marcar edificio selecciona todos sus ascensores', async () => {
    mockListClients.mockResolvedValue([makeClient()]);
    mockGetBuildingsByClient.mockResolvedValue([makeBuilding()]);
    mockFilterElevators.mockResolvedValue([makeElevator({ id: 'e1', code: 'A1' }), makeElevator({ id: 'e2', code: 'A2', building_id: 'b1' })]);
    renderPage();
    await waitForReady();
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Edificio Centro')).toBeInTheDocument(); });
    toggle(screen.getByRole('checkbox', { name: /edificio centro/i }));
    await waitFor(() => { expect(screen.getByText(/2 seleccionados/)).toBeInTheDocument(); });
  });

  it('desmarcar edificio elimina todos', async () => {
    mockListClients.mockResolvedValue([makeClient()]);
    mockGetBuildingsByClient.mockResolvedValue([makeBuilding()]);
    mockFilterElevators.mockResolvedValue([makeElevator({ id: 'e1' })]);
    renderPage();
    await waitForReady();
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Edificio Centro')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('checkbox', { name: /edificio centro/i }));
    await waitFor(() => { expect(screen.getByText('Edificio Centro — 1 ascensor')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('checkbox', { name: /edificio centro/i }));
    await waitFor(() => { expect(screen.getByText('Ningún ascensor seleccionado.')).toBeInTheDocument(); });
  });

  it('permite desmarcar un ascensor individual', async () => {
    mockListClients.mockResolvedValue([makeClient()]);
    mockGetBuildingsByClient.mockResolvedValue([makeBuilding()]);
    mockFilterElevators.mockResolvedValue([makeElevator({ id: 'e1', code: 'A1' }), makeElevator({ id: 'e2', code: 'A2', building_id: 'b1' })]);
    renderPage();
    await waitForReady();
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Edificio Centro')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('checkbox', { name: /edificio centro/i }));
    await waitFor(() => { expect(screen.getByText('Edificio Centro — 2 ascensores')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('checkbox', { name: /ascensor a1/i }));
    await waitFor(() => { expect(screen.getByText('Edificio Centro — 1 ascensor')).toBeInTheDocument(); });
  });

  it('permite volver a marcarlo', async () => {
    mockListClients.mockResolvedValue([makeClient()]);
    mockGetBuildingsByClient.mockResolvedValue([makeBuilding()]);
    mockFilterElevators.mockResolvedValue([makeElevator({ id: 'e1', code: 'A1' }), makeElevator({ id: 'e2', code: 'A2', building_id: 'b1' })]);
    renderPage();
    await waitForReady();
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Edificio Centro')).toBeInTheDocument(); });
    toggle(screen.getByRole('checkbox', { name: /edificio centro/i }));
    toggle(screen.getByRole('checkbox', { name: /ascensor a1/i }));
    toggle(screen.getByRole('checkbox', { name: /ascensor a1/i }));
    await waitFor(() => { expect(screen.getByText(/2 seleccionados/)).toBeInTheDocument(); });
  });

  it('no genera ids duplicados', async () => {
    mockListClients.mockResolvedValue([makeClient()]);
    mockGetBuildingsByClient.mockResolvedValue([makeBuilding()]);
    mockFilterElevators.mockResolvedValue([makeElevator({ id: 'e1' })]);
    renderPage();
    await waitForReady();
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Edificio Centro')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('checkbox', { name: /edificio centro/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /edificio centro/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /edificio centro/i }));
    await waitFor(() => { expect(screen.getByText('Edificio Centro — 1 ascensor')).toBeInTheDocument(); });
  });

  it('cambiar cliente limpia edificios y ascensores', async () => {
    mockListClients.mockResolvedValue([makeClient({ id: 'c1', name: 'A' }), makeClient({ id: 'c2', name: 'B' })]);
    mockGetBuildingsByClient.mockResolvedValueOnce([makeBuilding()]);
    mockFilterElevators.mockResolvedValueOnce([makeElevator()]);
    renderPage();
    await waitForReady();
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Edificio Centro')).toBeInTheDocument(); });
    toggle(screen.getByRole('checkbox', { name: /edificio centro/i }));
    mockGetBuildingsByClient.mockResolvedValueOnce([]);
    mockFilterElevators.mockResolvedValueOnce([]);
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c2' } });
    await waitFor(() => { expect(screen.getByText('Ningún ascensor seleccionado.')).toBeInTheDocument(); });
  });

  it('resumen muestra cantidades correctas', async () => {
    mockListClients.mockResolvedValue([makeClient()]);
    mockGetBuildingsByClient.mockResolvedValue([makeBuilding()]);
    mockFilterElevators.mockResolvedValue([makeElevator({ id: 'e1', code: 'A1' }), makeElevator({ id: 'e2', code: 'A2', building_id: 'b1' })]);
    renderPage();
    await waitForReady();
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Edificio Centro')).toBeInTheDocument(); });
    toggle(screen.getByRole('checkbox', { name: /edificio centro/i }));
    await waitFor(() => {
      expect(screen.getByText(/1 seleccionado/)).toBeInTheDocument();
      expect(screen.getByText(/2 seleccionados/)).toBeInTheDocument();
    });
  });
});

describe('ResponsibleCreatePage — Validación', () => {
  it('nombre obligatorio', async () => {
    mockListClients.mockResolvedValue([]);
    renderPage();
    await waitForReady();
    fireEvent.submit(getForm());
    expect(screen.getByText('El nombre es obligatorio')).toBeInTheDocument();
    expect(mockCreateResponsible).not.toHaveBeenCalled();
  });

  it('email válido', async () => {
    mockListClients.mockResolvedValue([]);
    renderPage();
    await waitForReady();
    fillPersonal('Test', 'noemail', 'password1');
    fireEvent.submit(getForm());
    expect(screen.getByText('Ingresá un email válido')).toBeInTheDocument();
  });

  it('contraseña de 8 a 128', async () => {
    mockListClients.mockResolvedValue([]);
    renderPage();
    await waitForReady();
    fillPersonal('Test', 'a@b.com', '1234567');
    fireEvent.submit(getForm());
    expect(screen.getByText(/contraseña debe tener entre 8 y 128/)).toBeInTheDocument();
  });

  it('contraseñas iguales', async () => {
    mockListClients.mockResolvedValue([]);
    renderPage();
    await waitForReady();
    fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText(/email \*/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText(/contraseña temporal/i), { target: { value: 'password1' } });
    fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), { target: { value: 'password2' } });
    fireEvent.submit(getForm());
    expect(screen.getByText('Las contraseñas no coinciden')).toBeInTheDocument();
  });

  it('cliente obligatorio', async () => {
    mockListClients.mockResolvedValue([makeClient()]);
    renderPage();
    await waitFor(() => { expect(screen.getByText('Cliente Alpha')).toBeInTheDocument(); });
    fillPersonal('Test', 'a@b.com', 'password1');
    fireEvent.submit(getForm());
    expect(screen.getByText('Seleccioná un cliente')).toBeInTheDocument();
  });

  it('edificio obligatorio', async () => {
    mockListClients.mockResolvedValue([makeClient()]);
    mockGetBuildingsByClient.mockResolvedValue([makeBuilding()]);
    mockFilterElevators.mockResolvedValue([makeElevator()]);
    renderPage();
    await waitForReady();
    await waitFor(() => { expect(screen.getByText('Cliente Alpha')).toBeInTheDocument(); });
    await selectClient('c1');
    fillPersonal('Test', 'a@b.com', 'password1');
    fireEvent.submit(getForm());
    expect(screen.getByText('Seleccioná al menos un edificio')).toBeInTheDocument();
  });

  it('ascensor obligatorio', async () => {
    mockListClients.mockResolvedValue([makeClient()]);
    mockGetBuildingsByClient.mockResolvedValue([makeBuilding()]);
    mockFilterElevators.mockResolvedValue([makeElevator({ id: 'e1', code: 'A1' })]);
    renderPage();
    await waitForReady();
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Edificio Centro')).toBeInTheDocument(); });
    // Select building (auto-selects elevator), then deselect the elevator
    fireEvent.click(screen.getByRole('checkbox', { name: /edificio centro/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /ascensor a1/i }));
    fillPersonal('Test', 'a@b.com', 'password1');
    fireEvent.submit(getForm());
    expect(screen.getByText('Seleccioná al menos un ascensor')).toBeInTheDocument();
  });

  it('máximo 100', async () => {
    mockListClients.mockResolvedValue([makeClient()]);
    mockGetBuildingsByClient.mockResolvedValue([makeBuilding()]);
    const manyElevators = Array.from({ length: 101 }, (_, i) => makeElevator({ id: `e${i}`, code: `A${i}` }));
    mockFilterElevators.mockResolvedValue(manyElevators);
    renderPage();
    await waitForReady();
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Edificio Centro')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('checkbox', { name: /edificio centro/i }));
    fillPersonal('Test', 'a@b.com', 'password1');
    fireEvent.submit(getForm());
    expect(screen.getByText('No se pueden asignar más de 100 ascensores')).toBeInTheDocument();
  });

  it('los errores locales no llaman createResponsible', async () => {
    mockListClients.mockResolvedValue([]);
    renderPage();
    await waitForReady();
    fireEvent.submit(getForm());
    expect(mockCreateResponsible).not.toHaveBeenCalled();
  });
});

describe('ResponsibleCreatePage — Envío', () => {
  function setupForSubmit() {
    mockListClients.mockResolvedValue([makeClient()]);
    mockGetBuildingsByClient.mockResolvedValue([makeBuilding()]);
    mockFilterElevators.mockResolvedValue([makeElevator()]);
    renderPage();
  }

  async function prepareForm() {
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Edificio Centro')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('checkbox', { name: /edificio centro/i }));
  }

  it('normaliza nombre y email', async () => {
    mockCreateResponsible.mockResolvedValue({ user: { id: 'new-1' }, assigned_elevator_ids: ['e1'] });
    setupForSubmit();
    await waitForReady();
    await prepareForm();
    fillPersonal('  Juan Pérez  ', '  Juan@EXAMPLE.com  ', 'password1');
    fireEvent.submit(getForm());
    await waitFor(() => { expect(mockCreateResponsible).toHaveBeenCalledTimes(1); });
    const sent = mockCreateResponsible.mock.calls[0][0];
    expect(sent.full_name).toBe('Juan Pérez');
    expect(sent.email).toBe('juan@example.com');
  });

  it('preserva password exacto', async () => {
    mockCreateResponsible.mockResolvedValue({ user: { id: 'new-1' }, assigned_elevator_ids: ['e1'] });
    setupForSubmit();
    await waitForReady();
    await prepareForm();
    fillPersonal('Test', 'a@b.com', '  ClaveExacta  ');
    fireEvent.submit(getForm());
    await waitFor(() => { expect(mockCreateResponsible).toHaveBeenCalledTimes(1); });
    expect(mockCreateResponsible.mock.calls[0][0].password).toBe('  ClaveExacta  ');
  });

  it('envía únicamente los cuatro campos permitidos', async () => {
    mockCreateResponsible.mockResolvedValue({ user: { id: 'new-1' }, assigned_elevator_ids: ['e1'] });
    setupForSubmit();
    await waitForReady();
    await prepareForm();
    fillPersonal('Test', 'a@b.com', 'password1');
    fireEvent.submit(getForm());
    await waitFor(() => { expect(mockCreateResponsible).toHaveBeenCalledTimes(1); });
    expect(Object.keys(mockCreateResponsible.mock.calls[0][0]).sort()).toEqual(['elevator_ids', 'email', 'full_name', 'password']);
  });

  it('envía ids sin duplicados', async () => {
    mockCreateResponsible.mockResolvedValue({ user: { id: 'new-1' }, assigned_elevator_ids: ['e1'] });
    setupForSubmit();
    await waitForReady();
    await prepareForm();
    fillPersonal('Test', 'a@b.com', 'password1');
    fireEvent.submit(getForm());
    await waitFor(() => { expect(mockCreateResponsible).toHaveBeenCalledTimes(1); });
    const ids = mockCreateResponsible.mock.calls[0][0].elevator_ids;
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('doble submit produce una llamada', async () => {
    const def = deferred<{ user: { id: string }; assigned_elevator_ids: string[] }>();
    mockCreateResponsible.mockReturnValue(def.promise);
    setupForSubmit();
    await waitForReady();
    await prepareForm();
    fillPersonal('Test', 'a@b.com', 'password1');
    fireEvent.submit(getForm());
    fireEvent.submit(getForm());
    expect(mockCreateResponsible).toHaveBeenCalledTimes(1);
    def.resolve({ user: { id: 'new-1' }, assigned_elevator_ids: ['e1'] });
    await waitFor(() => { expect(mockNavigate).toHaveBeenCalled(); });
  });

  it('controles quedan deshabilitados', async () => {
    const def = deferred<{ user: { id: string }; assigned_elevator_ids: string[] }>();
    mockCreateResponsible.mockReturnValue(def.promise);
    setupForSubmit();
    await waitForReady();
    await prepareForm();
    fillPersonal('Test', 'a@b.com', 'password1');
    fireEvent.submit(getForm());
    await waitFor(() => {
      expect(screen.getByLabelText(/nombre completo/i)).toBeDisabled();
      expect(screen.getByLabelText(/email \*/i)).toBeDisabled();
      expect(screen.getByRole('button', { name: /cancelar/i })).toBeDisabled();
    });
    def.resolve({ user: { id: 'new-1' }, assigned_elevator_ids: ['e1'] });
    await waitFor(() => { expect(mockNavigate).toHaveBeenCalled(); });
  });

  it('muestra Creando responsable', async () => {
    const def = deferred<{ user: { id: string }; assigned_elevator_ids: string[] }>();
    mockCreateResponsible.mockReturnValue(def.promise);
    setupForSubmit();
    await waitForReady();
    await prepareForm();
    fillPersonal('Test', 'a@b.com', 'password1');
    fireEvent.submit(getForm());
    await waitFor(() => { expect(screen.getByRole('button', { name: /creando responsable/i })).toBeDisabled(); });
    def.resolve({ user: { id: 'new-1' }, assigned_elevator_ids: ['e1'] });
    await waitFor(() => { expect(mockNavigate).toHaveBeenCalled(); });
  });
});

describe('ResponsibleCreatePage — Resultado', () => {
  function setupResult() {
    mockListClients.mockResolvedValue([makeClient()]);
    mockGetBuildingsByClient.mockResolvedValue([makeBuilding()]);
    mockFilterElevators.mockResolvedValue([makeElevator()]);
  }

  async function submitForm() {
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Edificio Centro')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('checkbox', { name: /edificio centro/i }));
    fillPersonal('Test', 'a@b.com', 'password1');
    fireEvent.submit(getForm());
  }

  it('éxito usa assigned_elevator_ids', async () => {
    setupResult();
    mockCreateResponsible.mockResolvedValue({ user: { id: 'new-1' }, assigned_elevator_ids: ['e1'] });
    renderPage();
    await waitForReady();
    await submitForm();
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain('1 ascensores');
      expect(screen.getByRole('status').textContent).toContain('temporal');
    });
  });

  it('limpia ambas contraseñas', async () => {
    setupResult();
    mockCreateResponsible.mockResolvedValue({ user: { id: 'new-1' }, assigned_elevator_ids: ['e1'] });
    renderPage();
    await waitForReady();
    await submitForm();
    await waitFor(() => {
      expect(screen.getByLabelText(/contraseña temporal/i)).toHaveValue('');
      expect(screen.getByLabelText(/confirmar contraseña/i)).toHaveValue('');
    });
  });

  it('navega al detalle después de 800 ms', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      setupResult();
      mockCreateResponsible.mockResolvedValue({ user: { id: 'new-1' }, assigned_elevator_ids: ['e1'] });
      renderPage();
      await waitForReady();
      await submitForm();
      await act(async () => { vi.advanceTimersByTime(800); });
      expect(mockNavigate).toHaveBeenCalledWith('/admin/usuarios/new-1');
    } finally {
      vi.useRealTimers();
    }
  });

  it('navega una sola vez', async () => {
    setupResult();
    mockCreateResponsible.mockResolvedValue({ user: { id: 'new-1' }, assigned_elevator_ids: ['e1'] });
    renderPage();
    await waitForReady();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await submitForm();
      await act(async () => { vi.advanceTimersByTime(800); });
      expect(mockNavigate).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('desmontar cancela el timer', async () => {
    setupResult();
    mockCreateResponsible.mockResolvedValue({ user: { id: 'new-1' }, assigned_elevator_ids: ['e1'] });
    const { unmount } = renderPage();
    await waitForReady();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await submitForm();
      unmount();
      await act(async () => { vi.advanceTimersByTime(1000); });
      expect(mockNavigate).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('error conserva todos los datos', async () => {
    setupResult();
    mockCreateResponsible.mockRejectedValueOnce(new Error('RPC falló'));
    renderPage();
    await waitForReady();
    await submitForm();
    await waitFor(() => { expect(screen.getByText('RPC falló')).toBeInTheDocument(); });
    expect(screen.getByLabelText(/nombre completo/i)).toHaveValue('Test');
    expect(screen.getByLabelText(/email \*/i)).toHaveValue('a@b.com');
    expect(screen.getByLabelText(/contraseña temporal/i)).toHaveValue('password1');
    expect(screen.getByLabelText(/confirmar contraseña/i)).toHaveValue('password1');
  });

  it('error permite reintentar', async () => {
    setupResult();
    mockCreateResponsible.mockRejectedValueOnce(new Error('Falló'));
    renderPage();
    await waitForReady();
    await submitForm();
    await waitFor(() => { expect(screen.getByText('Falló')).toBeInTheDocument(); });
    mockCreateResponsible.mockResolvedValue({ user: { id: 'new-1' }, assigned_elevator_ids: ['e1'] });
    fireEvent.submit(getForm());
    await waitFor(() => { expect(mockNavigate).toHaveBeenCalled(); });
  });

  it('error no expone contraseña', async () => {
    setupResult();
    mockCreateResponsible.mockRejectedValueOnce(new Error('Falló'));
    renderPage();
    await waitForReady();
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Edificio Centro')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('checkbox', { name: /edificio centro/i }));
    fillPersonal('Test', 'a@b.com', 'SecretPass123!');
    fireEvent.submit(getForm());
    await waitFor(() => { expect(screen.getByText('Falló')).toBeInTheDocument(); });
    expect(screen.queryByText('SecretPass123!')).not.toBeInTheDocument();
  });
});

describe('ResponsibleCreatePage — Botones type button', () => {
  it('Reintentar clientes tiene type="button"', async () => {
    mockListClients.mockRejectedValueOnce(new Error('Falló'));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Falló')).toBeInTheDocument(); });
    const btn = screen.getByRole('button', { name: /reintentar carga de clientes/i });
    expect(btn).toHaveAttribute('type', 'button');
  });

  it('Reintentar asignaciones tiene type="button"', async () => {
    mockListClients.mockResolvedValue([makeClient()]);
    mockGetBuildingsByClient.mockRejectedValueOnce(new Error('Falló'));
    mockFilterElevators.mockResolvedValue([]);
    renderPage();
    await waitFor(() => { expect(screen.getByText('Cliente Alpha')).toBeInTheDocument(); });
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Falló')).toBeInTheDocument(); });
    const btn = screen.getByRole('button', { name: /reintentar edificios/i });
    expect(btn).toHaveAttribute('type', 'button');
  });

  it('click en reintentar clientes no llama createResponsible', async () => {
    mockListClients.mockRejectedValueOnce(new Error('Falló'));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Falló')).toBeInTheDocument(); });
    mockListClients.mockResolvedValue([makeClient()]);
    fireEvent.click(screen.getByRole('button', { name: /reintentar carga de clientes/i }));
    await waitFor(() => { expect(screen.getByText('Cliente Alpha')).toBeInTheDocument(); });
    expect(mockCreateResponsible).not.toHaveBeenCalled();
  });

  it('click en reintentar asignaciones no llama createResponsible', async () => {
    mockListClients.mockResolvedValue([makeClient()]);
    mockGetBuildingsByClient.mockRejectedValueOnce(new Error('Falló'));
    mockFilterElevators.mockResolvedValue([]);
    renderPage();
    await waitFor(() => { expect(screen.getByText('Cliente Alpha')).toBeInTheDocument(); });
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Falló')).toBeInTheDocument(); });
    mockGetBuildingsByClient.mockResolvedValue([makeBuilding()]);
    mockFilterElevators.mockResolvedValue([makeElevator()]);
    fireEvent.click(screen.getByRole('button', { name: /reintentar edificios/i }));
    await waitFor(() => { expect(screen.getByText('Edificio Centro')).toBeInTheDocument(); });
    expect(mockCreateResponsible).not.toHaveBeenCalled();
  });

  it('Volver tiene type="button"', async () => {
    mockListClients.mockResolvedValue([]);
    renderPage();
    await waitForReady();
    const btn = screen.getByRole('button', { name: /volver/i });
    expect(btn).toHaveAttribute('type', 'button');
  });

  it('Crear responsable es el único submit', async () => {
    mockListClients.mockResolvedValue([]);
    renderPage();
    await waitForReady();
    const submitButtons = document.querySelectorAll('button[type="submit"]');
    expect(submitButtons).toHaveLength(1);
    expect(submitButtons[0].textContent).toContain('Crear responsable');
  });
});

describe('ResponsibleCreatePage — Invalidación de respuestas', () => {
  it('volver al cliente vacío invalida la respuesta anterior', async () => {
    mockListClients.mockResolvedValue([makeClient({ id: 'c1', name: 'A' }), makeClient({ id: 'c2', name: 'B' })]);
    mockGetBuildingsByClient.mockResolvedValueOnce([makeBuilding({ id: 'b1', name: 'Edificio 1' })]);
    mockFilterElevators.mockResolvedValueOnce([makeElevator({ id: 'e1' })]);
    renderPage();
    await waitFor(() => { expect(screen.getByText('A')).toBeInTheDocument(); });
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Edificio 1')).toBeInTheDocument(); });
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: '' } });
    await waitFor(() => { expect(screen.getByText('Seleccioná un cliente para ver sus edificios.')).toBeInTheDocument(); });
    expect(screen.queryByText('Edificio 1')).not.toBeInTheDocument();
  });

  it('una respuesta vieja no vuelve a mostrar edificios', async () => {
    mockListClients.mockResolvedValue([makeClient({ id: 'c1', name: 'A' }), makeClient({ id: 'c2', name: 'B' })]);
    const def1 = deferred<void>();
    mockGetBuildingsByClient.mockImplementationOnce(() => { def1.resolve(); return new Promise(() => {}); });
    mockFilterElevators.mockImplementationOnce(() => new Promise(() => {}));
    renderPage();
    await waitFor(() => { expect(screen.getByText('A')).toBeInTheDocument(); });
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } });
    await act(async () => { def1.resolve(); });
    mockGetBuildingsByClient.mockResolvedValueOnce([makeBuilding({ id: 'b2', name: 'Edificio 2' })]);
    mockFilterElevators.mockResolvedValueOnce([makeElevator({ id: 'e2', building_id: 'b2' })]);
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c2' } });
    await waitFor(() => { expect(screen.getByText('Edificio 2')).toBeInTheDocument(); });
    expect(screen.queryByText('Edificio 1')).not.toBeInTheDocument();
  });

  it('desmontar invalida una carga pendiente', async () => {
    mockListClients.mockResolvedValue([makeClient()]);
    const def = deferred<ReturnType<typeof makeBuilding>[]>();
    mockGetBuildingsByClient.mockReturnValue(def.promise);
    mockFilterElevators.mockImplementationOnce(() => new Promise(() => {}));
    const { unmount } = renderPage();
    await waitFor(() => { expect(screen.getByText('Cliente Alpha')).toBeInTheDocument(); });
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } });
    unmount();
    def.resolve([makeBuilding({ id: 'b-late', name: 'Edificio Late' })]);
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    // Should not throw or update state after unmount
  });
});

describe('ResponsibleCreatePage — Orden elevator_ids', () => {
  it('elevator_ids se ordena por nombre de edificio y código', async () => {
    mockListClients.mockResolvedValue([makeClient()]);
    mockGetBuildingsByClient.mockResolvedValue([
      makeBuilding({ id: 'b2', name: 'Torre Norte' }),
      makeBuilding({ id: 'b1', name: 'Edificio Centro' }),
    ]);
    mockFilterElevators.mockResolvedValue([
      makeElevator({ id: 'e2', code: 'B100', building_id: 'b2' }),
      makeElevator({ id: 'e1', code: 'A100', building_id: 'b1' }),
      makeElevator({ id: 'e3', code: 'A200', building_id: 'b1' }),
    ]);
    mockCreateResponsible.mockResolvedValue({ user: { id: 'new-1' }, assigned_elevator_ids: ['e1', 'e3', 'e2'] });
    renderPage();
    await waitForReady();
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Edificio Centro')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('checkbox', { name: /edificio centro/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /torre norte/i }));
    fillPersonal('Test', 'a@b.com', 'password1');
    fireEvent.submit(getForm());
    await waitFor(() => { expect(mockCreateResponsible).toHaveBeenCalledTimes(1); });
    const ids = mockCreateResponsible.mock.calls[0][0].elevator_ids;
    expect(ids).toEqual(['e1', 'e3', 'e2']);
  });

  it('desmarcar y volver a marcar un ascensor no altera el orden final', async () => {
    mockListClients.mockResolvedValue([makeClient()]);
    mockGetBuildingsByClient.mockResolvedValue([makeBuilding()]);
    mockFilterElevators.mockResolvedValue([
      makeElevator({ id: 'e1', code: 'B100' }),
      makeElevator({ id: 'e2', code: 'A100' }),
    ]);
    mockCreateResponsible.mockResolvedValue({ user: { id: 'new-1' }, assigned_elevator_ids: ['e2', 'e1'] });
    renderPage();
    await waitForReady();
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Edificio Centro')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('checkbox', { name: /edificio centro/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /ascensor b100/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /ascensor b100/i }));
    fillPersonal('Test', 'a@b.com', 'password1');
    fireEvent.submit(getForm());
    await waitFor(() => { expect(mockCreateResponsible).toHaveBeenCalledTimes(1); });
    const ids = mockCreateResponsible.mock.calls[0][0].elevator_ids;
    expect(ids).toEqual(['e2', 'e1']);
  });

  it('elevator_ids no contiene duplicados', async () => {
    mockListClients.mockResolvedValue([makeClient()]);
    mockGetBuildingsByClient.mockResolvedValue([makeBuilding()]);
    mockFilterElevators.mockResolvedValue([makeElevator({ id: 'e1', code: 'A100' })]);
    mockCreateResponsible.mockResolvedValue({ user: { id: 'new-1' }, assigned_elevator_ids: ['e1'] });
    renderPage();
    await waitForReady();
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Edificio Centro')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('checkbox', { name: /edificio centro/i }));
    fillPersonal('Test', 'a@b.com', 'password1');
    fireEvent.submit(getForm());
    await waitFor(() => { expect(mockCreateResponsible).toHaveBeenCalledTimes(1); });
    const ids = mockCreateResponsible.mock.calls[0][0].elevator_ids;
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('ResponsibleCreatePage — Accesibilidad', () => {
  it('error de clientes posee role="alert"', async () => {
    mockListClients.mockRejectedValueOnce(new Error('Falló'));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Falló')).toBeInTheDocument(); });
    expect(screen.getByRole('alert')).toHaveTextContent('Falló');
  });

  it('error de asignaciones posee role="alert"', async () => {
    mockListClients.mockResolvedValue([makeClient()]);
    mockGetBuildingsByClient.mockRejectedValueOnce(new Error('Falló'));
    mockFilterElevators.mockResolvedValue([]);
    renderPage();
    await waitFor(() => { expect(screen.getByText('Cliente Alpha')).toBeInTheDocument(); });
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Falló')).toBeInTheDocument(); });
    const alerts = screen.getAllByRole('alert');
    expect(alerts.some((a) => a.textContent?.includes('Falló'))).toBe(true);
  });

  it('formulario tiene aria-busy durante carga de clientes', async () => {
    const def = deferred<ReturnType<typeof makeClient>[]>();
    mockListClients.mockReturnValue(def.promise);
    renderPage();
    await waitFor(() => { expect(getForm()).toHaveAttribute('aria-busy', 'true'); });
    def.resolve([]);
    await waitFor(() => { expect(getForm()).toHaveAttribute('aria-busy', 'false'); });
  });

  it('formulario tiene aria-busy durante carga de asignaciones', async () => {
    mockListClients.mockResolvedValue([makeClient()]);
    const def = deferred<[ReturnType<typeof makeBuilding>[], ReturnType<typeof makeElevator>[]]>();
    mockGetBuildingsByClient.mockReturnValue(def.promise);
    mockFilterElevators.mockResolvedValue([]);
    renderPage();
    await waitFor(() => { expect(screen.getByText('Cliente Alpha')).toBeInTheDocument(); });
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } });
    await waitFor(() => { expect(getForm()).toHaveAttribute('aria-busy', 'true'); });
    def.resolve([[], []]);
    await waitFor(() => { expect(getForm()).toHaveAttribute('aria-busy', 'false'); });
  });

  it('campos personales continúan habilitados mientras se cargan asignaciones', async () => {
    mockListClients.mockResolvedValue([makeClient()]);
    mockGetBuildingsByClient.mockImplementationOnce(() => new Promise(() => {}));
    mockFilterElevators.mockImplementationOnce(() => new Promise(() => {}));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Cliente Alpha')).toBeInTheDocument(); });
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Cargando edificios y ascensores...')).toBeInTheDocument(); });
    expect(screen.getByLabelText(/nombre completo/i)).not.toBeDisabled();
    expect(screen.getByLabelText(/email \*/i)).not.toBeDisabled();
  });

  it('doble submit continúa generando una sola llamada', async () => {
    const def = deferred<{ user: { id: string }; assigned_elevator_ids: string[] }>();
    mockListClients.mockResolvedValue([makeClient()]);
    mockGetBuildingsByClient.mockResolvedValue([makeBuilding()]);
    mockFilterElevators.mockResolvedValue([makeElevator()]);
    mockCreateResponsible.mockReturnValue(def.promise);
    renderPage();
    await waitForReady();
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Edificio Centro')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('checkbox', { name: /edificio centro/i }));
    fillPersonal('Test', 'a@b.com', 'password1');
    fireEvent.submit(getForm());
    fireEvent.submit(getForm());
    fireEvent.submit(getForm());
    expect(mockCreateResponsible).toHaveBeenCalledTimes(1);
    def.resolve({ user: { id: 'new-1' }, assigned_elevator_ids: ['e1'] });
    await waitFor(() => { expect(mockNavigate).toHaveBeenCalled(); });
  });
});
