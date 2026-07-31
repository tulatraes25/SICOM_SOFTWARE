import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import UserDetailPage from './UserDetailPage';

const { mockGetUser, mockUpdateUser, mockResetPassword, mockNavigate } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockUpdateUser: vi.fn(),
  mockResetPassword: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock('@/services/adminUsers.service', () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
  updateUser: (...args: unknown[]) => mockUpdateUser(...args),
  resetPassword: (...args: unknown[]) => mockResetPassword(...args),
  getAdminUsersErrorMessage: (e: unknown) => e instanceof Error ? e.message : 'Error',
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

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1', email: 'test@example.com', full_name: 'Test User', role: 'technician' as const,
    active: true, created_at: '2026-01-15T10:30:00Z', last_sign_in_at: '2026-07-20T14:00:00Z',
    must_change_password: false, temporary_password_issued_at: null, password_changed_at: null,
    ...overrides,
  };
}

let user: ReturnType<typeof userEvent.setup>;

function renderPage(route = '/admin/usuarios/u1') {
  return render(<MemoryRouter initialEntries={[route]}><Routes><Route path="/admin/usuarios/:id" element={<UserDetailPage />} /><Route path="/admin/usuarios" element={<div>Usuarios list</div>} /></Routes></MemoryRouter>);
}

beforeEach(() => { vi.clearAllMocks(); user = userEvent.setup(); });
afterEach(() => { vi.restoreAllMocks(); cleanup(); });

describe('UserDetailPage — Ruta', () => {
  it('id ausente no llama getUser', async () => {
    render(<MemoryRouter initialEntries={['/admin/usuarios']}><Routes><Route path="/admin/usuarios" element={<UserDetailPage />} /></Routes></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('No se indicó el usuario')).toBeInTheDocument(); });
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('muestra botón Volver a usuarios', async () => {
    render(<MemoryRouter initialEntries={['/admin/usuarios']}><Routes><Route path="/admin/usuarios" element={<UserDetailPage />} /></Routes></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('No se indicó el usuario')).toBeInTheDocument(); });
    expect(screen.getByRole('button', { name: /volver a usuarios/i })).toBeInTheDocument();
  });

  it('Volver a usuarios navega correctamente', async () => {
    render(<MemoryRouter initialEntries={['/admin/usuarios']}><Routes><Route path="/admin/usuarios" element={<UserDetailPage />} /></Routes></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('No se indicó el usuario')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /volver a usuarios/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/usuarios');
  });
});

describe('UserDetailPage — Carga', () => {
  it('spinner visible durante carga', async () => {
    const def = deferred<ReturnType<typeof makeUser>>();
    mockGetUser.mockReturnValue(def.promise);
    renderPage();
    expect(screen.getByLabelText(/cargando usuario/i)).toBeInTheDocument();
    def.resolve(makeUser());
    await waitFor(() => { expect(screen.queryByLabelText(/cargando usuario/i)).not.toBeInTheDocument(); });
  });

  it('getUser llamado con id', async () => {
    mockGetUser.mockResolvedValue(makeUser());
    renderPage('/admin/usuarios/u-42');
    await waitFor(() => { expect(mockGetUser).toHaveBeenCalledWith('u-42'); });
  });

  it('respuesta exitosa muestra datos', async () => {
    mockGetUser.mockResolvedValue(makeUser({ full_name: 'Juan Pérez' }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Juan Pérez')).toBeInTheDocument(); });
  });

  it('doble carga no genera llamadas simultáneas', async () => {
    const def = deferred<ReturnType<typeof makeUser>>();
    mockGetUser.mockReturnValue(def.promise);
    renderPage();
    await waitFor(() => { expect(mockGetUser).toHaveBeenCalledTimes(1); });
    def.resolve(makeUser());
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    expect(mockGetUser).toHaveBeenCalledTimes(1);
  });
});

describe('UserDetailPage — Error de carga', () => {
  it('error muestra solo error, Reintentar y Volver', async () => {
    mockGetUser.mockRejectedValueOnce(new Error('RPC falló'));
    renderPage();
    await waitFor(() => { expect(screen.getByText('RPC falló')).toBeInTheDocument(); });
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /volver a usuarios/i })).toBeInTheDocument();
    expect(screen.queryByText('Datos del Usuario')).not.toBeInTheDocument();
    expect(screen.queryByText('Acciones')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /restablecer contraseña/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Activo')).not.toBeInTheDocument();
    expect(screen.queryByText('Inactivo')).not.toBeInTheDocument();
  });

  it('Reintentar exitoso muestra datos y acciones', async () => {
    mockGetUser.mockRejectedValueOnce(new Error('Error'));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Error')).toBeInTheDocument(); });
    expect(screen.getByRole('button', { name: /reintentar/i })).not.toBeDisabled();
    mockGetUser.mockResolvedValue(makeUser({ full_name: 'Recuperado' }));
    await user.click(screen.getByRole('button', { name: /reintentar/i }));
    await waitFor(() => {
      expect(screen.queryByText('Error')).not.toBeInTheDocument();
      expect(screen.getByText('Recuperado')).toBeInTheDocument();
      expect(screen.getByText('Acciones')).toBeInTheDocument();
    });
  });

  it('exactamente dos llamadas tras reintento', async () => {
    mockGetUser.mockRejectedValueOnce(new Error('Error'));
    renderPage();
    await waitFor(() => { expect(mockGetUser).toHaveBeenCalledTimes(1); });
    mockGetUser.mockResolvedValue(makeUser());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /reintentar/i })); });
    await waitFor(() => { expect(mockGetUser).toHaveBeenCalledTimes(2); });
  });
});

