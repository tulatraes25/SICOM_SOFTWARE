import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ServiceOrderCreatePage from './ServiceOrderCreatePage';

const { mockNavigate, mockCreateServiceOrder, mockSupabaseFrom } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockCreateServiceOrder: vi.fn(),
  mockSupabaseFrom: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/services/serviceOrders.service', () => ({
  createServiceOrder: (...a: unknown[]) => mockCreateServiceOrder(...a),
}));

vi.mock('@/config/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn(), signInWithPassword: vi.fn(), signOut: vi.fn() },
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    storage: { from: vi.fn(() => ({ upload: vi.fn().mockResolvedValue({ error: null }), createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://example.com' } }) })) },
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'admin1' },
    profile: { id: 'admin1', full_name: 'Admin', role: 'admin', email: 'a@a.com', active: true, created_at: '', updated_at: '' },
    logout: () => Promise.resolve(), login: () => Promise.resolve({ error: null }),
    getRedirectPath: () => '/', hasRole: () => true, isAdmin: true, isTechnician: false,
    isSupervisor: false, isResponsible: false, isAuthenticated: true, loading: false, error: null,
  })),
}));

vi.mock('@/components/layout/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="dashboard-layout">{children}</div>,
}));

function chainWithData(data: unknown = [], error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data, error }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateServiceOrder.mockResolvedValue({ order_id: 'new-order', service_case_id: 'sc1', case_number: 1, numbering_mode: 'production', status: 'draft' });
  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === 'clients') return chainWithData([{ id: 'c1', name: 'Cliente 1', code: 'C1' }]);
    if (table === 'buildings') return chainWithData([{ id: 'b1', name: 'Edificio 1', code: 'B1' }]);
    if (table === 'elevators') return chainWithData([{ id: 'e1', code: 'ASC-001' }]);
    return chainWithData([]);
  });
});

afterEach(() => { vi.restoreAllMocks(); cleanup(); });

function renderPage() {
  return render(<MemoryRouter><ServiceOrderCreatePage /></MemoryRouter>);
}

function getTextarea() {
  return document.querySelector('form textarea') as HTMLTextAreaElement;
}

async function fillAllFields(overrides: { asunto?: string; trabajo?: string } = {}) {
  await waitFor(() => { expect(screen.getByText('Cliente 1')).toBeInTheDocument(); });
  const selects = screen.getAllByRole('combobox');
  fireEvent.change(selects[0], { target: { value: 'c1' } });
  await waitFor(() => { expect(screen.getByText('Edificio 1')).toBeInTheDocument(); });
  fireEvent.change(selects[1], { target: { value: 'b1' } });
  await waitFor(() => { expect(screen.getByText('ASC-001')).toBeInTheDocument(); });
  fireEvent.change(selects[2], { target: { value: 'e1' } });
  fireEvent.change(screen.getByPlaceholderText(/resumen de la orden/i), { target: { value: overrides.asunto ?? 'Asunto' } });
  const textarea = getTextarea();
  fireEvent.change(textarea, { target: { value: overrides.trabajo ?? 'Trabajo' } });
  return { form: textarea.closest('form')!, textarea };
}

function fillPartial(overrides: { asunto?: string; trabajo?: string } = {}) {
  const selects = screen.getAllByRole('combobox');
  fireEvent.change(selects[0], { target: { value: 'c1' } });
  fireEvent.change(screen.getByPlaceholderText(/resumen de la orden/i), { target: { value: overrides.asunto ?? 'Asunto' } });
  const textarea = getTextarea();
  fireEvent.change(textarea, { target: { value: overrides.trabajo ?? 'Trabajo' } });
  return { form: textarea.closest('form')!, textarea };
}

describe('ServiceOrderCreatePage — Validación obligatoria', () => {
  it('submit sin ascensor muestra error', async () => {
    renderPage();
    await waitFor(() => { expect(screen.getByText('Cliente 1')).toBeInTheDocument(); });
    const { form } = fillPartial();
    fireEvent.submit(form);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/ascensor/i);
    });
    expect(mockCreateServiceOrder).not.toHaveBeenCalled();
  });

  it('submit sin asunto muestra error', async () => {
    renderPage();
    await waitFor(() => { expect(screen.getByText('Cliente 1')).toBeInTheDocument(); });
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Edificio 1')).toBeInTheDocument(); });
    fireEvent.change(selects[1], { target: { value: 'b1' } });
    await waitFor(() => { expect(screen.getByText('ASC-001')).toBeInTheDocument(); });
    fireEvent.change(selects[2], { target: { value: 'e1' } });
    const textarea = getTextarea();
    fireEvent.change(textarea, { target: { value: 'Trabajo solicitado' } });
    const form = textarea.closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/asunto/i);
    });
    expect(mockCreateServiceOrder).not.toHaveBeenCalled();
  });
});

describe('ServiceOrderCreatePage — Edificio bloqueado', () => {
  it('edificio bloqueado hasta cliente', async () => {
    renderPage();
    await waitFor(() => { expect(screen.getByText('Cliente 1')).toBeInTheDocument(); });
    const selects = screen.getAllByRole('combobox');
    expect(selects[1]).toBeDisabled();
  });
});

describe('ServiceOrderCreatePage — Ascensor bloqueado', () => {
  it('ascensor bloqueado hasta edificio', async () => {
    renderPage();
    await waitFor(() => { expect(screen.getByText('Cliente 1')).toBeInTheDocument(); });
    const selects = screen.getAllByRole('combobox');
    expect(selects[2]).toBeDisabled();
  });
});

describe('ServiceOrderCreatePage — Submit válido', () => {
  it('llama createServiceOrder una vez', async () => {
    renderPage();
    const { form } = await fillAllFields({ asunto: 'Asunto test', trabajo: 'Trabajo solicitado test' });
    await act(async () => { fireEvent.submit(form); });
    expect(mockCreateServiceOrder).toHaveBeenCalledTimes(1);
  });

  it('doble clic genera una sola llamada', async () => {
    renderPage();
    const { form } = await fillAllFields({ asunto: 'Asunto', trabajo: 'Trabajo solicitado' });
    await act(async () => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });
    expect(mockCreateServiceOrder).toHaveBeenCalledTimes(1);
  });

  it('navega inmediatamente al detalle', async () => {
    renderPage();
    const { form } = await fillAllFields({ asunto: 'Asunto', trabajo: 'Trabajo solicitado' });
    await act(async () => { fireEvent.submit(form); });
    expect(mockNavigate).toHaveBeenCalledWith('/admin/ordenes-servicio/new-order', { replace: true });
  });
});

describe('ServiceOrderCreatePage — Errores de carga', () => {
  it('error visible al fallar carga de clientes', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'clients') return chainWithData(null, { message: 'fail' });
      return chainWithData([]);
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Error al cargar clientes/);
    });
  });

  it('error visible al fallar carga de edificios', async () => {
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'clients') return chainWithData([{ id: 'c1', name: 'Cliente 1', code: 'C1' }]);
      if (table === 'buildings') return chainWithData(null, { message: 'fail' });
      return chainWithData([]);
    });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Cliente 1')).toBeInTheDocument(); });
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'c1' } });
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Error al cargar edificios/);
    });
  });
});
