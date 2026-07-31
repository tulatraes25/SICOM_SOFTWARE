import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import UsersPage from './UsersPage';

const { mockListUsers } = vi.hoisted(() => ({
  mockListUsers: vi.fn(),
}));

vi.mock('@/services/adminUsers.service', () => ({
  listUsers: (...args: unknown[]) => mockListUsers(...args),
  getAdminUsersErrorMessage: (e: unknown) => e instanceof Error ? e.message : 'Error',
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'admin1' },
    profile: { id: 'admin1', full_name: 'TestAdmin', role: 'admin', email: 'adm@test.com', active: true, created_at: '', updated_at: '' },
    logout: () => Promise.resolve(),
    login: () => Promise.resolve({ error: null }),
    getRedirectPath: () => '/',
    hasRole: () => true,
    isAdmin: true,
    isTechnician: false,
    isSupervisor: false,
    isResponsible: false,
    isAuthenticated: true,
    loading: false,
    error: null,
  })),
}));

vi.mock('@/components/layout/Sidebar', () => ({ default: vi.fn(() => <div data-testid="sidebar" />) }));

const SEARCH = 'Buscar por nombre o email...';

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    email: 'test@example.com',
    full_name: 'Test User',
    role: 'technician',
    active: true,
    created_at: '2026-01-15T10:30:00Z',
    last_sign_in_at: null,
    must_change_password: false,
    temporary_password_issued_at: null,
    password_changed_at: null,
    ...overrides,
  };
}