describe('UserDetailPage — Visualización', () => {
  it('muestra nombre y email', async () => {
    mockGetUser.mockResolvedValue(makeUser({ full_name: 'María López', email: 'maria@test.com' }));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('María López')).toBeInTheDocument();
      expect(screen.getByText('maria@test.com')).toBeInTheDocument();
    });
  });

  it('rol traducido', async () => {
    mockGetUser.mockResolvedValue(makeUser({ role: 'admin' }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Administrador')).toBeInTheDocument(); });
  });

  it('activo e inactivo', async () => {
    mockGetUser.mockResolvedValue(makeUser({ active: false }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Inactivo')).toBeInTheDocument(); });
  });

  it('fecha creada', async () => {
    mockGetUser.mockResolvedValue(makeUser());
    renderPage();
    await waitFor(() => { expect(screen.getByText('15/1/2026')).toBeInTheDocument(); });
  });

  it('último acceso null muestra Nunca', async () => {
    mockGetUser.mockResolvedValue(makeUser({ last_sign_in_at: null }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Nunca')).toBeInTheDocument(); });
  });

  it('fechas inválidas nunca muestran Invalid Date', async () => {
    mockGetUser.mockResolvedValue(makeUser({ created_at: 'bad', last_sign_in_at: 'bad' }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    expect(screen.queryByText('Invalid Date')).not.toBeInTheDocument();
  });
});

describe('UserDetailPage — Contraseña', () => {
  it('responsable pendiente', async () => {
    mockGetUser.mockResolvedValue(makeUser({ role: 'responsible', must_change_password: true }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Cambio pendiente')).toBeInTheDocument(); });
  });

  it('responsable actualizada', async () => {
    mockGetUser.mockResolvedValue(makeUser({ role: 'responsible', must_change_password: false, password_changed_at: '2026-07-01T00:00:00Z' }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Actualizada')).toBeInTheDocument(); });
  });

  it('responsable sin cambio pendiente', async () => {
    mockGetUser.mockResolvedValue(makeUser({ role: 'responsible', must_change_password: false, password_changed_at: null }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Sin cambio pendiente')).toBeInTheDocument(); });
  });

  it('otro rol muestra No aplica', async () => {
    mockGetUser.mockResolvedValue(makeUser({ role: 'technician' }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('No aplica')).toBeInTheDocument(); });
  });
});

describe('UserDetailPage — Edición', () => {
  it('editar abre formulario con datos actuales', async () => {
    mockGetUser.mockResolvedValue(makeUser({ full_name: 'Original' }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Original')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    expect(screen.getByLabelText(/nombre completo/i)).toHaveValue('Original');
  });

  it('nombre vacío con espacios se rechaza', async () => {
    mockGetUser.mockResolvedValue(makeUser({ full_name: 'X' }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('X')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: '   ' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /guardar/i })); });
    expect(screen.getByText('El nombre es obligatorio')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/nombre completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nombre completo/i)).not.toBeDisabled();
  });

  it('cancelar limpia error de nombre vacío', async () => {
    mockGetUser.mockResolvedValue(makeUser({ full_name: 'Original' }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Original')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: '   ' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /guardar/i })); });
    expect(screen.getByText('El nombre es obligatorio')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /cancelar edición/i }));
    expect(screen.queryByText('El nombre es obligatorio')).not.toBeInTheDocument();
    expect(screen.getByText('Original')).toBeInTheDocument();
  });

  it('guarda nombre con trim y role tipado', async () => {
    mockUpdateUser.mockResolvedValue(undefined);
    mockGetUser.mockResolvedValue(makeUser());
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: '  Nuevo  ' } });
    fireEvent.change(screen.getByLabelText(/^rol/i), { target: { value: 'admin' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /guardar/i })); });
    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith('u1', { full_name: 'Nuevo', role: 'admin' });
    });
  });

  it('éxito muestra mensaje y recarga', async () => {
    mockUpdateUser.mockResolvedValue(undefined);
    mockGetUser.mockResolvedValue(makeUser({ full_name: 'Actualizado' }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Actualizado')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /guardar/i })); });
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain('actualizado correctamente');
    });
    expect(screen.getByText('Actualizado')).toBeInTheDocument();
  });

  it('cancelar restaura valores', async () => {
    mockGetUser.mockResolvedValue(makeUser({ full_name: 'Original', role: 'technician' }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Original')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: 'Cambiado' } });
    fireEvent.click(screen.getByRole('button', { name: /cancelar edición/i }));
    expect(screen.getByText('Original')).toBeInTheDocument();
    expect(screen.queryByLabelText(/nombre completo/i)).not.toBeInTheDocument();
  });

  it('error remoto conserva edición', async () => {
    mockUpdateUser.mockRejectedValueOnce(new Error('RPC falló'));
    mockGetUser.mockResolvedValue(makeUser());
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /guardar/i })); });
    await waitFor(() => { expect(screen.getByText('RPC falló')).toBeInTheDocument(); });
    expect(screen.getByLabelText(/nombre completo/i)).toBeInTheDocument();
  });
});

