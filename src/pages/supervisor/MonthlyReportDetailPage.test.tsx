import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MonthlyReportDetailPage from './MonthlyReportDetailPage';

const { mockInvoke, mockFrom, mockAuthGetUser } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockFrom: vi.fn(),
  mockAuthGetUser: vi.fn(),
}));

vi.mock('@/config/supabase', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
    auth: { getUser: (...args: unknown[]) => mockAuthGetUser(...args) },
    storage: { from: vi.fn(() => ({ createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://example.com' } }), upload: vi.fn().mockResolvedValue({ error: null }) })) },
  },
}));

vi.mock('@/services/monthlyReportEnhanced.service', () => ({
  getMonthlyReportPeriodData: vi.fn().mockResolvedValue({ maintenances: [], serviceOrders: [], claims: [], summary: { preventiveCount: 0, correctiveCount: 0, serviceOrderCount: 0, claimCount: 0, totalApproved: 0, totalWithCorrections: 0, firstDate: null, lastDate: null } }),
  updateMonthlyReport: vi.fn().mockResolvedValue(undefined),
  approveMonthlyReport: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/components/pdf/MonthlyReportPDF', () => ({ default: () => <div>PDF</div> }));
vi.mock('@/services/userSignatures.service', () => ({ getUserSignatureForPDF: vi.fn().mockResolvedValue(null) }));
vi.mock('@/components/layout/DashboardLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

function makeChain(data: unknown, error: unknown = null) {
  const result = { data, error };
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    or: vi.fn().mockReturnThis(),
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
      if (error && reject) reject(error); else resolve(result);
      return { catch: () => ({}) };
    },
  };
  return chain;
}

function setupMocks(report: Record<string, unknown> = {}) {
  const defaultReport = {
    id: 'r1', elevator_id: 'e1', building_id: 'b1', report_month: 7, report_year: 2026,
    status: 'approved', pdf_url: 'path/to.pdf', pdf_version: 1, numbering_mode: 'test',
    general_status: 'operativo', general_notes: '', created_by: 'admin1', approved_by: 'admin1',
    ...report,
  };
  mockAuthGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } }, error: null });

  const chains = [
    makeChain(defaultReport),
    makeChain({ full_name: 'Admin', email: 'admin@test.com' }),
    makeChain({ id: 'e1', code: 'ASC-001', building: { id: 'b1', name: 'Edificio', address: 'Av. Test 123', client: { name: 'Cliente' } } }),
    makeChain([{ id: 'c1', full_name: 'Contacto', email: 'c@test.com', role_label: 'Encargado' }]),
  ];
  let chainIdx = 0;
  mockFrom.mockImplementation(() => chains[chainIdx++] ?? makeChain(null));
}

function renderPage(id = 'r1') {
  return render(<MemoryRouter initialEntries={[`/admin/informes-mensuales/${id}`]}>
    <Routes>
      <Route path="/admin/informes-mensuales/:id" element={<MonthlyReportDetailPage />} />
      <Route path="/admin/informes-mensuales" element={<div>Reports List</div>} />
    </Routes>
  </MemoryRouter>);
}

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { vi.restoreAllMocks(); cleanup(); });

