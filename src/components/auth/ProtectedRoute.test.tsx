import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';

const mockUseAuth = vi.fn();

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

function renderWithAuth(_authValue: ReturnType<typeof vi.fn>['mock']['results'][number]['value'], options: { path?: string; allowPasswordChangeRequired?: boolean } = {}) {
  const { path = '/admin', allowPasswordChangeRequired } = options;
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/cambiar-contrasena-obligatoria" element={<div>Change Password Page</div>} />
        <Route path="/responsable" element={<div>Responsible Dashboard</div>} />
        <Route path="/admin" element={
          <ProtectedRoute allowPasswordChangeRequired={allowPasswordChangeRequired}>
            <div>Protected Content</div>
          </ProtectedRoute>
        } />
        <Route path="/admin/clientes" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <div>Admin Clients</div>
          </ProtectedRoute>
        } />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => { vi.clearAllMocks(); });

describe('ProtectedRoute', () => {
  it('no autenticado → /login', () => {
    mockUseAuth.mockReturnValue({ user: null, profile: null, loading: false, isAuthenticated: false, logout: vi.fn() });
    renderWithAuth(null);
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('responsable activo sin cambio pendiente entra', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u1' }, profile: { role: 'responsible', active: true, must_change_password: false },
      loading: false, isAuthenticated: true, logout: vi.fn(),
    });
    renderWithAuth(null);
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('responsable con cambio pendiente es redirigido', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u1' }, profile: { role: 'responsible', active: true, must_change_password: true },
      loading: false, isAuthenticated: true, logout: vi.fn(),
    });
    renderWithAuth(null);
    expect(screen.getByText('Change Password Page')).toBeInTheDocument();
  });

  it('admin con cambio pendiente también es redirigido', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u1' }, profile: { role: 'admin', active: true, must_change_password: true },
      loading: false, isAuthenticated: true, logout: vi.fn(),
    });
    renderWithAuth(null);
    expect(screen.getByText('Change Password Page')).toBeInTheDocument();
  });

  it('ruta obligatoria permite must_change_password=true', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u1' }, profile: { role: 'responsible', active: true, must_change_password: true },
      loading: false, isAuthenticated: true, logout: vi.fn(),
    });
    renderWithAuth(null, { path: '/admin', allowPasswordChangeRequired: true });
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('ruta obligatoria rechaza must_change_password=false', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u1' }, profile: { role: 'responsible', active: true, must_change_password: false },
      loading: false, isAuthenticated: true, logout: vi.fn(),
    });
    renderWithAuth(null, { path: '/admin', allowPasswordChangeRequired: true });
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('perfil inactivo no renderiza children', () => {
    const mockLogout = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      user: { id: 'u1' }, profile: { role: 'responsible', active: false, must_change_password: false },
      loading: false, isAuthenticated: true, logout: mockLogout,
    });
    renderWithAuth(null);
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('perfil inactivo provoca cierre de sesión', () => {
    const mockLogout = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      user: { id: 'u1' }, profile: { role: 'responsible', active: false, must_change_password: false },
      loading: false, isAuthenticated: true, logout: mockLogout,
    });
    renderWithAuth(null);
    expect(mockLogout).toHaveBeenCalled();
  });

  it('loading muestra Cargando sesión', () => {
    mockUseAuth.mockReturnValue({ user: null, profile: null, loading: true, isAuthenticated: false, logout: vi.fn() });
    renderWithAuth(null);
    expect(screen.getByText('Cargando sesión...')).toBeInTheDocument();
  });

  it('allowedRoles se aplica después del password gate', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u1' }, profile: { role: 'technician', active: true, must_change_password: false },
      loading: false, isAuthenticated: true, logout: vi.fn(),
    });
    renderWithAuth(null, { path: '/admin/clientes' });
    expect(screen.getByText('Acceso No Autorizado')).toBeInTheDocument();
  });
});
