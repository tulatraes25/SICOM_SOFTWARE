import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ServiceOrderDetailPage from './ServiceOrderDetailPage';

const { mockGetServiceOrder, mockMarkReady, mockAssignTechnicians, mockCancelOrder, mockApproveOrder, mockRequestCorrections, mockGetOrderEvents, mockGetOrderProgress, mockAddProgress, mockGenerateOrderPDF, mockGetOrderPDFUrl, mockNavigate, mockSupabaseFrom } = vi.hoisted(() => ({
  mockGetServiceOrder: vi.fn(),
  mockMarkReady: vi.fn(),
  mockAssignTechnicians: vi.fn(),
  mockCancelOrder: vi.fn(),
  mockApproveOrder: vi.fn(),
  mockRequestCorrections: vi.fn(),
  mockGetOrderEvents: vi.fn(),
  mockGetOrderProgress: vi.fn(),
  mockAddProgress: vi.fn(),
  mockGenerateOrderPDF: vi.fn(),
  mockGetOrderPDFUrl: vi.fn(),
  mockNavigate: vi.fn(),
  mockSupabaseFrom: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate, useParams: () => ({ id: 'order-1' }) };
});

vi.mock('@/services/serviceOrders.service', () => ({
  getServiceOrder: (...a: unknown[]) => mockGetServiceOrder(...a),
  markReady: (...a: unknown[]) => mockMarkReady(...a),
  assignTechnicians: (...a: unknown[]) => mockAssignTechnicians(...a),
  cancelOrder: (...a: unknown[]) => mockCancelOrder(...a),
  approveOrder: (...a: unknown[]) => mockApproveOrder(...a),
  requestCorrections: (...a: unknown[]) => mockRequestCorrections(...a),
  getOrderEvents: (...a: unknown[]) => mockGetOrderEvents(...a),
  getOrderProgress: (...a: unknown[]) => mockGetOrderProgress(...a),
  addProgress: (...a: unknown[]) => mockAddProgress(...a),
  generateOrderPDF: (...a: unknown[]) => mockGenerateOrderPDF(...a),
  getOrderPDFUrl: (...a: unknown[]) => mockGetOrderPDFUrl(...a),
}));

vi.mock('@react-pdf/renderer', () => ({
  pdf: vi.fn().mockResolvedValue({ toBlob: vi.fn().mockResolvedValue({ arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)) }) }),
  Document: 'div', Page: 'div', Text: 'div', View: 'div', StyleSheet: { create: (s: unknown) => s }, Image: 'img',
}));

vi.mock('@/components/serviceOrders/SendOrderEmailModal', () => ({
  default: vi.fn(() => <div data-testid="email-modal" />),
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

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    status: 'draft',
    subject: 'Asunto test',
    priority: 'normal',
    order_type: 'other',
    client_id: 'c1',
    building_id: 'b1',
    elevator_id: 'e1',
    order_date: '2026-01-15',
    work_requested: 'Trabajo solicitado test',
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
  mockGetOrderEvents.mockResolvedValue([]);
  mockGetOrderProgress.mockResolvedValue([]);
  mockGenerateOrderPDF.mockResolvedValue(undefined);
  mockGetOrderPDFUrl.mockResolvedValue('https://example.com/pdf');
  mockSupabaseFrom.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [{ id: 't1', full_name: 'Técnico 1' }], error: null }),
  });
});

afterEach(() => { vi.restoreAllMocks(); cleanup(); });

async function renderWithOrder(orderOverrides: Record<string, unknown> = {}) {
  const order = makeOrder(orderOverrides);
  mockGetServiceOrder.mockResolvedValue(order);
  render(<MemoryRouter><ServiceOrderDetailPage /></MemoryRouter>);
  await waitFor(() => { expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument(); });
  return order;
}

describe('ServiceOrderDetailPage — Draft', () => {
  it('draft muestra Marcar Listo', async () => {
    await renderWithOrder({ status: 'draft' });
    expect(screen.getByRole('button', { name: /marcar listo/i })).toBeInTheDocument();
  });

  it('draft muestra Asignar Técnicos', async () => {
    await renderWithOrder({ status: 'draft' });
    expect(screen.getByRole('button', { name: /asignar técnicos/i })).toBeInTheDocument();
  });
});

describe('ServiceOrderDetailPage — Ready', () => {
  it('ready muestra Asignar Técnicos', async () => {
    await renderWithOrder({ status: 'ready' });
    expect(screen.getByRole('button', { name: /asignar técnicos/i })).toBeInTheDocument();
  });
});

describe('ServiceOrderDetailPage — Assigned', () => {
  it('assigned permite editar asignación', async () => {
    await renderWithOrder({
      status: 'assigned',
      technicians: [{ technician: { id: 't1', full_name: 'Técnico 1' }, is_lead: true }],
    });
    expect(screen.getByRole('button', { name: /asignar técnicos/i })).toBeInTheDocument();
  });
});

describe('ServiceOrderDetailPage — In progress', () => {
  it('in_progress no muestra Asignar Técnicos', async () => {
    await renderWithOrder({ status: 'in_progress' });
    expect(screen.queryByRole('button', { name: /asignar técnicos/i })).not.toBeInTheDocument();
  });
});

describe('ServiceOrderDetailPage — Completed', () => {
  it('completed no muestra botones de acción principales', async () => {
    await renderWithOrder({ status: 'completed' });
    expect(screen.queryByRole('button', { name: /marcar listo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /asignar técnicos/i })).not.toBeInTheDocument();
  });
});

describe('ServiceOrderDetailPage — Approved', () => {
  it('approved muestra Generar PDF', async () => {
    await renderWithOrder({ status: 'approved' });
    expect(screen.getByRole('button', { name: /generar pdf/i })).toBeInTheDocument();
  });
});

describe('ServiceOrderDetailPage — Cancelled', () => {
  it('cancelled no muestra botones de acción', async () => {
    await renderWithOrder({ status: 'cancelled' });
    expect(screen.queryByRole('button', { name: /marcar listo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /asignar técnicos/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /aprobar/i })).not.toBeInTheDocument();
  });
});

describe('ServiceOrderDetailPage — completion_summary', () => {
  it('completion_summary visible cuando existe', async () => {
    await renderWithOrder({ status: 'completed', completion_summary: 'Trabajo realizado exitosamente' });
    expect(screen.getByText('Trabajo realizado exitosamente')).toBeInTheDocument();
  });
});

describe('ServiceOrderDetailPage — reviewer_notes', () => {
  it('reviewer_notes visible cuando existe', async () => {
    await renderWithOrder({ status: 'completed', reviewer_notes: 'Revisado y aprobado' });
    expect(screen.getByText('Revisado y aprobado')).toBeInTheDocument();
  });
});
