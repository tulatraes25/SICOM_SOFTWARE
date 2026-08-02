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

vi.mock('./ResponsibleAssignmentsCard', () => {
  const callbacks: Array<(saving: boolean) => void> = [];
  return {
    default: vi.fn(({ responsibleUserId, disabled, onSavingChange }: { responsibleUserId: string; disabled?: boolean; onSavingChange?: (saving: boolean) => void }) => {
      if (onSavingChange) callbacks.push(onSavingChange);
      return (
        <div data-testid="responsible-assignments-card">
          <span data-testid="assignment-user-id">{responsibleUserId}</span>
          <span data-testid="assignment-disabled">{String(disabled)}</span>
        </div>
      );
    }),
    _callbacks: callbacks,
  };
});

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

beforeEach(() => { vi.clearAllMocks(); vi.spyOn(window, 'confirm').mockReturnValue(true); user = userEvent.setup(); });
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

describe('UserDetailPage — Confirmación desactivación', () => {
  it('desactivación muestra confirmación', async () => {
    mockGetUser.mockResolvedValue(makeUser({ active: true }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Activo')).toBeInTheDocument(); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /desactivar/i })); });
    expect(window.confirm).toHaveBeenCalledTimes(1);
  });

  it('el mensaje contiene el nombre completo', async () => {
    mockGetUser.mockResolvedValue(makeUser({ full_name: 'Adriana Forquera', active: true }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Adriana Forquera')).toBeInTheDocument(); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /desactivar/i })); });
    expect(window.confirm).toHaveBeenCalledWith('¿Desactivar a Adriana Forquera? El usuario no podrá iniciar sesión.');
  });

  it('cancelar no llama updateUser', async () => {
    (window.confirm as ReturnType<typeof vi.fn>).mockReturnValue(false);
    mockGetUser.mockResolvedValue(makeUser({ active: true }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Activo')).toBeInTheDocument(); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /desactivar/i })); });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('confirmar llama updateUser con active:false', async () => {
    (window.confirm as ReturnType<typeof vi.fn>).mockReturnValue(true);
    mockUpdateUser.mockResolvedValue(undefined);
    mockGetUser.mockResolvedValue(makeUser({ active: true }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Activo')).toBeInTheDocument(); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /desactivar/i })); });
    expect(mockUpdateUser).toHaveBeenCalledWith('u1', { active: false });
  });

  it('reactivar no muestra confirmación', async () => {
    mockGetUser.mockResolvedValue(makeUser({ active: false }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Inactivo')).toBeInTheDocument(); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /reactivar/i })); });
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it('conflicto 409 continúa mostrando el mensaje exacto', async () => {
    const MSG = 'Antes de desactivar este responsable, reasigná sus ascensores a otro responsable.';
    (window.confirm as ReturnType<typeof vi.fn>).mockReturnValue(true);
    mockUpdateUser.mockRejectedValue(new Error(MSG));
    mockGetUser.mockResolvedValue(makeUser({ role: 'responsible', active: true }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Activo')).toBeInTheDocument(); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /desactivar/i })); });
    await waitFor(() => { expect(screen.getByText(MSG)).toBeInTheDocument(); });
  });

  it('conflicto mantiene al usuario activo', async () => {
    const MSG = 'Antes de desactivar este responsable, reasigná sus ascensores a otro responsable.';
    (window.confirm as ReturnType<typeof vi.fn>).mockReturnValue(true);
    mockUpdateUser.mockRejectedValue(new Error(MSG));
    mockGetUser.mockResolvedValue(makeUser({ role: 'responsible', active: true }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Activo')).toBeInTheDocument(); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /desactivar/i })); });
    await waitFor(() => { expect(screen.getByText(MSG)).toBeInTheDocument(); });
    expect(screen.getByText('Activo')).toBeInTheDocument();
  });

  it('doble clic continúa produciendo una sola llamada', async () => {
    (window.confirm as ReturnType<typeof vi.fn>).mockReturnValue(true);
    mockUpdateUser.mockResolvedValue(undefined);
    mockGetUser.mockResolvedValue(makeUser({ active: true }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Activo')).toBeInTheDocument(); });
    const btn = screen.getByRole('button', { name: /desactivar/i });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(mockUpdateUser).toHaveBeenCalledTimes(1);
  });
});

describe('UserDetailPage — Conflicto desactivación responsable', () => {
  const RESPONSIBLE_MSG = 'Antes de desactivar este responsable, reasigná sus ascensores a otro responsable.';

  it('conflicto del responsable muestra el mensaje exacto', async () => {
    mockUpdateUser.mockRejectedValue(new Error(RESPONSIBLE_MSG));
    mockGetUser.mockResolvedValue(makeUser({ role: 'responsible', active: true }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Activo')).toBeInTheDocument(); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /desactivar/i })); });
    await waitFor(() => { expect(screen.getByText(RESPONSIBLE_MSG)).toBeInTheDocument(); });
  });

  it('conflicto mantiene estado Activo', async () => {
    mockUpdateUser.mockRejectedValue(new Error(RESPONSIBLE_MSG));
    mockGetUser.mockResolvedValue(makeUser({ role: 'responsible', active: true }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Activo')).toBeInTheDocument(); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /desactivar/i })); });
    await waitFor(() => { expect(screen.getByText(RESPONSIBLE_MSG)).toBeInTheDocument(); });
    expect(screen.getByText('Activo')).toBeInTheDocument();
  });

  it('conflicto no muestra éxito', async () => {
    mockUpdateUser.mockRejectedValue(new Error(RESPONSIBLE_MSG));
    mockGetUser.mockResolvedValue(makeUser({ role: 'responsible', active: true }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Activo')).toBeInTheDocument(); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /desactivar/i })); });
    await waitFor(() => { expect(screen.getByText(RESPONSIBLE_MSG)).toBeInTheDocument(); });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('desactivación válida muestra éxito', async () => {
    mockUpdateUser.mockResolvedValue(undefined);
    mockGetUser.mockResolvedValue(makeUser({ role: 'responsible', active: true }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Activo')).toBeInTheDocument(); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /desactivar/i })); });
    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith('u1', { active: false });
      expect(screen.getByRole('status').textContent).toContain('desactivado correctamente');
    });
  });

  it('reactivación sigue funcionando', async () => {
    mockUpdateUser.mockResolvedValue(undefined);
    mockGetUser.mockResolvedValue(makeUser({ role: 'responsible', active: false }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Inactivo')).toBeInTheDocument(); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /reactivar/i })); });
    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith('u1', { active: true });
    });
  });

  it('doble clic produce una sola llamada', async () => {
    const def = deferred<void>();
    mockUpdateUser.mockReturnValue(def.promise);
    mockGetUser.mockResolvedValue(makeUser({ role: 'responsible', active: true }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Activo')).toBeInTheDocument(); });
    const toggleBtn = screen.getByRole('button', { name: /desactivar/i });
    fireEvent.click(toggleBtn);
    fireEvent.click(toggleBtn);
    expect(mockUpdateUser).toHaveBeenCalledTimes(1);
    def.resolve(undefined);
    mockGetUser.mockResolvedValue(makeUser({ role: 'responsible', active: false }));
    await waitFor(() => { expect(screen.getByRole('status').textContent).toContain('desactivado correctamente'); });
  });

  it('botón queda deshabilitado mientras opera', async () => {
    const def = deferred<void>();
    mockUpdateUser.mockReturnValue(def.promise);
    mockGetUser.mockResolvedValue(makeUser({ role: 'responsible', active: true }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Activo')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /desactivar/i }));
    await waitFor(() => { expect(screen.getByRole('button', { name: /desactivando/i })).toBeDisabled(); });
    def.resolve(undefined);
    mockGetUser.mockResolvedValue(makeUser({ role: 'responsible', active: false }));
    await waitFor(() => { expect(screen.queryByRole('button', { name: /desactivando/i })).not.toBeInTheDocument(); });
  });

  it('error genérico se muestra de manera controlada', async () => {
    mockUpdateUser.mockRejectedValue(new Error('Error inesperado'));
    mockGetUser.mockResolvedValue(makeUser({ role: 'responsible', active: true }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Activo')).toBeInTheDocument(); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /desactivar/i })); });
    await waitFor(() => { expect(screen.getByText('Error inesperado')).toBeInTheDocument(); });
    expect(screen.getByText('Activo')).toBeInTheDocument();
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

describe('UserDetailPage — Modal de contraseña: Apertura y accesibilidad', () => {
  it('botón abre modal', async () => {
    mockGetUser.mockResolvedValue(makeUser());
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /restablecer contraseña/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('role dialog y aria-modal', async () => {
    mockGetUser.mockResolvedValue(makeUser());
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /restablecer contraseña/i }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('título accesible', async () => {
    mockGetUser.mockResolvedValue(makeUser());
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /restablecer contraseña/i }));
    expect(screen.getByText('Restablecer contraseña', { selector: 'h3' })).toHaveAttribute('id', 'reset-password-title');
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'reset-password-title');
  });

  it('aparecen los dos campos', async () => {
    mockGetUser.mockResolvedValue(makeUser());
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /restablecer contraseña/i }));
    expect(screen.getByLabelText(/nueva contraseña/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirmar contraseña/i)).toBeInTheDocument();
  });

  it('formulario inicia con aria-busy false', async () => {
    mockGetUser.mockResolvedValue(makeUser());
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /restablecer contraseña/i }));
    const form = screen.getByRole('dialog').querySelector('form');
    expect(form).not.toHaveAttribute('aria-busy', 'true');
  });
});

describe('UserDetailPage — Modal: Avisos según rol', () => {
  it('responsable muestra aviso temporal', async () => {
    mockGetUser.mockResolvedValue(makeUser({ role: 'responsible' }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /restablecer contraseña/i }));
    expect(screen.getByRole('note').textContent).toContain('contraseña será temporal');
  });

  it('aviso responsable no contiene la contraseña', async () => {
    mockGetUser.mockResolvedValue(makeUser({ role: 'responsible' }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /restablecer contraseña/i }));
    fireEvent.change(screen.getByLabelText(/nueva contraseña/i), { target: { value: 'ClaveTemporal987!' } });
    expect(screen.getByRole('note').textContent).not.toContain('ClaveTemporal987!');
  });

  it('technician muestra activación inmediata', async () => {
    mockGetUser.mockResolvedValue(makeUser({ role: 'technician' }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /restablecer contraseña/i }));
    expect(screen.getByRole('note').textContent).toContain('activa inmediatamente');
  });

  it('technician no muestra obligación de cambio', async () => {
    mockGetUser.mockResolvedValue(makeUser({ role: 'technician' }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /restablecer contraseña/i }));
    expect(screen.getByRole('note').textContent).not.toContain('cambiar');
  });
});

describe('UserDetailPage — Modal: Validación', () => {
  it('contraseña vacía', async () => {
    mockGetUser.mockResolvedValue(makeUser());
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /restablecer contraseña/i }));
    fireEvent.click(screen.getByRole('button', { name: /restablecer$/i }));
    await waitFor(() => { expect(screen.getByRole('alert').textContent).toContain('8 y 128'); });
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it('solamente espacios', async () => {
    mockGetUser.mockResolvedValue(makeUser());
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /restablecer contraseña/i }));
    fireEvent.change(screen.getByLabelText(/nueva contraseña/i), { target: { value: '        ' } });
    fireEvent.click(screen.getByRole('button', { name: /restablecer$/i }));
    await waitFor(() => { expect(screen.getByRole('alert').textContent).toContain('8 y 128'); });
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it('menor de 8', async () => {
    mockGetUser.mockResolvedValue(makeUser());
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /restablecer contraseña/i }));
    fireEvent.change(screen.getByLabelText(/nueva contraseña/i), { target: { value: '1234567' } });
    fireEvent.click(screen.getByRole('button', { name: /restablecer$/i }));
    await waitFor(() => { expect(screen.getByRole('alert').textContent).toContain('8 y 128'); });
  });

  it('mayor de 128', async () => {
    mockGetUser.mockResolvedValue(makeUser());
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /restablecer contraseña/i }));
    fireEvent.change(screen.getByLabelText(/nueva contraseña/i), { target: { value: 'a'.repeat(129) } });
    fireEvent.click(screen.getByRole('button', { name: /restablecer$/i }));
    await waitFor(() => { expect(screen.getByRole('alert').textContent).toContain('8 y 128'); });
  });

  it('confirmación diferente', async () => {
    mockGetUser.mockResolvedValue(makeUser());
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /restablecer contraseña/i }));
    fireEvent.change(screen.getByLabelText(/nueva contraseña/i), { target: { value: 'password1' } });
    fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), { target: { value: 'password2' } });
    fireEvent.click(screen.getByRole('button', { name: /restablecer$/i }));
    await waitFor(() => { expect(screen.getByRole('alert').textContent).toContain('no coinciden'); });
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it('controles permanecen habilitados tras error local', async () => {
    mockGetUser.mockResolvedValue(makeUser());
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /restablecer contraseña/i }));
    fireEvent.click(screen.getByRole('button', { name: /restablecer$/i }));
    await waitFor(() => { expect(screen.getByRole('alert')).toBeInTheDocument(); });
    expect(screen.getByLabelText(/nueva contraseña/i)).not.toBeDisabled();
    expect(screen.getByLabelText(/confirmar contraseña/i)).not.toBeDisabled();
  });
});

describe('UserDetailPage — Modal: Envío', () => {
  it('llama resetPassword con id correcto', async () => {
    mockResetPassword.mockResolvedValue(undefined);
    mockGetUser.mockResolvedValue(makeUser());
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /restablecer contraseña/i }));
    fireEvent.change(screen.getByLabelText(/nueva contraseña/i), { target: { value: 'password1' } });
    fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), { target: { value: 'password1' } });
    fireEvent.click(screen.getByRole('button', { name: /restablecer$/i }));
    await waitFor(() => { expect(mockResetPassword).toHaveBeenCalledWith('u1', 'password1'); });
  });

  it('conserva exactamente la contraseña', async () => {
    mockResetPassword.mockResolvedValue(undefined);
    mockGetUser.mockResolvedValue(makeUser());
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /restablecer contraseña/i }));
    fireEvent.change(screen.getByLabelText(/nueva contraseña/i), { target: { value: '  ClaveConEspacios  ' } });
    fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), { target: { value: '  ClaveConEspacios  ' } });
    fireEvent.click(screen.getByRole('button', { name: /restablecer$/i }));
    await waitFor(() => { expect(mockResetPassword).toHaveBeenCalledWith('u1', '  ClaveConEspacios  '); });
  });

  it('doble clic genera una llamada', async () => {
    const def = deferred<void>();
    mockResetPassword.mockReturnValue(def.promise);
    mockGetUser.mockResolvedValue(makeUser());
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /restablecer contraseña/i }));
    fireEvent.change(screen.getByLabelText(/nueva contraseña/i), { target: { value: 'password1' } });
    fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), { target: { value: 'password1' } });
    const submitBtn = screen.getByRole('button', { name: /restablecer$/i });
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);
    expect(mockResetPassword).toHaveBeenCalledTimes(1);
    def.resolve(undefined);
  });

  it('bloqueo durante deferred', async () => {
    const def = deferred<void>();
    mockResetPassword.mockReturnValue(def.promise);
    mockGetUser.mockResolvedValue(makeUser());
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /restablecer contraseña/i }));
    fireEvent.change(screen.getByLabelText(/nueva contraseña/i), { target: { value: 'password1' } });
    fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), { target: { value: 'password1' } });
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);
    await waitFor(() => {
      expect(screen.getByLabelText(/nueva contraseña/i)).toBeDisabled();
      expect(screen.getByLabelText(/confirmar contraseña/i)).toBeDisabled();
      expect(screen.getByRole('button', { name: /cancelar/i })).toBeDisabled();
      const dialog = screen.getByRole('dialog');
      const submitBtn = dialog.querySelector('button[type="submit"]');
      expect(submitBtn).toBeDisabled();
      expect(submitBtn?.textContent).toContain('Restableciendo');
    });
    def.resolve(undefined);
  });
});

