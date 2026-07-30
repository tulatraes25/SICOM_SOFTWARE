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

function renderPage() { return render(<MemoryRouter><UsersPage /></MemoryRouter>); }
function table() { return screen.getByRole('table'); }

beforeEach(() => { vi.clearAllMocks(); });

describe('UsersPage — Datos', () => {
  it('muestra nombre, email, rol traducido y estado', async () => {
    mockListUsers.mockResolvedValue([makeUser()]);
    renderPage();
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    const row = screen.getAllByRole('row')[1];
    expect(within(row).getByText('Test User')).toBeInTheDocument();
    expect(within(row).getByText('test@example.com')).toBeInTheDocument();
    expect(within(row).getByText('Técnico')).toBeInTheDocument();
    expect(within(row).getByText('Activo')).toBeInTheDocument();
  });

  it('muestra fecha creada en locale es-AR', async () => {
    mockListUsers.mockResolvedValue([makeUser()]);
    renderPage();
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    const row = screen.getAllByRole('row')[1];
    expect(within(row).getByText('15/1/2026')).toBeInTheDocument();
  });

  it('muestra enlace de detalle correcto', async () => {
    mockListUsers.mockResolvedValue([makeUser({ id: 'u-42' })]);
    renderPage();
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    const link = screen.getByRole('link', { name: /ver usuario test user/i });
    expect(link).toHaveAttribute('href', '/admin/usuarios/u-42');
  });

  it('muestra inactivo', async () => {
    mockListUsers.mockResolvedValue([makeUser({ active: false })]);
    renderPage();
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    const row = screen.getAllByRole('row')[1];
    expect(within(row).getByText('Inactivo')).toBeInTheDocument();
  });
});