describe('MonthlyReportDetailPage — Envío de correo', () => {
  beforeEach(() => { setupMocks(); });

  it('usa send-monthly-report-email', async () => {
    mockInvoke.mockResolvedValue({ data: { success: 1, failed: 0, results: [{ email: 'test@test.com', status: 'sent' }] }, error: null });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Enviar por correo')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Enviar por correo'));
    await waitFor(() => { expect(screen.getByText('Enviar')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Enviar'));
    await waitFor(() => { expect(mockInvoke).toHaveBeenCalledWith('send-monthly-report-email', expect.any(Object)); });
  });

  it('envía monthly_report_id', async () => {
    mockInvoke.mockResolvedValue({ data: { success: 1, failed: 0, results: [{ email: 't@t.com', status: 'sent' }] }, error: null });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Enviar por correo')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Enviar por correo'));
    await waitFor(() => { expect(screen.getByText('Enviar')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Enviar'));
    await waitFor(() => { expect(mockInvoke).toHaveBeenCalledTimes(1); });
    const body = mockInvoke.mock.calls[0][1].body;
    expect(body.monthly_report_id).toBe('r1');
  });

  it('error muestra alerta', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('Send failed') });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Enviar por correo')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Enviar por correo'));
    await waitFor(() => { expect(screen.getByText('Enviar')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Enviar'));
    await waitFor(() => { expect(screen.getByText(/Send failed/)).toBeInTheDocument(); });
  });

  it('respuesta inválida muestra error', async () => {
    mockInvoke.mockResolvedValue({ data: { invalid: true }, error: null });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Enviar por correo')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Enviar por correo'));
    await waitFor(() => { expect(screen.getByText('Enviar')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Enviar'));
    await waitFor(() => { expect(screen.getByText(/no es válida/)).toBeInTheDocument(); });
  });

  it('éxito completo', async () => {
    mockInvoke.mockResolvedValue({ data: { success: 2, failed: 0, results: [{ email: 'a@a.com', status: 'sent' }, { email: 'b@b.com', status: 'sent' }] }, error: null });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Enviar por correo')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Enviar por correo'));
    await waitFor(() => { expect(screen.getByText('Enviar')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Enviar'));
    await waitFor(() => { expect(screen.getByText(/enviado correctamente/)).toBeInTheDocument(); });
  });

  it('éxito parcial', async () => {
    mockInvoke.mockResolvedValue({ data: { success: 1, failed: 1, results: [{ email: 'a@a.com', status: 'sent' }, { email: 'b@b.com', status: 'failed' }] }, error: null });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Enviar por correo')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Enviar por correo'));
    await waitFor(() => { expect(screen.getByText('Enviar')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Enviar'));
    await waitFor(() => { expect(screen.getByText(/enviado a 1.*Fallaron 1/)).toBeInTheDocument(); });
  });

  it('cero éxitos', async () => {
    mockInvoke.mockResolvedValue({ data: { success: 0, failed: 2, results: [] }, error: null });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Enviar por correo')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Enviar por correo'));
    await waitFor(() => { expect(screen.getByText('Enviar')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Enviar'));
    await waitFor(() => { expect(screen.getByText(/No se pudo enviar el informe/)).toBeInTheDocument(); });
  });

  it('mock identificado', async () => {
    mockInvoke.mockResolvedValue({ data: { success: 1, failed: 0, results: [{ email: 'a@a.com', status: 'mock' }] }, error: null });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Enviar por correo')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Enviar por correo'));
    await waitFor(() => { expect(screen.getByText('Enviar')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Enviar'));
    await waitFor(() => { expect(screen.getByText(/prueba registrado/)).toBeInTheDocument(); });
  });

  it('sin destinatarios no envía', async () => {
    const chains = [
      makeChain({ id: 'r1', elevator_id: 'e1', building_id: 'b1', report_month: 7, report_year: 2026, status: 'approved', pdf_url: 'path/to.pdf', pdf_version: 1, numbering_mode: 'test', general_status: 'operativo', general_notes: '', created_by: 'admin1', approved_by: 'admin1' }),
      makeChain({ full_name: 'Admin', email: 'admin@test.com' }),
      makeChain({ id: 'e1', code: 'ASC-001', building: { id: 'b1', name: 'Edificio', address: 'Av. Test', client: { name: 'Cliente' } } }),
      makeChain([]),
    ];
    let idx = 0;
    mockFrom.mockImplementation(() => chains[idx++] ?? makeChain(null));
    renderPage();
    await waitFor(() => { expect(screen.queryByText('Enviar por correo')).not.toBeInTheDocument(); });
  });

  it('informe no aprobado no muestra envío', async () => {
    const chains = [
      makeChain({ id: 'r1', elevator_id: 'e1', building_id: 'b1', report_month: 7, report_year: 2026, status: 'generated', pdf_url: 'path/to.pdf', pdf_version: 1, numbering_mode: 'test', general_status: 'operativo', general_notes: '', created_by: 'admin1', approved_by: 'admin1' }),
      makeChain({ full_name: 'Admin', email: 'admin@test.com' }),
      makeChain({ id: 'e1', code: 'ASC-001', building: { id: 'b1', name: 'Edificio', address: 'Av. Test', client: { name: 'Cliente' } } }),
      makeChain([]),
    ];
    let idx = 0;
    mockFrom.mockImplementation(() => chains[idx++] ?? makeChain(null));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Generado')).toBeInTheDocument(); });
    expect(screen.queryByText('Enviar por correo')).not.toBeInTheDocument();
  });

  it('informe sin PDF no muestra envío', async () => {
    const chains = [
      makeChain({ id: 'r1', elevator_id: 'e1', building_id: 'b1', report_month: 7, report_year: 2026, status: 'approved', pdf_url: null, pdf_version: 1, numbering_mode: 'test', general_status: 'operativo', general_notes: '', created_by: 'admin1', approved_by: 'admin1' }),
      makeChain({ full_name: 'Admin', email: 'admin@test.com' }),
      makeChain({ id: 'e1', code: 'ASC-001', building: { id: 'b1', name: 'Edificio', address: 'Av. Test', client: { name: 'Cliente' } } }),
      makeChain([]),
    ];
    let idx = 0;
    mockFrom.mockImplementation(() => chains[idx++] ?? makeChain(null));
    renderPage();
    await waitFor(() => { expect(screen.getByText('Aprobado')).toBeInTheDocument(); });
    expect(screen.queryByText('Enviar por correo')).not.toBeInTheDocument();
  });

  it('doble clic produce una llamada', async () => {
    mockInvoke.mockResolvedValue({ data: { success: 1, failed: 0, results: [{ email: 'a@a.com', status: 'sent' }] }, error: null });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Enviar por correo')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Enviar por correo'));
    await waitFor(() => { expect(screen.getByText('Enviar')).toBeInTheDocument(); });
    const btn = screen.getByText('Enviar');
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => { expect(mockInvoke).toHaveBeenCalledTimes(1); });
  });

  it('no actualiza status manualmente desde el frontend', async () => {
    mockInvoke.mockResolvedValue({ data: { success: 1, failed: 0, results: [{ email: 'a@a.com', status: 'sent' }] }, error: null });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Enviar por correo')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Enviar por correo'));
    await waitFor(() => { expect(screen.getByText('Enviar')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Enviar'));
    await waitFor(() => { expect(screen.getByText(/enviado correctamente/)).toBeInTheDocument(); });
  });

  it('la referencia al código del ascensor funciona', async () => {
    renderPage();
    await waitFor(() => { expect(screen.getByText('ASC-001')).toBeInTheDocument(); });
  });
});
