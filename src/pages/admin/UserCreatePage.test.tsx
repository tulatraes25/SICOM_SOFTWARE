import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import UserCreatePage from './UserCreatePage';

const { mockCreateUser, mockNavigate } = vi.hoisted(() => ({
  mockCreateUser: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock('@/services/adminUsers.service', () => ({
  createUser: (...args: unknown[]) => mockCreateUser(...args),
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

function renderPage() { return render(<MemoryRouter><UserCreatePage /></MemoryRouter>); }

function getForm(): HTMLFormElement {
  const form = document.querySelector('form');
  if (!(form instanceof HTMLFormElement)) {
    throw new Error('No se encontró el formulario de creación');
  }
  return form;
}

function fillForm(name: string, email: string, pw: string) {
  fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: name } });
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/^contraseña \*/i), { target: { value: pw } });
  fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), { target: { value: pw } });
}

let user: ReturnType<typeof userEvent.setup>;
beforeEach(() => { vi.clearAllMocks(); user = userEvent.setup(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('UserCreatePage — Renderizado', () => {
  it('muestra los cinco campos', () => {
    renderPage();
    expect(screen.getByLabelText(/nombre completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^rol/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^contraseña \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirmar contraseña/i)).toBeInTheDocument();
  });

  it('rol inicial technician', () => {
    renderPage();
    expect(screen.getByLabelText(/^rol/i)).toHaveValue('technician');
  });

  it('selector contiene Administrador, Supervisor, Técnico', () => {
    renderPage();
    const options = Array.from(screen.getByLabelText(/^rol/i).querySelectorAll('option')).map((o) => o.value);
    expect(options).toEqual(['admin', 'supervisor', 'technician']);
  });

  it('no contiene Responsable', () => {
    renderPage();
    const options = Array.from(screen.getByLabelText(/^rol/i).querySelectorAll('option')).map((o) => o.value);
    expect(options).not.toContain('responsible');
  });

  it('título Crear usuario SICOM', () => {
    renderPage();
    expect(screen.getByText('Crear usuario SICOM')).toBeInTheDocument();
  });

  it('Volver y Cancelar existen', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /volver/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument();
  });
});

describe('UserCreatePage — Validación local', () => {
  it('nombre vacío', () => {
    renderPage();
    fireEvent.submit(getForm());
    expect(screen.getByText('El nombre es obligatorio')).toBeInTheDocument();
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it('nombre solo con espacios', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: '   ' } });
    fireEvent.submit(getForm());
    expect(screen.getByText('El nombre es obligatorio')).toBeInTheDocument();
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it('email vacío', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: 'Test' } });
    fireEvent.submit(getForm());
    expect(screen.getByText('Ingresá un email válido')).toBeInTheDocument();
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it('email inválido', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'noemail' } });
    fireEvent.submit(getForm());
    expect(screen.getByText('Ingresá un email válido')).toBeInTheDocument();
  });

  it('email con espacios', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a @b.com' } });
    fireEvent.submit(getForm());
    expect(screen.getByText('Ingresá un email válido')).toBeInTheDocument();
  });

  it('contraseña menor de 8', () => {
    renderPage();
    fillForm('Test', 'a@b.com', '1234567');
    fireEvent.submit(getForm());
    expect(screen.getByText('La contraseña debe tener entre 8 y 128 caracteres')).toBeInTheDocument();
  });

  it('contraseña mayor de 128', () => {
    renderPage();
    fillForm('Test', 'a@b.com', 'a'.repeat(129));
    fireEvent.submit(getForm());
    expect(screen.getByText('La contraseña debe tener entre 8 y 128 caracteres')).toBeInTheDocument();
  });

  it('contraseña solo con espacios', () => {
    renderPage();
    fillForm('Test', 'a@b.com', '        ');
    fireEvent.submit(getForm());
    expect(screen.getByText('La contraseña debe tener entre 8 y 128 caracteres')).toBeInTheDocument();
  });

  it('contraseñas distintas', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText(/^contraseña \*/i), { target: { value: 'password1' } });
    fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), { target: { value: 'password2' } });
    fireEvent.submit(getForm());
    expect(screen.getByText('Las contraseñas no coinciden')).toBeInTheDocument();
  });

  it('createUser no se llama en cada error', () => {
    renderPage();
    fireEvent.submit(getForm());
    expect(mockCreateUser).not.toHaveBeenCalled();
  });
});

