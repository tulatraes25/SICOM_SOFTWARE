import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LoginPage from './LoginPage';

const { mockLogin, mockGetRedirectPath } = vi.hoisted(() => ({
  mockLogin: vi.fn(),
  mockGetRedirectPath: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    login: (...a: unknown[]) => mockLogin(...a),
    loading: false,
    isAuthenticated: false,
    getRedirectPath: () => mockGetRedirectPath(),
  }),
}));

function renderPage(initialEntries: string[] = ['/login']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/cambiar-contrasena-obligatoria" element={<div>Change Password</div>} />
        <Route path="/responsable" element={<div>Responsible Dashboard</div>} />
        <Route path="/admin" element={<div>Admin Dashboard</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetRedirectPath.mockReturnValue('/responsable');
});

describe('LoginPage', () => {
  it('credenciales erróneas muestran error', async () => {
    mockLogin.mockResolvedValue({ error: 'Invalid credentials' });
    renderPage();
    fireEvent.change(screen.getByLabelText(/correo/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'pass1234' } });
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => { expect(screen.getByText('Invalid credentials')).toBeInTheDocument(); });
  });

  it('responsable temporal redirige a ruta obligatoria', async () => {
    mockLogin.mockResolvedValue({ error: null, profile: { must_change_password: true } });
    mockGetRedirectPath.mockReturnValue('/cambiar-contrasena-obligatoria');
    renderPage();
    fireEvent.change(screen.getByLabelText(/correo/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'pass1234' } });
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => { expect(screen.getByText('Change Password')).toBeInTheDocument(); });
  });

  it('responsable actualizado redirige a /responsable', async () => {
    mockLogin.mockResolvedValue({ error: null, profile: { must_change_password: false } });
    mockGetRedirectPath.mockReturnValue('/responsable');
    renderPage();
    fireEvent.change(screen.getByLabelText(/correo/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'pass1234' } });
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => { expect(screen.getByText('Responsible Dashboard')).toBeInTheDocument(); });
  });

  it('usuario inactivo muestra mensaje exacto', async () => {
    mockLogin.mockResolvedValue({ error: 'Tu usuario está inactivo. Contactá al administrador.' });
    renderPage();
    fireEvent.change(screen.getByLabelText(/correo/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'pass1234' } });
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => { expect(screen.getByText('Tu usuario está inactivo. Contactá al administrador.')).toBeInTheDocument(); });
  });

  it('aviso de contraseña actualizada aparece', async () => {
    renderPage(['/login']);
    // Inject state via MemoryRouter
    const { unmount } = render(
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { passwordChanged: true } }]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText(/Contraseña actualizada correctamente/)).toBeInTheDocument();
    unmount();
  });

  it('aviso usa role status', () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { passwordChanged: true } }]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByRole('status')).toHaveTextContent(/Contraseña actualizada correctamente/);
  });

  it('doble submit produce un solo login', async () => {
    let resolveLogin!: (v: unknown) => void;
    mockLogin.mockReturnValue(new Promise((r) => { resolveLogin = r; }));
    renderPage();
    const user = userEvent.setup();
    fireEvent.change(screen.getByLabelText(/correo/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'pass1234' } });
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));
    expect(mockLogin).toHaveBeenCalledTimes(1);
    resolveLogin({ error: null, profile: { must_change_password: false } });
  });

  it('botón permanece bloqueado durante login', async () => {
    let resolveLogin!: (v: unknown) => void;
    mockLogin.mockReturnValue(new Promise((r) => { resolveLogin = r; }));
    renderPage();
    fireEvent.change(screen.getByLabelText(/correo/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'pass1234' } });
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => { expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeDisabled(); });
    resolveLogin({ error: null, profile: { must_change_password: false } });
  });

  it('no registra contraseñas en el DOM', () => {
    renderPage();
    const pwInput = screen.getByLabelText(/contraseña$/i);
    expect(pwInput).toHaveAttribute('type', 'password');
  });

  it('texto actualizado de Supabase Auth', () => {
    renderPage();
    expect(screen.getByText('Las cuentas son administradas por SICOM Patagonia.')).toBeInTheDocument();
    expect(screen.queryByText(/Los usuarios deben ser creados desde el panel de Supabase Auth/)).not.toBeInTheDocument();
  });
});