describe('UserDetailPage — Doble guardado', () => {
  it('dos clics reales producen exactamente una llamada', async () => {
    const def = deferred<void>();
    mockUpdateUser.mockReturnValue(def.promise);
    mockGetUser.mockResolvedValue(makeUser());
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    const saveBtn = screen.getByRole('button', { name: /guardar/i });
    fireEvent.click(saveBtn);
    fireEvent.click(saveBtn);
    expect(mockUpdateUser).toHaveBeenCalledTimes(1);
    expect(mockUpdateUser).toHaveBeenCalledWith('u1', { full_name: 'Test User', role: 'technician' });
    def.resolve(undefined);
    mockGetUser.mockResolvedValue(makeUser());
    await waitFor(() => { expect(screen.getByRole('status')).toBeInTheDocument(); });
  });

  it('tras error controles habilitados', async () => {
    mockUpdateUser.mockRejectedValueOnce(new Error('Falló'));
    mockGetUser.mockResolvedValue(makeUser());
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /guardar/i })); });
    await waitFor(() => {
      expect(screen.getByText('Falló')).toBeInTheDocument();
      expect(screen.getByLabelText(/nombre completo/i)).not.toBeDisabled();
    });
  });
});

describe('UserDetailPage — Activación', () => {
  it('activo envía active false', async () => {
    mockUpdateUser.mockResolvedValue(undefined);
    mockGetUser.mockResolvedValue(makeUser({ active: true }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Activo')).toBeInTheDocument(); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /desactivar/i })); });
    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith('u1', { active: false });
      expect(screen.getByRole('status').textContent).toContain('desactivado correctamente');
    });
  });

  it('inactivo envía active true', async () => {
    mockUpdateUser.mockResolvedValue(undefined);
    mockGetUser.mockResolvedValue(makeUser({ active: false }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Inactivo')).toBeInTheDocument(); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /reactivar/i })); });
    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith('u1', { active: true });
    });
  });

  it('error conserva estado', async () => {
    mockUpdateUser.mockRejectedValueOnce(new Error('Falló'));
    mockGetUser.mockResolvedValue(makeUser({ active: true }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Activo')).toBeInTheDocument(); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /desactivar/i })); });
    await waitFor(() => { expect(screen.getByText('Falló')).toBeInTheDocument(); });
    expect(screen.getByText('Activo')).toBeInTheDocument();
  });

  it('doble clic real genera una sola llamada', async () => {
    const def = deferred<void>();
    mockUpdateUser.mockReturnValue(def.promise);
    mockGetUser.mockResolvedValue(makeUser({ active: true }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Activo')).toBeInTheDocument(); });
    const toggleBtn = screen.getByRole('button', { name: /desactivar/i });
    fireEvent.click(toggleBtn);
    fireEvent.click(toggleBtn);
    expect(mockUpdateUser).toHaveBeenCalledTimes(1);
    expect(mockUpdateUser).toHaveBeenCalledWith('u1', { active: false });
    def.resolve(undefined);
    mockGetUser.mockResolvedValue(makeUser({ active: false }));
    await waitFor(() => { expect(screen.getByRole('status').textContent).toContain('desactivado correctamente'); });
  });
});

describe('UserDetailPage — Operaciones simultáneas', () => {
  it('toggle bloqueado durante guardado', async () => {
    const saveDef = deferred<void>();
    mockUpdateUser.mockReturnValue(saveDef.promise);
    mockGetUser.mockResolvedValue(makeUser({ active: true }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Activo')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    fireEvent.click(screen.getByRole('button', { name: /desactivar/i }));
    expect(mockUpdateUser).toHaveBeenCalledTimes(1);
    saveDef.resolve(undefined);
    mockGetUser.mockResolvedValue(makeUser());
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
  });

  it('guardado bloqueado durante toggle', async () => {
    const toggleDef = deferred<void>();
    mockUpdateUser.mockReturnValue(toggleDef.promise);
    mockGetUser.mockResolvedValue(makeUser({ active: true }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Activo')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    await waitFor(() => { expect(screen.getByRole('button', { name: /guardar/i })).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /desactivar/i }));
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    expect(mockUpdateUser).toHaveBeenCalledTimes(1);
    toggleDef.resolve(undefined);
  });
});

describe('UserDetailPage — Mensajes de éxito', () => {
  it('éxito de guardado persiste tras recarga', async () => {
    mockUpdateUser.mockResolvedValue(undefined);
    mockGetUser.mockResolvedValue(makeUser({ full_name: 'Actualizado' }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Actualizado')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /guardar/i })); });
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain('actualizado correctamente');
      expect(screen.getByText('Actualizado')).toBeInTheDocument();
    });
  });

  it('éxito de activación persiste tras recarga', async () => {
    mockUpdateUser.mockResolvedValue(undefined);
    mockGetUser.mockResolvedValue(makeUser({ active: true }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Activo')).toBeInTheDocument(); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /desactivar/i })); });
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain('desactivado correctamente');
    });
  });
});

describe('UserDetailPage — Navegación', () => {
  it('Volver funciona sin operación', async () => {
    mockGetUser.mockResolvedValue(makeUser());
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /volver a usuarios/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/usuarios');
  });

  it('Volver deshabilitado durante guardado', async () => {
    const def = deferred<void>();
    mockUpdateUser.mockReturnValue(def.promise);
    mockGetUser.mockResolvedValue(makeUser());
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /guardar/i })); });
    await waitFor(() => { expect(screen.getByRole('button', { name: /volver a usuarios/i })).toBeDisabled(); });
    def.resolve(undefined);
    await waitFor(() => { expect(screen.getByRole('button', { name: /volver a usuarios/i })).not.toBeDisabled(); });
  });

  it('acciones deshabilitadas durante toggle', async () => {
    const def = deferred<void>();
    mockUpdateUser.mockReturnValue(def.promise);
    mockGetUser.mockResolvedValue(makeUser({ active: true }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Activo')).toBeInTheDocument(); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /desactivar/i })); });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /volver a usuarios/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /editar/i })).toBeDisabled();
    });
    def.resolve(undefined);
  });

  it('reset modal no se abre durante otra operación', async () => {
    const def = deferred<void>();
    mockUpdateUser.mockReturnValue(def.promise);
    mockGetUser.mockResolvedValue(makeUser());
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /guardar/i })); });
    await waitFor(() => { expect(screen.getByRole('button', { name: /restablecer contraseña/i })).toBeDisabled(); });
    def.resolve(undefined);
  });
});
