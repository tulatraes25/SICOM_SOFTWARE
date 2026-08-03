import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TechServiceOrderDetailPage from './TechServiceOrderDetailPage';

const { mockGetServiceOrder, mockStartOrder, mockCompleteOrder, mockAddProgress, mockGetOrderProgress, mockGetOrderEvents, mockNavigate, mockGetUser, mockSupabaseFrom } = vi.hoisted(() => ({
  mockGetServiceOrder: vi.fn(),
  mockStartOrder: vi.fn(),
  mockCompleteOrder: vi.fn(),
  mockAddProgress: vi.fn(),
  mockGetOrderProgress: vi.fn(),
  mockGetOrderEvents: vi.fn(),
  mockNavigate: vi.fn(),
  mockGetUser: vi.fn(),
  mockSupabaseFrom: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate, useParams: () => ({ id: 'order-1' }) };
});

vi.mock('@/services/serviceOrders.service', () => ({
  getServiceOrder: (...a: unknown[]) => mockGetServiceOrder(...a),
  startOrder: (...a: unknown[]) => mockStartOrder(...a),
  completeOrder: (...a: unknown[]) => mockCompleteOrder(...a),
  addProgress: (...a: unknown[]) => mockAddProgress(...a),
  getOrderProgress: (...a: unknown[]) => mockGetOrderProgress(...a),
  getOrderEvents: (...a: unknown[]) => mockGetOrderEvents(...a),
}));

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
    id: 'order-1',
    status: 'assigned',
    subject: 'Asunto test',
    priority: 'normal',
    order_type: 'other',
    client_id: 'c1',
    building_id: 'b1',
    elevator_id: 'e1',
    work_requested: 'Trabajo solicitado',
    completion_summary: null,
    reviewer_notes: null,
    service_case: { case_number: 100, numbering_mode: 'production' },
    client: { name: 'Cliente 1' },
    building: { name: 'Edificio 1' },
    elevator: { code: 'ASC-001' },
    technicians: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  mockGetUser.mockResolvedValue({ data: { user: { id: 'tech-1' } } });
  mockGetOrderProgress.mockResolvedValue([]);
  mockGetOrderEvents.mockResolvedValue([]);
  mockStartOrder.mockResolvedValue(undefined);
  mockCompleteOrder.mockResolvedValue(undefined);
  mockAddProgress.mockResolvedValue(undefined);
  mockSupabaseFrom.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
  });
});

afterEach(() => { vi.restoreAllMocks(); cleanup(); });

async function renderWithOrder(orderOverrides: Record<string, unknown> = {}, techOverrides: Array<Record<string, unknown>> = []) {
  const techs = techOverrides.length > 0 ? techOverrides : [{ technician: { id: 'tech-1', full_name: 'Técnico 1' }, is_lead: true }];
  const order = makeOrder({ technicians: techs, ...orderOverrides });
  mockGetServiceOrder.mockResolvedValue(order);
  render(<MemoryRouter><TechServiceOrderDetailPage /></MemoryRouter>);
  await waitFor(() => { expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument(); });
  return order;
}

describe('TechServiceOrderDetailPage — Lead badge', () => {
  it('no aparece "Sos el técnico principal"', async () => {
    await renderWithOrder({}, [{ technician: { id: 'tech-1', full_name: 'Técnico 1' }, is_lead: true }]);
    expect(screen.queryByText(/sos el técnico principal/i)).not.toBeInTheDocument();
  });
});

describe('TechServiceOrderDetailPage — Acciones por estado', () => {
  it('técnico asignado puede completar', async () => {
    await renderWithOrder({ status: 'in_progress' }, [{ technician: { id: 'tech-1', full_name: 'Técnico 1' }, is_lead: true }]);
    expect(screen.getByRole('button', { name: /completar/i })).toBeInTheDocument();
  });

  it('usuario no asignado no puede completar', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'other-user' } } });
    await renderWithOrder({ status: 'in_progress' }, [{ technician: { id: 'tech-1', full_name: 'Técnico 1' }, is_lead: true }]);
    expect(screen.queryByRole('button', { name: /completar/i })).not.toBeInTheDocument();
  });

  it('assigned permite comenzar', async () => {
    await renderWithOrder({ status: 'assigned' }, [{ technician: { id: 'tech-1', full_name: 'Técnico 1' }, is_lead: true }]);
    expect(screen.getByRole('button', { name: /comenzar trabajo/i })).toBeInTheDocument();
  });

  it('changes_requested permite retomar', async () => {
    await renderWithOrder({ status: 'changes_requested' }, [{ technician: { id: 'tech-1', full_name: 'Técnico 1' }, is_lead: true }]);
    expect(screen.getByRole('button', { name: /retomar/i })).toBeInTheDocument();
  });

  it('in_progress permite registrar avance', async () => {
    await renderWithOrder({ status: 'in_progress' }, [{ technician: { id: 'tech-1', full_name: 'Técnico 1' }, is_lead: true }]);
    expect(screen.getByRole('button', { name: /registrar avance/i })).toBeInTheDocument();
  });

  it('completed no permite nuevas acciones', async () => {
    await renderWithOrder({ status: 'completed' }, [{ technician: { id: 'tech-1', full_name: 'Técnico 1' }, is_lead: true }]);
    expect(screen.queryByRole('button', { name: /comenzar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /registrar avance/i })).not.toBeInTheDocument();
  });
});

describe('TechServiceOrderDetailPage — Validación completar', () => {
  it('completar exige mínimo 5 caracteres', async () => {
    await renderWithOrder({ status: 'in_progress' }, [{ technician: { id: 'tech-1', full_name: 'Técnico 1' }, is_lead: true }]);
    const btn = screen.getByRole('button', { name: /completar/i });
    await act(async () => { fireEvent.click(btn); });
    const textarea = await waitFor(() => {
      const ta = document.querySelector('textarea');
      expect(ta).toBeInTheDocument();
      return ta as HTMLTextAreaElement;
    });
    fireEvent.change(textarea, { target: { value: 'abc' } });
    const confirmBtn = screen.getByRole('button', { name: /confirmar finalización/i });
    expect(confirmBtn).toBeDisabled();
  });
});

describe('TechServiceOrderDetailPage — changes_requested', () => {
  it('observaciones del revisor se muestran en changes_requested', async () => {
    await renderWithOrder(
      { status: 'changes_requested', reviewer_notes: 'Corregir instalación' },
      [{ technician: { id: 'tech-1', full_name: 'Técnico 1' }, is_lead: true }],
    );
    expect(screen.getByText('Corregir instalación')).toBeInTheDocument();
  });
});