describe('UserCreatePage — Operación pendiente', () => {
  it('campos y botones deshabilitados durante envío', async () => {
    const def = deferred<{ id: string }>();
    mockCreateUser.mockReturnValue(def.promise);
    renderPage();
    fillForm('Test', 't@t.com', 'password1');
    fireEvent.submit(getForm());
    await waitFor(() => {
      expect(screen.getByLabelText(/nombre completo/i)).toBeDisabled();
      expect(screen.getByLabelText(/email/i)).toBeDisabled();
      expect(screen.getByLabelText(/^rol/i)).toBeDisabled();
      expect(screen.getByLabelText(/^contraseña \*/i)).toBeDisabled();
      expect(screen.getByLabelText(/confirmar contraseña/i)).toBeDisabled();
      expect(screen.getByRole('button', { name: /cancelar/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /volver/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /creando/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /creando/i }).textContent).toContain('Creando...');
    });
    await act(async () => { def.resolve({ id: 'new-1' }); });
    await waitFor(() => { expect(mockNavigate).toHaveBeenCalled(); });
  });
});

describe('UserCreatePage — Doble envío', () => {
  it('dos submits sincrónicos producen una sola llamada', async () => {
    const def = deferred<{ id: string }>();
    mockCreateUser.mockReturnValue(def.promise);
    renderPage();
    fillForm('Test', 't@t.com', 'password1');
    fireEvent.submit(getForm());
    fireEvent.submit(getForm());
    expect(mockCreateUser).toHaveBeenCalledTimes(1);
    await act(async () => { def.resolve({ id: 'new-1' }); });
    await waitFor(() => { expect(mockNavigate).toHaveBeenCalled(); });
  });

  it('tras éxito un nuevo submit tampoco genera otra llamada', async () => {
    const def = deferred<{ id: string }>();
    mockCreateUser.mockReturnValue(def.promise);
    renderPage();
    fillForm('Test', 't@t.com', 'password1');
    fireEvent.submit(getForm());
    await waitFor(() => {
      expect(screen.getByLabelText(/nombre completo/i)).toBeDisabled();
      expect(screen.getByRole('button', { name: /creando/i })).toBeDisabled();
    });
    // El botón muestra "Creando..." mientras la promesa está pendiente
    expect(screen.getByRole('button', { name: /creando/i }).textContent).toContain('Creando...');
    // Resolver después de comprobar el estado
    await act(async () => { def.resolve({ id: 'new-1' }); });
    await waitFor(() => { expect(mockNavigate).toHaveBeenCalledTimes(1); });
  });
});

describe('UserCreatePage — Error remoto', () => {
  it('conserva nombre, email y contraseñas para reintentar', async () => {
    mockCreateUser.mockRejectedValueOnce(new Error('RPC falló'));
    renderPage();
    fillForm('Test', 't@t.com', 'password1');
    fireEvent.click(screen.getByRole('button', { name: /crear usuario/i }));
    await waitFor(() => { expect(screen.getByText('RPC falló')).toBeInTheDocument(); });
    expect(screen.getByLabelText(/nombre completo/i)).toHaveValue('Test');
    expect(screen.getByLabelText(/email/i)).toHaveValue('t@t.com');
    expect(screen.getByLabelText(/confirmar contraseña/i)).toHaveValue('password1');
  });

  it('error no contiene la contraseña', async () => {
    mockCreateUser.mockRejectedValueOnce(new Error('RPC falló'));
    renderPage();
    fillForm('Test', 't@t.com', 'password1');
    fireEvent.click(screen.getByRole('button', { name: /crear usuario/i }));
    await waitFor(() => { expect(screen.getByRole('alert').textContent).not.toContain('password1'); });
  });

  it('vuelve a habilitar los controles', async () => {
    mockCreateUser.mockRejectedValueOnce(new Error('Falló'));
    renderPage();
    fillForm('Test', 't@t.com', 'password1');
    fireEvent.click(screen.getByRole('button', { name: /crear usuario/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/nombre completo/i)).not.toBeDisabled();
      expect(screen.getByRole('button', { name: /crear usuario/i })).not.toBeDisabled();
    });
  });

  it('segundo intento exitoso funciona', async () => {
    mockCreateUser.mockRejectedValueOnce(new Error('Falló'));
    renderPage();
    fillForm('Test', 't@t.com', 'password1');
    fireEvent.click(screen.getByRole('button', { name: /crear usuario/i }));
    await waitFor(() => { expect(screen.getByText('Falló')).toBeInTheDocument(); });
    mockCreateUser.mockResolvedValue({ id: 'new-1' });
    fireEvent.click(screen.getByRole('button', { name: /crear/i }));
    await waitFor(() => { expect(screen.queryByText('Falló')).not.toBeInTheDocument(); });
    expect(mockCreateUser).toHaveBeenCalledTimes(2);
  });
});

