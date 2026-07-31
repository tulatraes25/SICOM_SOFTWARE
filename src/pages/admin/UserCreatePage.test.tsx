import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
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
function submitForm() { fireEvent.submit(document.querySelector('form')!); }
function fillForm(name: string, email: string, pw: string) {
  fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: name } });
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/^contraseña \*/i), { target: { value: pw } });
  fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), { target: { value: pw } });
}

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { vi.useRealTimers(); cleanup(); vi.restoreAllMocks(); });

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
    submitForm();
    expect(screen.getByText('El nombre es obligatorio')).toBeInTheDocument();
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it('nombre solo con espacios', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: '   ' } });
    submitForm();
    expect(screen.getByText('El nombre es obligatorio')).toBeInTheDocument();
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it('email vacío', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: 'Test' } });
    submitForm();
    expect(screen.getByText('Ingresá un email válido')).toBeInTheDocument();
  });

  it('email inválido', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'noemail' } });
    submitForm();
    expect(screen.getByText('Ingresá un email válido')).toBeInTheDocument();
  });

  it('email con espacios', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a @b.com' } });
    submitForm();
    expect(screen.getByText('Ingresá un email válido')).toBeInTheDocument();
  });

  it('contraseña menor de 8', () => {
    renderPage();
    fillForm('Test', 'a@b.com', '1234567');
    submitForm();
    expect(screen.getByText('La contraseña debe tener entre 8 y 128 caracteres')).toBeInTheDocument();
  });

  it('contraseña mayor de 128', () => {
    renderPage();
    fillForm('Test', 'a@b.com', 'a'.repeat(129));
    submitForm();
    expect(screen.getByText('La contraseña debe tener entre 8 y 128 caracteres')).toBeInTheDocument();
  });

  it('contraseña solo con espacios', () => {
    renderPage();
    fillForm('Test', 'a@b.com', '        ');
    submitForm();
    expect(screen.getByText('La contraseña debe tener entre 8 y 128 caracteres')).toBeInTheDocument();
  });

  it('contraseñas distintas', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText(/^contraseña \*/i), { target: { value: 'password1' } });
    fireEvent.change(screen.getByLabelText(/confirmar contraseña/i), { target: { value: 'password2' } });
    submitForm();
    expect(screen.getByText('Las contraseñas no coinciden')).toBeInTheDocument();
  });

  it('createUser no se llama en cada error', () => {
    renderPage();
    submitForm();
    expect(mockCreateUser).not.toHaveBeenCalled();
  });
});

describe('UserCreatePage — Normalización', () => {
  it('envía full_name con trim, email con trim y minúsculas, password exacto, role tipado', async () => {
    mockCreateUser.mockResolvedValue({ id: 'new-1' });
    renderPage();
    fillForm('  Juan Pérez  ', '  Juan@EXAMPLE.com  ', 'mypass123');
    submitForm();
    await waitFor(() => {
      expect(mockCreateUser).toHaveBeenCalledWith({
        email: 'juan@example.com', password: 'mypass123', full_name: 'Juan Pérez', role: 'technician',
      });
    });
  });

  it('no envía campos adicionales', async () => {
    mockCreateUser.mockResolvedValue({ id: 'new-2' });
    renderPage();
    fillForm('Test', 't@t.com', 'password1');
    submitForm();
    await waitFor(() => {
      expect(Object.keys(mockCreateUser.mock.calls[0][0])).toEqual(['email', 'password', 'full_name', 'role']);
    });
  });
});

describe('UserCreatePage — createUser nunca recibe responsible', () => {
  it('no envía role responsible', async () => {
    mockCreateUser.mockResolvedValue({ id: 't-1' });
    renderPage();
    fillForm('Tech', 't@t.com', 'password1');
    submitForm();
    await waitFor(() => {
      expect(mockCreateUser).toHaveBeenCalledTimes(1);
      const call = mockCreateUser.mock.calls[0][0];
      expect(call.role).not.toBe('responsible');
    });
  });
});

describe('UserCreatePage — Éxito', () => {
  it('mensaje genérico', async () => {
    mockCreateUser.mockResolvedValue({ id: 't-1' });
    renderPage();
    fillForm('Tech', 't@t.com', 'password1');
    submitForm();
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain('Usuario creado correctamente');
    });
  });
});

describe('UserCreatePage — Carga y doble envío', () => {
  it('dos clics producen una sola llamada', async () => {
    const def = deferred<{ id: string }>();
    mockCreateUser.mockReturnValue(def.promise);
    renderPage();
    fillForm('Test', 't@t.com', 'password1');
    submitForm();
    submitForm();
    expect(mockCreateUser).toHaveBeenCalledTimes(1);
    def.resolve({ id: 'new-1' });
    await waitFor(() => { expect(mockNavigate).toHaveBeenCalled(); });
  });

  it('tras error se reintentar', async () => {
    mockCreateUser.mockRejectedValueOnce(new Error('Falló'));
    renderPage();
    fillForm('Test', 't@t.com', 'password1');
    submitForm();
    await waitFor(() => {
      expect(screen.getByText('Falló')).toBeInTheDocument();
      expect(screen.getByLabelText(/nombre completo/i)).not.toBeDisabled();
    });
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
});

describe('UserCreatePage — Sin responsable', () => {
  it('no aparece aviso de contraseña temporal', () => {
    renderPage();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });
});
