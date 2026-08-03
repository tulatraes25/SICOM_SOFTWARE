import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SendOrderEmailModal from './SendOrderEmailModal';

const { mockInvoke, mockListServiceOrderRecipients } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockListServiceOrderRecipients: vi.fn(),
}));

vi.mock('@/config/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));

vi.mock('@/services/buildingRecipients.service', () => ({
  listServiceOrderRecipients: (...args: unknown[]) => mockListServiceOrderRecipients(...args),
}));

vi.mock('@/components/layout/DashboardLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  orderId: 'order-1',
  caseNumber: 1914,
  numberingMode: 'test',
  elevatorCode: 'ASC-001',
  buildingName: 'Edificio Test',
  buildingId: 'b1',
  elevatorId: 'e1',
  pdfVersion: 1,
  onSent: vi.fn(),
};

function renderModal(props: Partial<typeof defaultProps> = {}) {
  return render(<MemoryRouter><SendOrderEmailModal {...defaultProps} {...props} /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockListServiceOrderRecipients.mockResolvedValue([
    { id: 'c1', full_name: 'Contacto 1', email: 'c1@test.com' },
  ]);
});

afterEach(() => { vi.restoreAllMocks(); cleanup(); });

describe('SendOrderEmailModal', () => {
  it('no llama mark_budget_sent', async () => {
    mockInvoke.mockResolvedValue({ data: { success: 1, failed: 0, results: [{ email: 'c1@test.com', status: 'sent' }] }, error: null });
    renderModal();
    await waitFor(() => { expect(screen.getByText(/c1@test.com/)).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /enviar$/i }));
    await waitFor(() => { expect(mockInvoke).toHaveBeenCalledTimes(1); });
    const body = mockInvoke.mock.calls[0][1].body;
    expect(body.service_order_id).toBe('order-1');
  });

  it('una sola invocación para varios destinatarios', async () => {
    mockInvoke.mockResolvedValue({ data: { success: 2, failed: 0, results: [{ email: 'c1@test.com', status: 'sent' }, { email: 'extra@test.com', status: 'sent' }] }, error: null });
    mockListServiceOrderRecipients.mockResolvedValue([{ id: 'c1', full_name: 'Contacto 1', email: 'c1@test.com' }]);
    renderModal();
    await waitFor(() => { expect(screen.getByText(/c1@test.com/)).toBeInTheDocument(); });
    fireEvent.change(screen.getByPlaceholderText(/correo/i), { target: { value: 'extra@test.com' } });
    fireEvent.click(screen.getByText('Agregar'));
    fireEvent.click(screen.getByRole('button', { name: /enviar$/i }));
    await waitFor(() => { expect(mockInvoke).toHaveBeenCalledTimes(1); });
  });

  it('envía recipients completos', async () => {
    mockInvoke.mockResolvedValue({ data: { success: 1, failed: 0, results: [{ email: 'c1@test.com', status: 'sent' }] }, error: null });
    renderModal();
    await waitFor(() => { expect(screen.getByText(/c1@test.com/)).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /enviar$/i }));
    await waitFor(() => { expect(mockInvoke).toHaveBeenCalledTimes(1); });
    const body = mockInvoke.mock.calls[0][1].body;
    expect(Array.isArray(body.recipients)).toBe(true);
    expect(body.recipients.length).toBeGreaterThanOrEqual(1);
  });

  it('error de invoke muestra alerta', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('Connection failed') });
    renderModal();
    await waitFor(() => { expect(screen.getByText(/c1@test.com/)).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /enviar$/i }));
    await waitFor(() => { expect(screen.getByText(/Connection failed/)).toBeInTheDocument(); });
  });

  it('error no llama onSent', async () => {
    const onSent = vi.fn();
    mockInvoke.mockResolvedValue({ data: null, error: new Error('fail') });
    renderModal({ onSent });
    await waitFor(() => { expect(screen.getByText(/c1@test.com/)).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /enviar$/i }));
    await waitFor(() => { expect(screen.getByText(/fail/)).toBeInTheDocument(); });
    expect(onSent).not.toHaveBeenCalled();
  });

  it('data inválida muestra error', async () => {
    mockInvoke.mockResolvedValue({ data: { invalid: true }, error: null });
    renderModal();
    await waitFor(() => { expect(screen.getByText(/c1@test.com/)).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /enviar$/i }));
    await waitFor(() => { expect(screen.getByText(/no es válida/)).toBeInTheDocument(); });
  });

  it('success=0 muestra fallo', async () => {
    mockInvoke.mockResolvedValue({ data: { success: 0, failed: 1, results: [{ email: 'c1@test.com', status: 'failed' }] }, error: null });
    renderModal();
    await waitFor(() => { expect(screen.getByText(/c1@test.com/)).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /enviar$/i }));
    await waitFor(() => { expect(screen.getByText(/No se pudo enviar la orden/)).toBeInTheDocument(); });
  });

  it('éxito total muestra mensaje correcto', async () => {
    mockInvoke.mockResolvedValue({ data: { success: 1, failed: 0, results: [{ email: 'c1@test.com', status: 'sent' }] }, error: null });
    renderModal();
    await waitFor(() => { expect(screen.getByText(/c1@test.com/)).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /enviar$/i }));
    await waitFor(() => { expect(screen.getByText(/enviada correctamente a 1 destinatario/)).toBeInTheDocument(); });
  });

  it('éxito parcial muestra cantidades', async () => {
    mockInvoke.mockResolvedValue({ data: { success: 1, failed: 1, results: [{ email: 'c1@test.com', status: 'sent' }, { email: 'x@x.com', status: 'failed' }] }, error: null });
    renderModal();
    await waitFor(() => { expect(screen.getByText(/c1@test.com/)).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /enviar$/i }));
    await waitFor(() => { expect(screen.getByText(/enviada a 1 destinatario.*Fallaron 1/)).toBeInTheDocument(); });
  });

  it('éxito llama onSent', async () => {
    const onSent = vi.fn();
    mockInvoke.mockResolvedValue({ data: { success: 1, failed: 0, results: [{ email: 'c1@test.com', status: 'sent' }] }, error: null });
    renderModal({ onSent });
    await waitFor(() => { expect(screen.getByText(/c1@test.com/)).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /enviar$/i }));
    await waitFor(() => { expect(onSent).toHaveBeenCalled(); });
  });

  it('mock muestra mensaje de prueba', async () => {
    mockInvoke.mockResolvedValue({ data: { success: 1, failed: 0, results: [{ email: 'c1@test.com', status: 'mock' }] }, error: null });
    renderModal();
    await waitFor(() => { expect(screen.getByText(/c1@test.com/)).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /enviar$/i }));
    await waitFor(() => { expect(screen.getByText(/prueba registrado/)).toBeInTheDocument(); });
  });

  it('doble clic genera una sola llamada', async () => {
    mockInvoke.mockResolvedValue({ data: { success: 1, failed: 0, results: [{ email: 'c1@test.com', status: 'sent' }] }, error: null });
    renderModal();
    await waitFor(() => { expect(screen.getByText(/c1@test.com/)).toBeInTheDocument(); });
    const btn = screen.getByRole('button', { name: /enviar$/i });
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => { expect(mockInvoke).toHaveBeenCalledTimes(1); });
  });

  it('sin destinatarios no envía', async () => {
    mockListServiceOrderRecipients.mockResolvedValue([]);
    renderModal();
    await waitFor(() => { expect(screen.queryByText(/c1@test.com/)).not.toBeInTheDocument(); });
    expect(screen.getByRole('button', { name: /enviar$/i })).toBeDisabled();
  });

  it('elimina destinatario adicional correctamente', async () => {
    mockListServiceOrderRecipients.mockResolvedValue([]);
    renderModal();
    await waitFor(() => { expect(screen.queryByText(/c1@test.com/)).not.toBeInTheDocument(); });
    fireEvent.change(screen.getByPlaceholderText(/correo/i), { target: { value: 'test@test.com' } });
    fireEvent.click(screen.getByText('Agregar'));
    await waitFor(() => { expect(screen.getByText(/test@test.com/)).toBeInTheDocument(); });
    const removeButtons = screen.getAllByRole('button').filter(b => b.querySelector('svg'));
    const removeBtn = removeButtons[removeButtons.length - 1];
    fireEvent.click(removeBtn);
    await waitFor(() => { expect(screen.queryByText(/test@test.com/)).not.toBeInTheDocument(); });
  });

  it('correo adicional inválido no se agrega', async () => {
    mockListServiceOrderRecipients.mockResolvedValue([]);
    renderModal();
    await waitFor(() => { expect(screen.queryByText(/c1@test.com/)).not.toBeInTheDocument(); });
    fireEvent.change(screen.getByPlaceholderText(/correo/i), { target: { value: 'invalido' } });
    fireEvent.click(screen.getByText('Agregar'));
    await waitFor(() => { expect(screen.queryByText(/invalido/)).not.toBeInTheDocument(); });
  });
});