describe('UsersPage — Orden', () => {
  it('Ana 2 antes que Ana 10 (natural sort)', async () => {
    mockListUsers.mockResolvedValue([
      makeUser({ id: 'a2', full_name: 'Ana 10' }),
      makeUser({ id: 'a1', full_name: 'Ana 2' }),
    ]);
    renderPage();
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    const rows = screen.getAllByRole('row');
    expect(within(rows[1]).getByText('Ana 2')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Ana 10')).toBeInTheDocument();
  });

  it('nombres antes que usuarios sin nombre', async () => {
    mockListUsers.mockResolvedValue([
      makeUser({ id: 'z', full_name: '', email: 'z@z.com' }),
      makeUser({ id: 'a', full_name: 'Alpha', email: 'a@a.com' }),
    ]);
    renderPage();
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    const rows = screen.getAllByRole('row');
    expect(within(rows[1]).getByText('Alpha')).toBeInTheDocument();
  });

  it('email como desempate', async () => {
    mockListUsers.mockResolvedValue([
      makeUser({ id: '1', full_name: 'Same', email: 'b@b.com' }),
      makeUser({ id: '2', full_name: 'Same', email: 'a@a.com' }),
    ]);
    renderPage();
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    const rows = screen.getAllByRole('row');
    expect(within(rows[1]).getByText('a@a.com')).toBeInTheDocument();
  });

  it('arreglo original no mutado', async () => {
    const users = [
      makeUser({ id: 'b', full_name: 'Bravo' }),
      makeUser({ id: 'a', full_name: 'Alpha' }),
    ];
    mockListUsers.mockResolvedValue(users);
    renderPage();
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    expect(users[0].full_name).toBe('Bravo');
  });
});

describe('UsersPage — Contador', () => {
  it('0 usuarios', async () => {
    mockListUsers.mockResolvedValue([]);
    renderPage();
    await waitFor(() => { expect(screen.getByText('0 usuarios')).toBeInTheDocument(); });
  });

  it('1 usuario', async () => {
    mockListUsers.mockResolvedValue([makeUser()]);
    renderPage();
    await waitFor(() => { expect(screen.getByText('1 usuario')).toBeInTheDocument(); });
  });

  it('varios usuarios', async () => {
    mockListUsers.mockResolvedValue([makeUser({ id: '1' }), makeUser({ id: '2' }), makeUser({ id: '3' })]);
    renderPage();
    await waitFor(() => { expect(screen.getByText('3 usuarios')).toBeInTheDocument(); });
  });

  it('Mostrando X de Y con filtros', async () => {
    mockListUsers.mockResolvedValue([
      makeUser({ id: '1', role: 'admin' }),
      makeUser({ id: '2', role: 'technician' }),
    ]);
    renderPage();
    await waitFor(() => { expect(screen.getByText('2 usuarios')).toBeInTheDocument(); });
    const select = screen.getByRole('combobox', { name: /filtrar por rol/i });
    await userEvent.selectOptions(select, 'admin');
    await waitFor(() => { expect(screen.getByText(/Mostrando 1 de 2/)).toBeInTheDocument(); });
  });
});

describe('UsersPage — Búsqueda', () => {
  it('por nombre', async () => {
    mockListUsers.mockResolvedValue([makeUser({ full_name: 'Juan' }), makeUser({ id: '2', full_name: 'Pedro' })]);
    renderPage();
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    await userEvent.type(screen.getByPlaceholderText(SEARCH), 'Juan');
    expect(screen.getByText('Juan')).toBeInTheDocument();
    expect(screen.queryByText('Pedro')).not.toBeInTheDocument();
  });

  it('por email', async () => {
    mockListUsers.mockResolvedValue([makeUser({ email: 'a@test.com' }), makeUser({ id: '2', email: 'b@test.com' })]);
    renderPage();
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    await userEvent.type(screen.getByPlaceholderText(SEARCH), 'b@test');
    expect(screen.getByText('b@test.com')).toBeInTheDocument();
    expect(screen.queryByText('a@test.com')).not.toBeInTheDocument();
  });

  it('ignora mayúsculas', async () => {
    mockListUsers.mockResolvedValue([makeUser({ full_name: 'María' })]);
    renderPage();
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    await userEvent.type(screen.getByPlaceholderText(SEARCH), 'maría');
    expect(screen.getByText('María')).toBeInTheDocument();
  });

  it('ignora espacios externos', async () => {
    mockListUsers.mockResolvedValue([makeUser({ full_name: 'Juan' })]);
    renderPage();
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    await userEvent.type(screen.getByPlaceholderText(SEARCH), '  Juan  ');
    expect(screen.getByText('Juan')).toBeInTheDocument();
  });

  it('sin coincidencias muestra aviso', async () => {
    mockListUsers.mockResolvedValue([makeUser()]);
    renderPage();
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    await userEvent.type(screen.getByPlaceholderText(SEARCH), 'ZZZ');
    await waitFor(() => { expect(screen.getByText('No se encontraron usuarios')).toBeInTheDocument(); });
  });
});

describe('UsersPage — Roles', () => {
  const roleUsers = [
    makeUser({ id: 'a', role: 'admin', full_name: 'Admin User' }),
    makeUser({ id: 's', role: 'supervisor', full_name: 'Sup User' }),
    makeUser({ id: 't', role: 'technician', full_name: 'Tech User' }),
    makeUser({ id: 'r', role: 'responsible', full_name: 'Resp User' }),
  ];

  it.each(['admin', 'supervisor', 'technician', 'responsible'] as const)('filtra %s', async (role) => {
    mockListUsers.mockResolvedValue(roleUsers);
    renderPage();
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    const select = screen.getByRole('combobox', { name: /filtrar por rol/i });
    await userEvent.selectOptions(select, role);
    const expected = { admin: 'Admin User', supervisor: 'Sup User', technician: 'Tech User', responsible: 'Resp User' }[role];
    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      expect(rows.length).toBe(2);
    });
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});

describe('UsersPage — Contraseña', () => {
  it('responsable pendiente', async () => {
    mockListUsers.mockResolvedValue([makeUser({ role: 'responsible', must_change_password: true })]);
    renderPage();
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    const row = screen.getAllByRole('row')[1];
    expect(within(row).getByText('Cambio pendiente')).toBeInTheDocument();
  });

  it('responsable actualizada', async () => {
    mockListUsers.mockResolvedValue([makeUser({ role: 'responsible', must_change_password: false, password_changed_at: '2026-07-01T00:00:00Z' })]);
    renderPage();
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    const row = screen.getAllByRole('row')[1];
    expect(within(row).getByText('Actualizada')).toBeInTheDocument();
  });

  it('responsable sin cambio pendiente', async () => {
    mockListUsers.mockResolvedValue([makeUser({ role: 'responsible', must_change_password: false, password_changed_at: null })]);
    renderPage();
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    const row = screen.getAllByRole('row')[1];
    expect(within(row).getByText('Sin cambio pendiente')).toBeInTheDocument();
  });

  it('usuario no responsable: No aplica', async () => {
    mockListUsers.mockResolvedValue([makeUser({ role: 'technician' })]);
    renderPage();
    await waitFor(() => { expect(table()).toBeInTheDocument(); });
    const row = screen.getAllByRole('row')[1];
    expect(within(row).getByText('No aplica')).toBeInTheDocument();
  });
});

describe('UsersPage — Carga', () => {
  it('spinner visible y botón deshabilitado durante carga', async () => {
    const def = deferred<ReturnType<typeof makeUser>[]>();
    mockListUsers.mockReturnValue(def.promise);
    renderPage();
    expect(screen.getByLabelText(/cargando usuarios/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /actualizar/i })).toBeDisabled();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    def.resolve([makeUser()]);
    await waitFor(() => {
      expect(screen.queryByLabelText(/cargando usuarios/i)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /actualizar/i })).not.toBeDisabled();
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
  });
});