interface Deferred<T> { promise: Promise<T>; resolve: (value: T) => void; }
function deferred<T>(): Deferred<T> { let resolve!: (value: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; }

function renderPage(initialTab?: string) {
  const entries = initialTab ? [`/admin/usuarios?tab=${initialTab}`] : ['/admin/usuarios'];
  return render(<MemoryRouter initialEntries={entries}><UsersPage /></MemoryRouter>);
}
function table() { return screen.getByRole('table'); }

beforeEach(() => { vi.clearAllMocks(); });

describe('UsersPage — Pestañas', () => {
  it('aparecen las dos pestañas', async () => {
    mockListUsers.mockResolvedValue([]);
    renderPage();
    await waitFor(() => { expect(screen.getByRole('tab', { name: /usuarios$/i })).toBeInTheDocument(); });
    expect(screen.getByRole('tab', { name: /responsables de edificios/i })).toBeInTheDocument();
  });

  it('Usuarios está activa por defecto', async () => {
    mockListUsers.mockResolvedValue([]);
    renderPage();
    await waitFor(() => { expect(screen.getByText('0 usuarios')).toBeInTheDocument(); });
    expect(screen.getByRole('tab', { name: /usuarios$/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /responsables de edificios/i })).toHaveAttribute('aria-selected', 'false');
  });

  it('tab=responsables activa la pestaña correcta', async () => {
    mockListUsers.mockResolvedValue([]);
    renderPage('responsables');
    await waitFor(() => { expect(screen.getByText('0 responsables')).toBeInTheDocument(); });
    expect(screen.getByRole('tab', { name: /responsables de edificios/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /usuarios$/i })).toHaveAttribute('aria-selected', 'false');
  });

  it('query param desconocido vuelve a Usuarios', async () => {
    mockListUsers.mockResolvedValue([]);
    renderPage('otro');
    await waitFor(() => { expect(screen.getByText('0 usuarios')).toBeInTheDocument(); });
    expect(screen.getByRole('tab', { name: /usuarios$/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('cambiar pestaña actualiza la URL', async () => {
    mockListUsers.mockResolvedValue([]);
    renderPage();
    await waitFor(() => { expect(screen.getByText('0 usuarios')).toBeInTheDocument(); });
    const respTab = screen.getByRole('tab', { name: /responsables de edificios/i });
    await userEvent.click(respTab);
    expect(respTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('0 responsables')).toBeInTheDocument();
  });

  it('Usuarios excluye responsables', async () => {
    mockListUsers.mockResolvedValue([
      makeUser({ id: 's1', role: 'technician', full_name: 'Tech' }),
      makeUser({ id: 'r1', role: 'responsible', full_name: 'Resp' }),
    ]);
    renderPage();
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    expect(screen.getByText('Tech')).toBeInTheDocument();
    expect(screen.queryByText('Resp')).not.toBeInTheDocument();
  });

  it('Responsables excluye personal interno', async () => {
    mockListUsers.mockResolvedValue([
      makeUser({ id: 's1', role: 'technician', full_name: 'Tech' }),
      makeUser({ id: 'r1', role: 'responsible', full_name: 'Resp' }),
    ]);
    renderPage('responsables');
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    expect(screen.getByText('Resp')).toBeInTheDocument();
    expect(screen.queryByText('Tech')).not.toBeInTheDocument();
  });

  it('contador de Usuarios no incluye responsables', async () => {
    mockListUsers.mockResolvedValue([
      makeUser({ id: 's1', role: 'technician' }),
      makeUser({ id: 'r1', role: 'responsible' }),
    ]);
    renderPage();
    await waitFor(() => { expect(screen.getByText('1 usuario')).toBeInTheDocument(); });
  });

  it('contador de Responsables no incluye otros roles', async () => {
    mockListUsers.mockResolvedValue([
      makeUser({ id: 's1', role: 'technician' }),
      makeUser({ id: 'r1', role: 'responsible' }),
    ]);
    renderPage('responsables');
    await waitFor(() => { expect(screen.getByText('1 responsable')).toBeInTheDocument(); });
  });

  it('filtro de rol no contiene Responsable', async () => {
    mockListUsers.mockResolvedValue([makeUser()]);
    renderPage();
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    const select = screen.getByRole('combobox', { name: /filtrar por rol/i });
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.value);
    expect(options).not.toContain('responsible');
    expect(options).toEqual(['', 'admin', 'supervisor', 'technician']);
  });

  it('filtro de rol no aparece en Responsables', async () => {
    mockListUsers.mockResolvedValue([makeUser({ role: 'responsible' })]);
    renderPage('responsables');
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    expect(screen.queryByRole('combobox', { name: /filtrar por rol/i })).not.toBeInTheDocument();
  });

  it('tabla de Responsables no muestra columna Rol', async () => {
    mockListUsers.mockResolvedValue([makeUser({ role: 'responsible' })]);
    renderPage('responsables');
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    expect(screen.queryByText('Rol')).not.toBeInTheDocument();
  });

  it('búsqueda se aplica dentro de la pestaña activa', async () => {
    mockListUsers.mockResolvedValue([
      makeUser({ id: 's1', role: 'technician', full_name: 'Tech' }),
      makeUser({ id: 'r1', role: 'responsible', full_name: 'Resp' }),
    ]);
    renderPage('responsables');
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    await userEvent.type(screen.getByPlaceholderText(SEARCH), 'Resp');
    expect(screen.getByText('Resp')).toBeInTheDocument();
    expect(screen.queryByText('Tech')).not.toBeInTheDocument();
  });

  it('cambiar pestaña limpia búsqueda', async () => {
    mockListUsers.mockResolvedValue([
      makeUser({ id: 's1', role: 'technician', full_name: 'Tech' }),
      makeUser({ id: 'r1', role: 'responsible', full_name: 'Resp' }),
    ]);
    renderPage('responsables');
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    await userEvent.type(screen.getByPlaceholderText(SEARCH), 'Resp');
    expect(screen.getByText('Resp')).toBeInTheDocument();
    const usersTab = screen.getByRole('tab', { name: /usuarios$/i });
    await userEvent.click(usersTab);
    expect(screen.getByPlaceholderText(SEARCH)).toHaveValue('');
    expect(screen.getByText('Tech')).toBeInTheDocument();
  });

  it('cambiar pestaña no vuelve a llamar listUsers', async () => {
    mockListUsers.mockResolvedValue([
      makeUser({ id: 's1', role: 'technician', full_name: 'Tech' }),
      makeUser({ id: 'r1', role: 'responsible', full_name: 'Resp' }),
    ]);
    renderPage();
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    expect(mockListUsers).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('tab', { name: /responsables de edificios/i }));
    expect(mockListUsers).toHaveBeenCalledTimes(1);
  });

  it('Actualizar hace una sola llamada adicional', async () => {
    mockListUsers.mockResolvedValue([makeUser()]);
    renderPage();
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    expect(mockListUsers).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /actualizar/i }));
    await waitFor(() => { expect(mockListUsers).toHaveBeenCalledTimes(2); });
  });

  it('estado vacío de responsables', async () => {
    mockListUsers.mockResolvedValue([]);
    renderPage('responsables');
    await waitFor(() => { expect(screen.getByText('No hay responsables de edificios registrados')).toBeInTheDocument(); });
  });

  it('búsqueda sin coincidencias de responsables', async () => {
    mockListUsers.mockResolvedValue([makeUser({ role: 'responsible', full_name: 'Resp' })]);
    renderPage('responsables');
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    await userEvent.type(screen.getByPlaceholderText(SEARCH), 'ZZZ');
    await waitFor(() => { expect(screen.getByText('No se encontraron responsables')).toBeInTheDocument(); });
  });

  it('botón Nuevo usuario solo está en pestaña Usuarios', async () => {
    mockListUsers.mockResolvedValue([makeUser()]);
    renderPage();
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    expect(screen.getByRole('link', { name: /nuevo usuario/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /responsables de edificios/i }));
    expect(screen.queryByRole('link', { name: /nuevo usuario/i })).not.toBeInTheDocument();
  });

  it('enlace de detalle del responsable sigue funcionando', async () => {
    mockListUsers.mockResolvedValue([makeUser({ id: 'r1', role: 'responsible', full_name: 'Resp' })]);
    renderPage('responsables');
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    const link = screen.getByRole('link', { name: /ver usuario resp/i });
    expect(link).toHaveAttribute('href', '/admin/usuarios/r1');
  });
});

describe('UsersPage — Visualización (staff)', () => {
  it('muestra nombre, email, rol y estado', async () => {
    mockListUsers.mockResolvedValue([makeUser()]);
    renderPage();
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    const row = screen.getAllByRole('row')[1];
    expect(within(row).getByText('Test User')).toBeInTheDocument();
    expect(within(row).getByText('test@example.com')).toBeInTheDocument();
    expect(within(row).getByText('Técnico')).toBeInTheDocument();
    expect(within(row).getByText('Activo')).toBeInTheDocument();
  });

  it('muestra fecha creada', async () => {
    mockListUsers.mockResolvedValue([makeUser()]);
    renderPage();
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    const row = screen.getAllByRole('row')[1];
    expect(within(row).getByText('15/1/2026')).toBeInTheDocument();
  });

  it('muestra inactivo', async () => {
    mockListUsers.mockResolvedValue([makeUser({ active: false })]);
    renderPage();
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    const row = screen.getAllByRole('row')[1];
    expect(within(row).getByText('Inactivo')).toBeInTheDocument();
  });
});

describe('UsersPage — Visualización (responsables)', () => {
  it('muestra nombre, email, estado y contraseña', async () => {
    mockListUsers.mockResolvedValue([makeUser({ role: 'responsible', must_change_password: true })]);
    renderPage('responsables');
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    const row = screen.getAllByRole('row')[1];
    expect(within(row).getByText('Test User')).toBeInTheDocument();
    expect(within(row).getByText('test@example.com')).toBeInTheDocument();
    expect(within(row).getByText('Cambio pendiente')).toBeInTheDocument();
  });

  it('no muestra columna Rol', async () => {
    mockListUsers.mockResolvedValue([makeUser({ role: 'responsible' })]);
    renderPage('responsables');
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    const headers = screen.getAllByRole('columnheader');
    expect(headers.map((h) => h.textContent)).not.toContain('Rol');
  });
});

describe('UsersPage — Contraseña', () => {
  it('responsable pendiente', async () => {
    mockListUsers.mockResolvedValue([makeUser({ role: 'responsible', must_change_password: true })]);
    renderPage('responsables');
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    const row = screen.getAllByRole('row')[1];
    expect(within(row).getByText('Cambio pendiente')).toBeInTheDocument();
  });

  it('responsable actualizada', async () => {
    mockListUsers.mockResolvedValue([makeUser({ role: 'responsible', must_change_password: false, password_changed_at: '2026-07-01' })]);
    renderPage('responsables');
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    const row = screen.getAllByRole('row')[1];
    expect(within(row).getByText('Actualizada')).toBeInTheDocument();
  });

  it('responsable sin cambio', async () => {
    mockListUsers.mockResolvedValue([makeUser({ role: 'responsible', must_change_password: false, password_changed_at: null })]);
    renderPage('responsables');
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    const row = screen.getAllByRole('row')[1];
    expect(within(row).getByText('Sin cambio pendiente')).toBeInTheDocument();
  });

  it('staff muestra No aplica', async () => {
    mockListUsers.mockResolvedValue([makeUser({ role: 'technician' })]);
    renderPage();
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    const row = screen.getAllByRole('row')[1];
    expect(within(row).getByText('No aplica')).toBeInTheDocument();
  });
});

describe('UsersPage — Actualización', () => {
  it('carga inicial y segunda carga', async () => {
    mockListUsers.mockResolvedValue([makeUser({ full_name: 'V1' })]);
    renderPage();
    await waitFor(() => { expect(screen.getByText('V1')).toBeInTheDocument(); });
    mockListUsers.mockResolvedValue([makeUser({ id: 'u2', full_name: 'V2' })]);
    fireEvent.click(screen.getByRole('button', { name: /actualizar/i }));
    await waitFor(() => {
      expect(screen.getByText('V2')).toBeInTheDocument();
      expect(screen.queryByText('V1')).not.toBeInTheDocument();
    });
  });

  it('conserva filtros al actualizar', async () => {
    mockListUsers.mockResolvedValue([
      makeUser({ id: '1', role: 'admin', full_name: 'AdminX' }),
      makeUser({ id: '2', role: 'technician', full_name: 'Tech User' }),
    ]);
    renderPage();
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    const select = screen.getByRole('combobox', { name: /filtrar por rol/i });
    await userEvent.selectOptions(select, 'admin');
    await waitFor(() => { expect(screen.getByText('AdminX')).toBeInTheDocument(); });
    mockListUsers.mockResolvedValue([
      makeUser({ id: '1', role: 'admin', full_name: 'Admin2' }),
      makeUser({ id: '3', role: 'admin', full_name: 'Admin3' }),
    ]);
    fireEvent.click(screen.getByRole('button', { name: /actualizar/i }));
    await waitFor(() => { expect(screen.getByText('Admin2')).toBeInTheDocument(); });
    expect(screen.queryByText('Tech User')).not.toBeInTheDocument();
  });

  it('doble clic no genera tercera llamada', async () => {
    mockListUsers.mockResolvedValue([makeUser()]);
    renderPage();
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    expect(mockListUsers).toHaveBeenCalledTimes(1);
    const updDef = deferred<ReturnType<typeof makeUser>[]>();
    mockListUsers.mockReturnValue(updDef.promise);
    fireEvent.click(screen.getByRole('button', { name: /actualizar/i }));
    fireEvent.click(screen.getByRole('button', { name: /actualizar/i }));
    expect(mockListUsers).toHaveBeenCalledTimes(2);
    updDef.resolve([makeUser({ id: 'u2' })]);
    await waitFor(() => { expect(screen.getByRole('button', { name: /actualizar/i })).not.toBeDisabled(); });
    expect(mockListUsers).toHaveBeenCalledTimes(2);
  });
});

describe('UsersPage — Error y reintento', () => {
  it('error visible y reintento', async () => {
    mockListUsers.mockRejectedValueOnce(new Error('RPC falló'));
    renderPage();
    await waitFor(() => { expect(screen.getByText('RPC falló')).toBeInTheDocument(); });
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
    mockListUsers.mockResolvedValue([makeUser({ full_name: 'Recuperado' })]);
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    await waitFor(() => { expect(screen.getByText('Recuperado')).toBeInTheDocument(); });
  });
});

describe('UsersPage — Estados vacíos', () => {
  it('staff vacío: No hay usuarios registrados', async () => {
    mockListUsers.mockResolvedValue([]);
    renderPage();
    await waitFor(() => { expect(screen.getByText('No hay usuarios registrados')).toBeInTheDocument(); });
  });

  it('staff sin coincidencias: No se encontraron usuarios', async () => {
    mockListUsers.mockResolvedValue([makeUser({ role: 'admin' })]);
    renderPage();
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    await userEvent.type(screen.getByPlaceholderText(SEARCH), 'ZZZZZ');
    await waitFor(() => { expect(screen.getByText('No se encontraron usuarios')).toBeInTheDocument(); });
  });
});

describe('UsersPage — Fecha inválida', () => {
  it('nunca muestra Invalid Date', async () => {
    mockListUsers.mockResolvedValue([makeUser({ created_at: 'not-a-date' })]);
    renderPage();
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    expect(screen.queryByText('Invalid Date')).not.toBeInTheDocument();
    const row = screen.getAllByRole('row')[1];
    expect(within(row).getByText('-')).toBeInTheDocument();
  });
});