describe('UserDetailPage — Modal: Éxito responsable', () => {
  it('mensaje específico y cambio pendiente', async () => {
    mockResetPassword.mockResolvedValue(undefined);
    mockGetUser.mockResolvedValue(makeUser({ role: 'responsible', must_change_password: false }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /restablecer contraseña/i }));
    fireEvent.change(screen.getByLabelText(/nueva contraseña/i), { target: { value: 'password1' } });
    fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), { target: { value: 'password1' } });
    mockGetUser.mockResolvedValue(makeUser({ role: 'responsible', must_change_password: true }));
    fireEvent.click(screen.getByRole('button', { name: /restablecer$/i }));
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain('temporal');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByText('Cambio pendiente')).toBeInTheDocument();
    });
    expect(screen.queryByLabelText(/nueva contraseña/i)).not.toBeInTheDocument();
  });
});

describe('UserDetailPage — Modal: Éxito otro rol', () => {
  it('mensaje genérico y No aplica', async () => {
    mockResetPassword.mockResolvedValue(undefined);
    mockGetUser.mockResolvedValue(makeUser({ role: 'technician' }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /restablecer contraseña/i }));
    fireEvent.change(screen.getByLabelText(/nueva contraseña/i), { target: { value: 'password1' } });
    fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), { target: { value: 'password1' } });
    fireEvent.click(screen.getByRole('button', { name: /restablecer$/i }));
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain('restablecida correctamente');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByText('No aplica')).toBeInTheDocument();
    });
  });
});