describe('UsersPage — Error y reintento', () => {
  it('muestra error, reintento, y recuperación', async () => {
    mockListUsers.mockRejectedValueOnce(new Error('RPC falló'));
    renderPage();
    await waitFor(() => { expect(screen.getByText('RPC falló')).toBeInTheDocument(); });
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
    const def2 = deferred<ReturnType<typeof makeUser>[]>();
    mockListUsers.mockReturnValue(def2.promise);
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    await waitFor(() => { expect(screen.getByRole('button', { name: /reintentar/i })).toBeDisabled(); });
    def2.resolve([makeUser()]);
    await waitFor(() => {
      expect(screen.queryByText('RPC falló')).not.toBeInTheDocument();
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });
    expect(mockListUsers).toHaveBeenCalledTimes(2);
  });
});

describe('UsersPage — Actualizar', () => {
  it('carga inicial y segunda carga con Actualizar', async () => {
    mockListUsers.mockResolvedValue([makeUser({ full_name: 'V1' })]);
    renderPage();
    await waitFor(() => { expect(screen.getByText('V1')).toBeInTheDocument(); });
    mockListUsers.mockResolvedValue([makeUser({ id: 'u2', full_name: 'V2' })]);
    fireEvent.click(screen.getByRole('button', { name: /actualizar/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /actualizar/i })).toBeDisabled();
    });
    await waitFor(() => {
      expect(screen.getByText('V2')).toBeInTheDocument();
      expect(screen.queryByText('V1')).not.toBeInTheDocument();
    });
    expect(mockListUsers).toHaveBeenCalledTimes(2);
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
});

describe('UsersPage — Estados vacíos', () => {
  it('array vacío sin filtros: No hay usuarios registrados', async () => {
    mockListUsers.mockResolvedValue([]);
    renderPage();
    await waitFor(() => { expect(screen.getByText('No hay usuarios registrados')).toBeInTheDocument(); });
  });

  it('filtro sin resultados: No se encontraron usuarios', async () => {
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
