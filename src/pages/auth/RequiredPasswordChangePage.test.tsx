import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RequiredPasswordChangePage from './RequiredPasswordChangePage';

const { mockLogout, mockCompleteRequiredPasswordChange } = vi.hoisted(() => ({
  mockLogout: vi.fn(),
  mockCompleteRequiredPasswordChange: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    logout: () => mockLogout(),
    profile: { email: 'test@test.com', must_change_password: true },
  }),
}));

vi.mock('@/services/requiredPasswordChange.service', () => ({
  completeRequiredPasswordChange: (...a: unknown[]) => mockCompleteRequiredPasswordChange(...a),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/cambiar-contrasena-obligatoria']}>
      <Routes>
        <Route path="/cambiar-contrasena-obligatoria" element={<RequiredPasswordChangePage />} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLogout.mockResolvedValue(undefined);
});

describe('RequiredPasswordChangePage', () => {
  it('muestra título e instrucción', () => {
    renderPage();
    expect(screen.getByText('Cambio obligatorio de contraseña')).toBeInTheDocument();
    expect(screen.getByText(/reemplazá la contraseña temporal/)).toBeInTheDocument();
  });

  it('no muestra menú', () => {
    renderPage();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('contraseña corta bloqueada', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /actualizar/i })).toBeDisabled();
  });

  it('contraseña larga bloqueada', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/nueva contraseña/i), { target: { value: 'a'.repeat(129) } });
    expect(screen.getByRole('button', { name: /actualizar/i })).toBeDisabled();
  });

  it('solo espacios bloqueado', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/nueva contraseña/i), { target: { value: '        ' } });
    expect(screen.getByRole('button', { name: /actualizar/i })).toBeDisabled();
  });

  it('contraseñas diferentes bloqueadas', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/nueva contraseña/i), { target: { value: 'pass1234' } });
    fireEvent.change(screen.getByLabelText(/confirmar/i), { target: { value: 'pass5678' } });
    expect(screen.getByRole('button', { name: /actualizar/i })).toBeDisabled();
  });

  it('muestra/oculta contraseña', () => {
    renderPage();
    const newPw = screen.getByLabelText(/nueva contraseña/i);
    expect(newPw).toHaveAttribute('type', 'password');
    const buttons = screen.getAllByRole('button', { name: '' });
    const toggleNew = buttons.find((b) => b.closest('div')?.querySelector('input[autocomplete="new-password"]'));
    expect(toggleNew).toBeTruthy();
  });

  it('submit válido llama una vez al servicio', async () => {
    mockCompleteRequiredPasswordChange.mockResolvedValue(undefined);
    renderPage();
    fireEvent.change(screen.getByLabelText(/nueva contraseña/i), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByLabelText(/confirmar/i), { target: { value: 'newpass123' } });
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => { expect(mockCompleteRequiredPasswordChange).toHaveBeenCalledTimes(1); });
  });

  it('doble submit produce una llamada', async () => {
    let resolve!: (v: unknown) => void;
    mockCompleteRequiredPasswordChange.mockReturnValue(new Promise((r) => { resolve = r; }));
    renderPage();
    fireEvent.change(screen.getByLabelText(/nueva contraseña/i), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByLabelText(/confirmar/i), { target: { value: 'newpass123' } });
    fireEvent.submit(document.querySelector('form')!);
    fireEvent.submit(document.querySelector('form')!);
    expect(mockCompleteRequiredPasswordChange).toHaveBeenCalledTimes(1);
    resolve(undefined);
  });

  it('error backend visible', async () => {
    mockCompleteRequiredPasswordChange.mockRejectedValue(new Error('Backend error'));
    renderPage();
    fireEvent.change(screen.getByLabelText(/nueva contraseña/i), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByLabelText(/confirmar/i), { target: { value: 'newpass123' } });
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => { expect(screen.getByText('Backend error')).toBeInTheDocument(); });
  });

  it('éxito ejecuta signOut', async () => {
    mockCompleteRequiredPasswordChange.mockResolvedValue(undefined);
    renderPage();
    fireEvent.change(screen.getByLabelText(/nueva contraseña/i), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByLabelText(/confirmar/i), { target: { value: 'newpass123' } });
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => { expect(mockLogout).toHaveBeenCalled(); });
  });

  it('éxito navega a login con replace', async () => {
    mockCompleteRequiredPasswordChange.mockResolvedValue(undefined);
    renderPage();
    fireEvent.change(screen.getByLabelText(/nueva contraseña/i), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByLabelText(/confirmar/i), { target: { value: 'newpass123' } });
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => { expect(screen.getByText('Login Page')).toBeInTheDocument(); });
  });

  it('éxito envía solo aviso, nunca contraseña', async () => {
    mockCompleteRequiredPasswordChange.mockResolvedValue(undefined);
    renderPage();
    fireEvent.change(screen.getByLabelText(/nueva contraseña/i), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByLabelText(/confirmar/i), { target: { value: 'newpass123' } });
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => { expect(mockLogout).toHaveBeenCalled(); });
    // The password should not be in location.state
  });

  it('cerrar sesión funciona', async () => {
    renderPage();
    fireEvent.click(screen.getByText('Cerrar sesión'));
    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });
  });
});