describe('UserDetailPage — Modal: Error remoto', () => {
  it('error conserva modal y valores', async () => {
    mockResetPassword.mockRejectedValueOnce(new Error('RPC falló'));
    mockGetUser.mockResolvedValue(makeUser());
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /restablecer contraseña/i }));
    fireEvent.change(screen.getByLabelText(/nueva contraseña/i), { target: { value: 'password1' } });
    fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), { target: { value: 'password1' } });
    fireEvent.click(screen.getByRole('button', { name: /restablecer$/i }));
    await waitFor(() => {
      expect(screen.getByText('RPC falló')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByLabelText(/nueva contraseña/i)).toHaveValue('password1');
      expect(screen.getByLabelText(/confirmar contraseña/i)).toHaveValue('password1');
      expect(screen.getByLabelText(/nueva contraseña/i)).not.toBeDisabled();
    });
    expect(mockGetUser).toHaveBeenCalledTimes(1);
  });
});

describe('UserDetailPage — Modal: Cancelación', () => {
  it('cancelar limpia campos y error', async () => {
    mockGetUser.mockResolvedValue(makeUser());
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /restablecer contraseña/i }));
    // Submit without entering password to trigger validation error
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);
    await waitFor(() => { expect(screen.getByRole('alert')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /cancelar$/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /restablecer contraseña/i }));
    expect(screen.getByLabelText(/nueva contraseña/i)).toHaveValue('');
    expect(screen.getByLabelText(/confirmar contraseña/i)).toHaveValue('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('UserDetailPage — Modal: Concurrencia', () => {
  it('reset bloquea toggle', async () => {
    const def = deferred<void>();
    mockResetPassword.mockReturnValue(def.promise);
    mockGetUser.mockResolvedValue(makeUser({ active: true }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /restablecer contraseña/i }));
    fireEvent.change(screen.getByLabelText(/nueva contraseña/i), { target: { value: 'password1' } });
    fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), { target: { value: 'password1' } });
    fireEvent.click(screen.getByRole('button', { name: /restablecer$/i }));
    fireEvent.click(screen.getByRole('button', { name: /desactivar/i }));
    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(mockResetPassword).toHaveBeenCalledTimes(1);
    def.resolve(undefined);
  });

  it('reset bloquea guardado', async () => {
    const def = deferred<void>();
    mockResetPassword.mockReturnValue(def.promise);
    mockGetUser.mockResolvedValue(makeUser());
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /restablecer contraseña/i }));
    fireEvent.change(screen.getByLabelText(/nueva contraseña/i), { target: { value: 'password1' } });
    fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), { target: { value: 'password1' } });
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);
    // Editar should be disabled during resetting
    expect(screen.getByRole('button', { name: /editar/i })).toBeDisabled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
    def.resolve(undefined);
  });

  it('toggle bloquea apertura del modal', async () => {
    const def = deferred<void>();
    mockUpdateUser.mockReturnValue(def.promise);
    mockGetUser.mockResolvedValue(makeUser({ active: true }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Activo')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /desactivar/i }));
    fireEvent.click(screen.getByRole('button', { name: /restablecer contraseña/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    def.resolve(undefined);
  });
});

describe('UserDetailPage — Sin datos sensibles', () => {
  it('contraseña no aparece en mensajes visibles', async () => {
    mockResetPassword.mockResolvedValue(undefined);
    mockGetUser.mockResolvedValue(makeUser());
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /restablecer contraseña/i }));
    fireEvent.change(screen.getByLabelText(/nueva contraseña/i), { target: { value: 'ClaveTemporal987!' } });
    fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), { target: { value: 'ClaveTemporal987!' } });
    fireEvent.click(screen.getByRole('button', { name: /restablecer$/i }));
    await waitFor(() => { expect(screen.getByRole('status')).toBeInTheDocument(); });
    const body = document.body.textContent || '';
    expect(body).not.toContain('ClaveTemporal987!');
  });
});