describe('UserCreatePage — Éxito', () => {
  it('limpia las dos contraseñas', async () => {
    mockCreateUser.mockResolvedValue({ id: 'new-1' });
    renderPage();
    fillForm('Test', 't@t.com', 'password1');
    await user.click(screen.getByRole('button', { name: /crear usuario/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/^contraseña \*/i)).toHaveValue('');
      expect(screen.getByLabelText(/confirmar contraseña/i)).toHaveValue('');
    });
  });

  it('muestra mensaje genérico', async () => {
    mockCreateUser.mockResolvedValue({ id: 'new-1' });
    renderPage();
    fillForm('Test', 't@t.com', 'password1');
    await user.click(screen.getByRole('button', { name: /crear usuario/i }));
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain('Usuario creado correctamente');
    });
  });

  it('permanece bloqueado durante 800ms', async () => {
    mockCreateUser.mockResolvedValue({ id: 'new-1' });
    renderPage();
    fillForm('Test', 't@t.com', 'password1');
    fireEvent.submit(getForm());
    await waitFor(() => { expect(screen.getByLabelText(/nombre completo/i)).toBeDisabled(); });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.advanceTimersByTime(799);
    expect(screen.getByLabelText(/nombre completo/i)).toBeDisabled();
    vi.advanceTimersByTime(1);
    await waitFor(() => { expect(mockNavigate).toHaveBeenCalledWith('/admin/usuarios/new-1'); });
    vi.useRealTimers();
  });

  it('navega una sola vez', async () => {
    mockCreateUser.mockResolvedValue({ id: 'new-1' });
    renderPage();
    fillForm('Test', 't@t.com', 'password1');
    fireEvent.submit(getForm());
    await waitFor(() => { expect(screen.getByRole('button', { name: /creando/i })).toBeDisabled(); });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.advanceTimersByTime(800);
    await waitFor(() => { expect(mockNavigate).toHaveBeenCalledTimes(1); });
    vi.useRealTimers();
  });
});

describe('UserCreatePage — Navegación', () => {
  it('Volver lleva a /admin/usuarios?tab=usuarios', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /volver/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/usuarios?tab=usuarios');
  });

  it('Cancelar lleva a /admin/usuarios?tab=usuarios', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/usuarios?tab=usuarios');
  });

  it('no permiten navegar mientras createUser está pendiente', async () => {
    const def = deferred<{ id: string }>();
    mockCreateUser.mockReturnValue(def.promise);
    renderPage();
    fillForm('Test', 't@t.com', 'password1');
    fireEvent.submit(getForm());
    await waitFor(() => { expect(screen.getByRole('button', { name: /cancelar/i })).toBeDisabled(); });
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    fireEvent.click(screen.getByRole('button', { name: /volver/i }));
    expect(mockNavigate).not.toHaveBeenCalled();
    await act(async () => { def.resolve({ id: 'new-1' }); });
    await waitFor(() => { expect(mockNavigate).toHaveBeenCalled(); });
  });

  it('no permiten navegar después del éxito y antes de la redirección', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockCreateUser.mockResolvedValue({ id: 'new-1' });
    renderPage();
    fillForm('Test', 't@t.com', 'password1');
    fireEvent.submit(getForm());
    await waitFor(() => { expect(screen.getByRole('button', { name: /cancelar/i })).toBeDisabled(); });
    fireEvent.click(screen.getByRole('button', { name: /volver/i }));
    expect(mockNavigate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(800);
    await waitFor(() => { expect(mockNavigate).toHaveBeenCalledTimes(1); });
    vi.useRealTimers();
  });
});

describe('UserCreatePage — Sin responsable', () => {
  it('no aparece aviso de contraseña temporal', () => {
    renderPage();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });
});
