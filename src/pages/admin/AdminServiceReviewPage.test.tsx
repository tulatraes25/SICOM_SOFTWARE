import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminServiceReviewPage from './AdminServiceReviewPage';

interface Deferred<T> { promise: Promise<T>; resolve: (value: T) => void; }
function deferred<T>(): Deferred<T> { let resolve!: (value: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; }

const { mockListPending, mockListApproved, mockListServiceOrders } = vi.hoisted(() => ({
  mockListPending: vi.fn(),
  mockListApproved: vi.fn(),
  mockListServiceOrders: vi.fn(),
}));

vi.mock('@/services/supervisor.service', () => ({
  listPendingServiceRecords: () => mockListPending(),
  listApprovedServiceRecords: () => mockListApproved(),
}));
vi.mock('@/services/serviceOrders.service', () => ({
  listServiceOrders: (...args: unknown[]) => mockListServiceOrders(...args),
}));
vi.mock('@/components/layout/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const maintenanceItem = { id: 'm1', status: 'submitted', elevator: { code: 'ASC-0001', building: { name: 'Edificio Central', client: { name: 'Cliente A' } } } };
const orderItem = { id: 'o1', status: 'completed', service_case: { case_number: 1914, numbering_mode: 'test' }, client: { name: 'Cliente B' }, building: { name: 'Edificio B' }, elevator: { code: 'ASC-002' } };

function renderPage() {
  return render(<MemoryRouter><AdminServiceReviewPage /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockListPending.mockResolvedValue([maintenanceItem]);
  mockListServiceOrders.mockResolvedValue({ data: [orderItem], count: 1 });
  mockListApproved.mockResolvedValue([]);
});
afterEach(() => { vi.restoreAllMocks(); cleanup(); });

describe('AdminServiceReviewPage', () => {
  it('abre por defecto en Pendientes', async () => {
    renderPage();
    await waitFor(() => { expect(screen.getByText('Pendientes')).toBeInTheDocument(); });
    expect(mockListPending).toHaveBeenCalledTimes(1);
    expect(mockListApproved).not.toHaveBeenCalled();
  });

  it('Pendientes llama listServiceOrders con status completed', async () => {
    renderPage();
    await waitFor(() => { expect(mockListServiceOrders).toHaveBeenCalledWith({ status: 'completed' }); });
  });

  it('muestra badge Mantenimiento', async () => {
    renderPage();
    await waitFor(() => { expect(screen.getByText('Mantenimiento')).toBeInTheDocument(); });
  });

  it('muestra badge Orden', async () => {
    renderPage();
    await waitFor(() => { expect(screen.getByText('Orden')).toBeInTheDocument(); });
  });

  it('mantenimiento muestra ASC-0001', async () => {
    renderPage();
    await waitFor(() => { expect(screen.getAllByText('ASC-0001').length).toBeGreaterThanOrEqual(1); });
  });

  it('orden muestra PRUEBA N.º 1914', async () => {
    renderPage();
    await waitFor(() => { expect(screen.getByText('PRUEBA N.º 1914')).toBeInTheDocument(); });
  });

  it('mantenimiento enlaza a /admin/mantenimientos/m1', async () => {
    renderPage();
    await waitFor(() => { expect(screen.getByText('Mantenimiento')).toBeInTheDocument(); });
    const links = screen.getAllByRole('link');
    expect(links.some(l => l.getAttribute('href') === '/admin/mantenimientos/m1')).toBe(true);
  });

  it('orden enlaza a /admin/ordenes-servicio/o1', async () => {
    renderPage();
    await waitFor(() => { expect(screen.getByText('Orden')).toBeInTheDocument(); });
    const links = screen.getAllByRole('link');
    expect(links.some(l => l.getAttribute('href') === '/admin/ordenes-servicio/o1')).toBe(true);
  });

  it('pestaña Aprobados llama listApprovedServiceRecords', async () => {
    renderPage();
    await waitFor(() => { expect(screen.getByText('Pendientes')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Aprobados'));
    await waitFor(() => { expect(mockListApproved).toHaveBeenCalledTimes(1); });
  });

  it('Aprobados llama listServiceOrders con status approved', async () => {
    renderPage();
    fireEvent.click(screen.getByText('Aprobados'));
    await waitFor(() => { expect(mockListServiceOrders).toHaveBeenCalledWith({ status: 'approved' }); });
  });

  it('lista pendiente vacía muestra el mensaje correcto', async () => {
    mockListPending.mockResolvedValue([]);
    mockListServiceOrders.mockResolvedValue({ data: [], count: 0 });
    renderPage();
    await waitFor(() => { expect(screen.getByText('No hay elementos pendientes de revisión')).toBeInTheDocument(); });
  });

  it('lista aprobada vacía muestra el mensaje correcto', async () => {
    mockListPending.mockResolvedValue([]);
    mockListServiceOrders.mockResolvedValue({ data: [], count: 0 });
    renderPage();
    fireEvent.click(screen.getByText('Aprobados'));
    await waitFor(() => { expect(screen.getByText('No hay elementos aprobados')).toBeInTheDocument(); });
  });

  it('error muestra role=alert', async () => {
    mockListPending.mockRejectedValue(new Error('fail'));
    renderPage();
    await waitFor(() => { expect(screen.getByRole('alert')).toBeInTheDocument(); });
  });

  it('error limpia los resultados anteriores', async () => {
    mockListPending.mockRejectedValue(new Error('fail'));
    renderPage();
    await waitFor(() => { expect(screen.getByRole('alert')).toBeInTheDocument(); });
    expect(screen.queryByText('ASC-0001')).not.toBeInTheDocument();
  });

  it('botón Reintentar vuelve a consultar', async () => {
    mockListPending.mockRejectedValueOnce(new Error('fail'));
    renderPage();
    await waitFor(() => { expect(screen.getByRole('alert')).toBeInTheDocument(); });
    mockListPending.mockResolvedValue([maintenanceItem]);
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    await waitFor(() => { expect(screen.getAllByText('ASC-0001').length).toBeGreaterThanOrEqual(1); });
  });

  it('reintento correcto elimina el error', async () => {
    mockListPending.mockRejectedValueOnce(new Error('fail'));
    renderPage();
    await waitFor(() => { expect(screen.getByRole('alert')).toBeInTheDocument(); });
    mockListPending.mockResolvedValue([maintenanceItem]);
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    await waitFor(() => { expect(screen.queryByRole('alert')).not.toBeInTheDocument(); });
  });

  it('cambio rápido Pendientes → Aprobados ignora la respuesta antigua', async () => {
    const def1 = deferred<void>();
    const def2 = deferred<void>();
    mockListPending.mockReturnValueOnce(def1.promise);
    mockListServiceOrders.mockReturnValueOnce(def2.promise);
    renderPage();
    mockListPending.mockResolvedValue([maintenanceItem]);
    mockListServiceOrders.mockResolvedValue({ data: [orderItem], count: 1 });
    fireEvent.click(screen.getByText('Aprobados'));
    def1.resolve();
    def2.resolve();
    await waitFor(() => { expect(screen.queryByText('ASC-0001')).not.toBeInTheDocument(); });
  });

  it('cambio rápido Aprobados → Pendientes ignora la respuesta antigua', async () => {
    const def1 = deferred<void>();
    const def2 = deferred<void>();
    mockListApproved.mockReturnValueOnce(def1.promise);
    mockListServiceOrders.mockReturnValueOnce(def2.promise);
    renderPage();
    await waitFor(() => { expect(screen.getByText('Pendientes')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Aprobados'));
    mockListPending.mockResolvedValue([maintenanceItem]);
    mockListServiceOrders.mockResolvedValue({ data: [orderItem], count: 1 });
    fireEvent.click(screen.getByText('Pendientes'));
    def1.resolve();
    def2.resolve();
    await waitFor(() => { expect(screen.getAllByText('ASC-0001').length).toBeGreaterThanOrEqual(1); });
  });
});