describe('UserDetailPage — Separación de roles: selector staff', () => {
  it('technician: selector contiene Administrador', async () => {
    mockGetUser.mockResolvedValue(makeUser({ role: 'technician' }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    const options = Array.from(screen.getByLabelText(/^rol/i).querySelectorAll('option')).map((o) => o.value);
    expect(options).toContain('admin');
  });

  it('technician: selector contiene Supervisor', async () => {
    mockGetUser.mockResolvedValue(makeUser({ role: 'technician' }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    const options = Array.from(screen.getByLabelText(/^rol/i).querySelectorAll('option')).map((o) => o.value);
    expect(options).toContain('supervisor');
  });

  it('technician: selector contiene Técnico', async () => {
    mockGetUser.mockResolvedValue(makeUser({ role: 'technician' }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    const options = Array.from(screen.getByLabelText(/^rol/i).querySelectorAll('option')).map((o) => o.value);
    expect(options).toContain('technician');
  });

  it('technician: selector no contiene Responsable', async () => {
    mockGetUser.mockResolvedValue(makeUser({ role: 'technician' }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    const options = Array.from(screen.getByLabelText(/^rol/i).querySelectorAll('option')).map((o) => o.value);
    expect(options).not.toContain('responsible');
  });
});

describe('UserDetailPage — Separación de roles: responsible', () => {
  it('al editar no aparece selector de rol', async () => {
    mockGetUser.mockResolvedValue(makeUser({ role: 'responsible' }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    expect(screen.queryByLabelText(/^rol/i)).not.toBeInTheDocument();
  });

  it('aparece texto Responsable de edificio', async () => {
    mockGetUser.mockResolvedValue(makeUser({ role: 'responsible' }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    expect(screen.getByText('Responsable de edificio')).toBeInTheDocument();
  });

  it('aparece texto sobre gestión desde Responsables de edificios', async () => {
    mockGetUser.mockResolvedValue(makeUser({ role: 'responsible' }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    expect(screen.getByText(/El rol y las asignaciones se gestionan desde Responsables de edificios/i)).toBeInTheDocument();
  });

  it('guardar llama updateUser con solo full_name', async () => {
    mockUpdateUser.mockResolvedValue(undefined);
    mockGetUser.mockResolvedValue(makeUser({ role: 'responsible', full_name: 'Original' }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Original')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: 'Nombre corregido' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /guardar/i })); });
    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith('u1', { full_name: 'Nombre corregido' });
    });
  });

  it('guardar no incluye role', async () => {
    mockUpdateUser.mockResolvedValue(undefined);
    mockGetUser.mockResolvedValue(makeUser({ role: 'responsible' }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /guardar/i })); });
    await waitFor(() => { expect(mockUpdateUser).toHaveBeenCalledTimes(1); });
    const payload = mockUpdateUser.mock.calls[0][1];
    expect(payload).not.toHaveProperty('role');
  });

  it('guardar technician sigue enviando full_name y role', async () => {
    mockUpdateUser.mockResolvedValue(undefined);
    mockGetUser.mockResolvedValue(makeUser({ role: 'technician' }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: 'Nuevo' } });
    fireEvent.change(screen.getByLabelText(/^rol/i), { target: { value: 'admin' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /guardar/i })); });
    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith('u1', { full_name: 'Nuevo', role: 'admin' });
    });
  });

  it('activar/desactivar responsable sigue funcionando', async () => {
    mockUpdateUser.mockResolvedValue(undefined);
    mockGetUser.mockResolvedValue(makeUser({ role: 'responsible', active: true }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Activo')).toBeInTheDocument(); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /desactivar/i })); });
    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith('u1', { active: false });
      expect(screen.getByRole('status').textContent).toContain('desactivado correctamente');
    });
  });

  it('reset de contraseña responsable sigue funcionando', async () => {
    mockResetPassword.mockResolvedValue(undefined);
    mockGetUser.mockResolvedValue(makeUser({ role: 'responsible', must_change_password: false }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /restablecer contraseña/i }));
    fireEvent.change(screen.getByLabelText(/nueva contraseña/i), { target: { value: 'password1' } });
    fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), { target: { value: 'password1' } });
    mockGetUser.mockResolvedValue(makeUser({ role: 'responsible', must_change_password: true }));
    fireEvent.click(screen.getByRole('button', { name: /restablecer$/i }));
    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith('u1', 'password1');
      expect(screen.getByRole('status').textContent).toContain('temporal');
    });
  });

  it('operaciones concurrentes continúan protegidas para responsible', async () => {
    const def = deferred<void>();
    mockUpdateUser.mockReturnValue(def.promise);
    mockGetUser.mockResolvedValue(makeUser({ role: 'responsible', active: true }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /editar/i }));
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    fireEvent.click(screen.getByRole('button', { name: /desactivar/i }));
    expect(mockUpdateUser).toHaveBeenCalledTimes(1);
    def.resolve(undefined);
    mockGetUser.mockResolvedValue(makeUser({ role: 'responsible' }));
    await waitFor(() => { expect(screen.getByText('Test User')).toBeInTheDocument(); });
  });
});

