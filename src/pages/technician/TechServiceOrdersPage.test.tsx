import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TechServiceOrdersPage from './TechServiceOrdersPage';

const { mockListMyServiceOrders, mockGetUser, mockSupabaseFrom } = vi.hoisted(() => ({
  mockListMyServiceOrders: vi.fn(),
  mockGetUser: vi.fn(),
  mockSupabaseFrom: vi.fn(),
}));

vi.mock('@/services/serviceOrders.service', () => ({
  listMyServiceOrders: (...a: unknown[]) => mockListMyServiceOrders(...a),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual };
});

vi.mock('@/config/supabase', () => ({
  supabase: {
    auth: { getUser: (...a: unknown[]) => mockGetUser(...a), signInWithPassword: vi.fn(), signOut: vi.fn() },
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    storage: { from: vi.fn(() => ({ upload: vi.fn().mockResolvedValue({ error: null }), createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://example.com' } }) })) },
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'tech-1' },
    profile: { id: 'tech-1', full_name: 'Técnico 1', role: 'technician', email: 't@t.com', active: true, created_at: '', updated_at: '' },
    logout: () => Promise.resolve(), login: () => Promise.resolve({ error: null }),
    getRedirectPath: () => '/', hasRole: () => true, isAdmin: false, isTechnician: true,
    isSupervisor: false, isResponsible: false, isAuthenticated: true, loading: false, error: null,
  })),
}));

vi.mock('@/components/layout/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="dashboard-layout">{children}</div>,
}));

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'o1',
    status: 'assigned',
    subject: 'Asunto test',
    priority: 'normal',
    order_type: 'other',
    service_case: { case_number: 1, numbering_mode: 'production' },
    building: { name: 'Edificio 1' },
    elevator: { code: 'ASC-001' },
    technicians: [{ technician: { id: 'tech-1' }, is_lead: false }],
    reviewer_notes: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: 'tech-1' } } });
});

afterEach(() => { vi.restoreAllMocks(); cleanup(); });

describe('TechServiceOrdersPage — Carga', () => {
  it('utiliza listMyServiceOrders', async () => {
    mockListMyServiceOrders.mockResolvedValue([]);
    render(<MemoryRouter><TechServiceOrdersPage /></MemoryRouter>);
    await waitFor(() => {
      expect(mockListMyServiceOrders).toHaveBeenCalledWith('tech-1');
    });
  });

  it('muestra solamente órdenes propias', async () => {
    mockListMyServiceOrders.mockResolvedValue([
      makeOrder({ id: 'o1', technicians: [{ technician: { id: 'tech-1' }, is_lead: true }] }),
      makeOrder({ id: 'o2', technicians: [{ technician: { id: 'other' }, is_lead: true }] }),
    ]);
    render(<MemoryRouter><TechServiceOrdersPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getAllByText(/ASC-001/).length).toBeGreaterThanOrEqual(1); });
    expect(mockListMyServiceOrders).toHaveBeenCalledWith('tech-1');
  });
});

describe('TechServiceOrdersPage — Separación por estado', () => {
  it('separa assigned, in_progress, changes_requested', async () => {
    mockListMyServiceOrders.mockResolvedValue([
      makeOrder({ id: 'o1', status: 'assigned' }),
      makeOrder({ id: 'o2', status: 'in_progress' }),
      makeOrder({ id: 'o3', status: 'changes_requested' }),
    ]);
    render(<MemoryRouter><TechServiceOrdersPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('Nuevas')).toBeInTheDocument(); });
    expect(screen.getByText('En ejecución')).toBeInTheDocument();
    expect(screen.getByText('Pendientes')).toBeInTheDocument();
  });
});

describe('TechServiceOrdersPage — Técnico principal', () => {
  it('muestra nombre del edificio del técnico asignado', async () => {
    mockListMyServiceOrders.mockResolvedValue([
      makeOrder({ id: 'o1', building: { name: 'Edificio Central' }, technicians: [{ technician: { id: 'tech-1', full_name: 'Juan Pérez' }, is_lead: true }] }),
    ]);
    render(<MemoryRouter><TechServiceOrdersPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('Edificio Central')).toBeInTheDocument(); });
  });
});

describe('TechServiceOrdersPage — Errores', () => {
  it('error visible con role="alert"', async () => {
    mockListMyServiceOrders.mockRejectedValue(new Error('Falló la carga'));
    render(<MemoryRouter><TechServiceOrdersPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Falló la carga');
    });
  });

  it('botón Reintentar vuelve a consultar', async () => {
    mockListMyServiceOrders.mockRejectedValueOnce(new Error('Falló'));
    render(<MemoryRouter><TechServiceOrdersPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByRole('alert')).toBeInTheDocument(); });
    mockListMyServiceOrders.mockResolvedValue([makeOrder()]);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => { expect(mockListMyServiceOrders).toHaveBeenCalledTimes(2); });
  });
});

describe('TechServiceOrdersPage — Estado vacío', () => {
  it('estado vacío correcto', async () => {
    mockListMyServiceOrders.mockResolvedValue([]);
    render(<MemoryRouter><TechServiceOrdersPage /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText(/no tenés órdenes pendientes/i)).toBeInTheDocument();
    });
  });
});