describe('UserDetailPage — Mensaje real de Edge Function', () => {
  const MSG = 'Antes de desactivar este responsable, reasigná sus ascensores a otro responsable.';

  it('conflicto muestra el mensaje exacto', async () => {
    mockUpdateUser.mockRejectedValue(new Error(MSG));
    mockGetUser.mockResolvedValue(makeUser({ full_name: 'Adriana Forquera', role: 'responsible', active: true }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Adriana Forquera')).toBeInTheDocument(); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /desactivar/i })); });
    await waitFor(() => { expect(screen.getByText(MSG)).toBeInTheDocument(); });
  });

  it('no muestra Edge Function returned a non-2xx status code', async () => {
    mockUpdateUser.mockRejectedValue(new Error(MSG));
    mockGetUser.mockResolvedValue(makeUser({ full_name: 'Adriana Forquera', role: 'responsible', active: true }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Adriana Forquera')).toBeInTheDocument(); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /desactivar/i })); });
    await waitFor(() => { expect(screen.getByText(MSG)).toBeInTheDocument(); });
    expect(screen.queryByText(/Edge Function returned/)).not.toBeInTheDocument();
  });

  it('Adriana continua Activa', async () => {
    mockUpdateUser.mockRejectedValue(new Error(MSG));
    mockGetUser.mockResolvedValue(makeUser({ full_name: 'Adriana Forquera', role: 'responsible', active: true }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Activo')).toBeInTheDocument(); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /desactivar/i })); });
    await waitFor(() => { expect(screen.getByText(MSG)).toBeInTheDocument(); });
    expect(screen.getByText('Activo')).toBeInTheDocument();
  });

  it('no muestra exito', async () => {
    mockUpdateUser.mockRejectedValue(new Error(MSG));
    mockGetUser.mockResolvedValue(makeUser({ full_name: 'Adriana Forquera', role: 'responsible', active: true }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Adriana Forquera')).toBeInTheDocument(); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /desactivar/i })); });
    await waitFor(() => { expect(screen.getByText(MSG)).toBeInTheDocument(); });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('error de accion no muestra Reintentar', async () => {
    mockUpdateUser.mockRejectedValue(new Error(MSG));
    mockGetUser.mockResolvedValue(makeUser({ full_name: 'Adriana Forquera', role: 'responsible', active: true }));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Adriana Forquera')).toBeInTheDocument(); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /desactivar/i })); });
    await waitFor(() => { expect(screen.getByText(MSG)).toBeInTheDocument(); });
    expect(screen.queryByRole('button', { name: /reintentar/i })).not.toBeInTheDocument();
  });

  it('error inicial de carga si mantiene Reintentar', async () => {
    mockGetUser.mockRejectedValue(new Error('Falló la carga'));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Falló la carga')).toBeInTheDocument(); });
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
  });
});
