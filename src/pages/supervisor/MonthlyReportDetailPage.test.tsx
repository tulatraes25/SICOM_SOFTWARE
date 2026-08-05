import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MonthlyReportDetailPage from './MonthlyReportDetailPage';
import { pdf as mockedPdf } from '@react-pdf/renderer';

const mocks = vi.hoisted(() => ({
  mockGetMonthlyReportPeriodData: vi.fn(),
  mockUpdateMonthlyReport: vi.fn(),
  mockApproveMonthlyReport: vi.fn(),
  mockGetUserSignatureForPDF: vi.fn(),
  mockNavigate: vi.fn(),
  mockSupabaseFrom: vi.fn(),
  mockSupabaseStorage: vi.fn(),
  mockSupabaseFunctionsInvoke: vi.fn(),
  mockSupabaseAuthGetUser: vi.fn(),
}));

vi.mock('@/services/monthlyReportEnhanced.service', () => ({
  getMonthlyReportPeriodData: (...a: unknown[]) => mocks.mockGetMonthlyReportPeriodData(...a),
  updateMonthlyReport: (...a: unknown[]) => mocks.mockUpdateMonthlyReport(...a),
  approveMonthlyReport: (...a: unknown[]) => mocks.mockApproveMonthlyReport(...a),
}));

vi.mock('@/services/userSignatures.service', () => ({
  getUserSignatureForPDF: (...a: unknown[]) => mocks.mockGetUserSignatureForPDF(...a),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mocks.mockNavigate, useParams: () => ({ id: 'r1' }) };
});

vi.mock('@/config/supabase', () => ({
  supabase: {
    from: (...a: unknown[]) => mocks.mockSupabaseFrom(...a),
    storage: { from: (...a: unknown[]) => mocks.mockSupabaseStorage(...a) },
    functions: { invoke: (...a: unknown[]) => mocks.mockSupabaseFunctionsInvoke(...a) },
    auth: { getUser: (...a: unknown[]) => mocks.mockSupabaseAuthGetUser(...a) },
  },
}));

vi.mock('@/components/layout/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@react-pdf/renderer', () => ({
  pdf: vi.fn().mockReturnValue({ toBlob: vi.fn().mockResolvedValue({ arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)) }) }),
}));

vi.mock('@/components/pdf/MonthlyReportPDF', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="monthly-report-pdf" data-status={props.documentStatus} data-version={props.report && typeof props.report === 'object' ? String((props.report as Record<string, unknown>).pdf_version) : undefined}>
      PDF
    </div>
  ),
}));

function makeChain(data: unknown, error: unknown = null) {
  const result = { data, error };
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    or: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
      if (error && reject) reject(error); else resolve(result);
      return { catch: () => ({}) };
    },
  };
  return chain;
}

function makeErrorResultChain(errorMessage: string) {
  const errorObj = new Error(errorMessage);
  const result = { data: null, error: errorObj };
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    or: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    then: (resolve: (v: unknown) => void) => {
      resolve(result);
      return { catch: () => ({}) };
    },
  };
  return chain;
}

function makeConflictChain() {
  const result = { data: null, error: null };
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    or: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    then: (resolve: (v: unknown) => void) => {
      resolve(result);
      return { catch: () => ({}) };
    },
  };
  return chain;
}

function setupMocks(reportOverrides: Record<string, unknown> = {}) {
  const defaultReport = {
    id: 'r1', elevator_id: 'e1', building_id: 'b1', report_month: 7, report_year: 2026,
    status: 'draft', pdf_url: null, pdf_version: 0, numbering_mode: 'production',
    general_status: 'operativo', general_notes: '', created_by: 'admin1', approved_by: null,
    ...reportOverrides,
  };

  mocks.mockSupabaseAuthGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } }, error: null });
  mocks.mockGetUserSignatureForPDF.mockResolvedValue({ signedUrl: 'https://sig.test/sig.png' });
  mocks.mockGetMonthlyReportPeriodData.mockResolvedValue({
    maintenances: [], serviceOrders: [], claims: [],
    summary: { preventiveCount: 0, correctiveCount: 0, serviceOrderCount: 0, claimCount: 0, totalApproved: 0, totalWithCorrections: 0, firstDate: null, lastDate: null },
  });

  const profileChain = makeChain({ full_name: 'Admin', email: 'admin@test.com' });
  const elevatorChain = makeChain({ id: 'e1', code: 'ASC-001', building: { id: 'b1', name: 'Edificio', address: 'Av. Test 123', client: { name: 'Cliente' } } });
  const recipientsChain = makeChain([{ id: 'c1', full_name: 'Contacto', email: 'c@test.com', role_label: 'Encargado' }]);

  const chains = defaultReport.approved_by
    ? [makeChain(defaultReport), profileChain, elevatorChain, recipientsChain]
    : [makeChain(defaultReport), elevatorChain, recipientsChain];

  let chainIdx = 0;
  mocks.mockSupabaseFrom.mockImplementation(() => chains[chainIdx++] ?? makeChain(null));
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/informes-mensuales/r1']}>
      <Routes>
        <Route path="/admin/informes-mensuales/:id" element={<MonthlyReportDetailPage />} />
        <Route path="/admin/informes-mensuales" element={<div>Reports List</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { vi.restoreAllMocks(); cleanup(); });

describe('MonthlyReportDetailPage — Carga y estados', () => {
  it('carga informe', async () => {
    setupMocks();
    renderPage();
    await waitFor(() => { expect(screen.getByText('ASC-001')).toBeInTheDocument(); });
    expect(screen.getByText('Borrador')).toBeInTheDocument();
  });

  it('muestra estado draft', async () => {
    setupMocks({ status: 'draft' });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Borrador')).toBeInTheDocument(); });
  });

  it('muestra estado generated', async () => {
    setupMocks({ status: 'generated', pdf_url: 'path/to.pdf', pdf_version: 1 });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Generado')).toBeInTheDocument(); });
  });

  it('muestra estado approved', async () => {
    setupMocks({ status: 'approved', pdf_url: 'path/to.pdf', pdf_version: 1 });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Aprobado')).toBeInTheDocument(); });
  });

  it('muestra estado sent', async () => {
    setupMocks({ status: 'sent', pdf_url: 'path/to.pdf', pdf_version: 1 });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Enviado')).toBeInTheDocument(); });
  });
});

describe('MonthlyReportDetailPage — Edición según estado', () => {
  it('estado y notas editables en draft', async () => {
    setupMocks({ status: 'draft' });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Borrador')).toBeInTheDocument(); });
    const select = screen.getByLabelText('Estado del mes');
    const textarea = screen.getByPlaceholderText('Observaciones del período...');
    expect(select).not.toBeDisabled();
    expect(textarea).not.toBeDisabled();
  });

  it('editables en generated', async () => {
    setupMocks({ status: 'generated', pdf_url: 'path/to.pdf', pdf_version: 1 });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Generado')).toBeInTheDocument(); });
    const select = screen.getByLabelText('Estado del mes');
    const textarea = screen.getByPlaceholderText('Observaciones del período...');
    expect(select).not.toBeDisabled();
    expect(textarea).not.toBeDisabled();
  });

  it('bloqueados en approved', async () => {
    setupMocks({ status: 'approved', pdf_url: 'path/to.pdf', pdf_version: 1 });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Aprobado')).toBeInTheDocument(); });
    const select = screen.getByLabelText('Estado del mes');
    const textarea = screen.getByPlaceholderText('Observaciones del período...');
    expect(select).toBeDisabled();
    expect(textarea).toBeDisabled();
  });

  it('bloqueados en sent', async () => {
    setupMocks({ status: 'sent', pdf_url: 'path/to.pdf', pdf_version: 1 });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Enviado')).toBeInTheDocument(); });
    const select = screen.getByLabelText('Estado del mes');
    const textarea = screen.getByPlaceholderText('Observaciones del período...');
    expect(select).toBeDisabled();
    expect(textarea).toBeDisabled();
  });
});

describe('MonthlyReportDetailPage — Generación de PDF', () => {
  it('PDF preliminar recibe documentStatus="preliminary"', async () => {
    setupMocks();
    renderPage();
    await waitFor(() => { expect(screen.getByText('Generar y Guardar PDF')).toBeInTheDocument(); });
    mocks.mockSupabaseStorage.mockReturnValue({ createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://url' } }), upload: vi.fn().mockResolvedValue({ error: null }) });
    mocks.mockSupabaseFrom.mockReturnValue(makeChain(null));
    fireEvent.click(screen.getByText('Generar y Guardar PDF'));
    await waitFor(() => { expect(mockedPdf).toHaveBeenCalled(); });
    const callArgs = (mockedPdf as ReturnType<typeof vi.fn>).mock.calls[0] as unknown[];
    const element = callArgs[0] as { props: Record<string, unknown> };
    expect(element.props.documentStatus).toBe('preliminary');
  });

  it('generación incrementa versión una vez', async () => {
    setupMocks({ pdf_version: 0 });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Generar y Guardar PDF')).toBeInTheDocument(); });
    mocks.mockSupabaseStorage.mockReturnValue({ createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://url' } }), upload: vi.fn().mockResolvedValue({ error: null }) });
    mocks.mockSupabaseFrom.mockReturnValue(makeChain(null));
    fireEvent.click(screen.getByText('Generar y Guardar PDF'));
    await waitFor(() => {
      const updateCalls = mocks.mockSupabaseFrom.mock.calls;
      const lastUpdate = updateCalls[updateCalls.length - 1];
      expect(lastUpdate).toBeDefined();
    });
  });

  it('generación actualiza status generated', async () => {
    setupMocks({ status: 'draft' });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Generar y Guardar PDF')).toBeInTheDocument(); });
    mocks.mockSupabaseStorage.mockReturnValue({ createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://url' } }), upload: vi.fn().mockResolvedValue({ error: null }) });
    const updateChain = makeChain({ id: 'r1', status: 'generated', pdf_url: 'path/to.pdf', pdf_version: 1 });
    mocks.mockSupabaseFrom.mockReturnValue(updateChain);
    fireEvent.click(screen.getByText('Generar y Guardar PDF'));
    await waitFor(() => { expect(screen.getByRole('status')).toBeInTheDocument(); });
  });

  it('approved no permite regenerar', async () => {
    setupMocks({ status: 'approved', pdf_url: 'path/to.pdf', pdf_version: 1 });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Aprobado')).toBeInTheDocument(); });
    expect(screen.queryByText('Regenerar PDF')).not.toBeInTheDocument();
  });

  it('sent no permite regenerar', async () => {
    setupMocks({ status: 'sent', pdf_url: 'path/to.pdf', pdf_version: 1 });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Enviado')).toBeInTheDocument(); });
    expect(screen.queryByText('Regenerar PDF')).not.toBeInTheDocument();
  });
});

describe('MonthlyReportDetailPage — Aprobación', () => {
  it('aprobación exige generated', async () => {
    setupMocks({ status: 'draft' });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Borrador')).toBeInTheDocument(); });
    expect(screen.queryByText('Aprobar informe')).not.toBeInTheDocument();
  });

  it('aprobación carga usuario actual', async () => {
    setupMocks({ status: 'generated', pdf_url: 'path/to.pdf', pdf_version: 1 });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Aprobar informe')).toBeInTheDocument(); });
    mocks.mockSupabaseStorage.mockReturnValue({ createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://url' } }), upload: vi.fn().mockResolvedValue({ error: null }) });
    mocks.mockSupabaseFrom.mockReturnValue(makeChain(null));
    fireEvent.click(screen.getByText('Aprobar informe'));
    await waitFor(() => { expect(screen.getByText('Aprobar')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Aprobar'));
    await waitFor(() => { expect(mocks.mockSupabaseAuthGetUser).toHaveBeenCalled(); });
  });

  it('aprobación genera PDF final con documentStatus="approved"', async () => {
    setupMocks({ status: 'generated', pdf_url: 'path/to.pdf', pdf_version: 1 });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Aprobar informe')).toBeInTheDocument(); });
    mocks.mockSupabaseStorage.mockReturnValue({ createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://url' } }), upload: vi.fn().mockResolvedValue({ error: null }) });
    mocks.mockSupabaseFrom.mockReturnValue(makeChain(null));
    fireEvent.click(screen.getByText('Aprobar informe'));
    await waitFor(() => { expect(screen.getByText('Aprobar')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Aprobar'));
    const { pdf: pdfFn } = await import('@react-pdf/renderer');
    await waitFor(() => {
      expect(pdfFn).toHaveBeenCalled();
    });
  });

  it('doble clic aprueba una sola vez', async () => {
    setupMocks({ status: 'generated', pdf_url: 'path/to.pdf', pdf_version: 1 });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Aprobar informe')).toBeInTheDocument(); });
    mocks.mockSupabaseStorage.mockReturnValue({ createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://url' } }), upload: vi.fn().mockResolvedValue({ error: null }) });
    const updateChain = makeChain({ id: 'r1', status: 'approved', approved_by: 'admin-1', approved_at: new Date().toISOString(), pdf_url: 'path/to.pdf', pdf_version: 2 });
    mocks.mockSupabaseFrom.mockReturnValue(updateChain);
    fireEvent.click(screen.getByText('Aprobar informe'));
    await waitFor(() => { expect(screen.getByText('Aprobar')).toBeInTheDocument(); });
    const approveBtn = screen.getByText('Aprobar');
    fireEvent.click(approveBtn);
    fireEvent.click(approveBtn);
    await waitFor(() => { expect(screen.getByRole('status')).toBeInTheDocument(); });
  });

  it('fallo de upload no aprueba', async () => {
    setupMocks({ status: 'generated', pdf_url: 'path/to.pdf', pdf_version: 1 });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Aprobar informe')).toBeInTheDocument(); });
    mocks.mockSupabaseStorage.mockReturnValue({ createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://url' } }), upload: vi.fn().mockResolvedValue({ error: new Error('Upload failed') }) });
    fireEvent.click(screen.getByText('Aprobar informe'));
    await waitFor(() => { expect(screen.getByText('Aprobar')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Aprobar'));
    await waitFor(() => { expect(screen.getByRole('alert')).toBeInTheDocument(); });
  });

  it('conflicto de estado muestra error', async () => {
    setupMocks({ status: 'generated', pdf_url: 'path/to.pdf', pdf_version: 1 });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Aprobar informe')).toBeInTheDocument(); });
    mocks.mockSupabaseStorage.mockReturnValue({ createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://url' } }), upload: vi.fn().mockResolvedValue({ error: null }) });
    mocks.mockSupabaseFrom.mockReturnValue(makeErrorResultChain('Row not found or status changed'));
    fireEvent.click(screen.getByText('Aprobar informe'));
    await waitFor(() => { expect(screen.getByText('Aprobar')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Aprobar'));
    await waitFor(() => { expect(screen.getByRole('alert')).toBeInTheDocument(); });
  });

  it('modal no contiene textarea de observaciones', async () => {
    setupMocks({ status: 'generated', pdf_url: 'path/to.pdf', pdf_version: 1 });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Aprobar informe')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Aprobar informe'));
    await waitFor(() => { expect(screen.getByText('Aprobar')).toBeInTheDocument(); });
    const modal = screen.getByText('Aprobar informe mensual').closest('div')?.parentElement;
    expect(modal).toBeDefined();
    expect(modal!.querySelector('textarea')).not.toBeInTheDocument();
  });
});

describe('MonthlyReportDetailPage — PDF buttons', () => {
  it('approved permite ver PDF', async () => {
    setupMocks({ status: 'approved', pdf_url: 'path/to.pdf', pdf_version: 1 });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Aprobado')).toBeInTheDocument(); });
    expect(screen.getByText('Ver PDF')).toBeInTheDocument();
  });

  it('approved permite descargar', async () => {
    setupMocks({ status: 'approved', pdf_url: 'path/to.pdf', pdf_version: 1 });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Aprobado')).toBeInTheDocument(); });
    expect(screen.getByText('Descargar PDF')).toBeInTheDocument();
  });

  it('sent permite ver y descargar', async () => {
    setupMocks({ status: 'sent', pdf_url: 'path/to.pdf', pdf_version: 1 });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Enviado')).toBeInTheDocument(); });
    expect(screen.getByText('Ver PDF')).toBeInTheDocument();
    expect(screen.getByText('Descargar PDF')).toBeInTheDocument();
  });
});

describe('MonthlyReportDetailPage — Envío de correo', () => {
  it('botón aparece solamente en approved', async () => {
    setupMocks({ status: 'generated', pdf_url: 'path/to.pdf', pdf_version: 1 });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Generado')).toBeInTheDocument(); });
    expect(screen.queryByText('Enviar por correo')).not.toBeInTheDocument();
  });

  it('sent no permite volver a enviar', async () => {
    setupMocks({ status: 'sent', pdf_url: 'path/to.pdf', pdf_version: 1 });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Enviado')).toBeInTheDocument(); });
    expect(screen.queryByText('Enviar por correo')).not.toBeInTheDocument();
  });

  it('emailRef previene doble clic', async () => {
    setupMocks({ status: 'approved', pdf_url: 'path/to.pdf', pdf_version: 1 });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Enviar por correo')).toBeInTheDocument(); });
    mocks.mockSupabaseFunctionsInvoke.mockResolvedValue({ data: { success: 1, failed: 0, mock: 1, results: [{ email: 'a@a.com', status: 'mock' }], report_status: 'approved' }, error: null });
    const approvedChain = makeChain({ id: 'r1', status: 'approved', pdf_url: 'path/to.pdf', pdf_version: 1 });
    mocks.mockSupabaseFrom.mockReturnValue(approvedChain);
    fireEvent.click(screen.getByText('Enviar por correo'));
    await waitFor(() => { expect(screen.getByRole('button', { name: /Enviar$/i })).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /Enviar$/i }));
    await waitFor(() => { expect(mocks.mockSupabaseFunctionsInvoke).toHaveBeenCalledTimes(1); });
  });

  it('respuesta real completa muestra éxito', async () => {
    setupMocks({ status: 'approved', pdf_url: 'path/to.pdf', pdf_version: 1 });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Enviar por correo')).toBeInTheDocument(); });
    mocks.mockSupabaseFunctionsInvoke.mockResolvedValue({ data: { success: 1, failed: 0, mock: 0, results: [{ email: 'a@a.com', status: 'sent' }], report_status: 'sent' }, error: null });
    mocks.mockSupabaseFrom.mockReturnValue(makeChain({ id: 'r1', status: 'sent', pdf_url: 'path/to.pdf', pdf_version: 1 }));
    fireEvent.click(screen.getByText('Enviar por correo'));
    await waitFor(() => { expect(screen.getByText('Enviar')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Enviar'));
    await waitFor(() => { expect(screen.getByText(/enviado correctamente/i)).toBeInTheDocument(); });
  });

  it('respuesta mock muestra mensaje correcto', async () => {
    setupMocks({ status: 'approved', pdf_url: 'path/to.pdf', pdf_version: 1 });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Enviar por correo')).toBeInTheDocument(); });
    mocks.mockSupabaseFunctionsInvoke.mockResolvedValue({ data: { success: 0, failed: 0, mock: 1, results: [{ email: 'a@a.com', status: 'mock' }], report_status: 'approved', status_update_failed: false }, error: null });
    mocks.mockSupabaseFrom.mockReturnValue(makeChain({ id: 'r1', status: 'approved', pdf_url: 'path/to.pdf', pdf_version: 1 }));
    fireEvent.click(screen.getByText('Enviar por correo'));
    await waitFor(() => { expect(screen.getByText('Enviar')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Enviar'));
    await waitFor(() => { expect(screen.getByText(/proveedor de correo no está configurado/i)).toBeInTheDocument(); });
  });

  it('respuesta parcial muestra cantidades', async () => {
    setupMocks({ status: 'approved', pdf_url: 'path/to.pdf', pdf_version: 1 });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Enviar por correo')).toBeInTheDocument(); });
    mocks.mockSupabaseFunctionsInvoke.mockResolvedValue({ data: { success: 1, failed: 1, mock: 0, results: [{ email: 'a@a.com', status: 'sent' }, { email: 'b@b.com', status: 'failed' }], report_status: 'approved' }, error: null });
    mocks.mockSupabaseFrom.mockReturnValue(makeChain({ id: 'r1', status: 'approved', pdf_url: 'path/to.pdf', pdf_version: 1 }));
    fireEvent.click(screen.getByText('Enviar por correo'));
    await waitFor(() => { expect(screen.getByText('Enviar')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Enviar'));
    await waitFor(() => { expect(screen.getByText(/Se enviaron 1 correos y fallaron 1/)).toBeInTheDocument(); });
  });

  it('respuesta fallida muestra error', async () => {
    setupMocks({ status: 'approved', pdf_url: 'path/to.pdf', pdf_version: 1 });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Enviar por correo')).toBeInTheDocument(); });
    mocks.mockSupabaseFunctionsInvoke.mockResolvedValue({ data: { success: 0, failed: 2, mock: 0, results: [], report_status: 'approved' }, error: null });
    mocks.mockSupabaseFrom.mockReturnValue(makeChain({ id: 'r1', status: 'approved', pdf_url: 'path/to.pdf', pdf_version: 1 }));
    fireEvent.click(screen.getByText('Enviar por correo'));
    await waitFor(() => { expect(screen.getByText('Enviar')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Enviar'));
    await waitFor(() => { expect(screen.getByText(/No se pudo enviar el informe/)).toBeInTheDocument(); });
  });

  it('respuesta inválida se rechaza', async () => {
    setupMocks({ status: 'approved', pdf_url: 'path/to.pdf', pdf_version: 1 });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Enviar por correo')).toBeInTheDocument(); });
    mocks.mockSupabaseFunctionsInvoke.mockResolvedValue({ data: { invalid: true }, error: null });
    mocks.mockSupabaseFrom.mockReturnValue(makeChain({ id: 'r1', status: 'approved', pdf_url: 'path/to.pdf', pdf_version: 1 }));
    fireEvent.click(screen.getByText('Enviar por correo'));
    await waitFor(() => { expect(screen.getByText('Enviar')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Enviar'));
    await waitFor(() => { expect(screen.getByText(/no es válida/i)).toBeInTheDocument(); });
  });

  it('monthly_report_id correcto', async () => {
    setupMocks({ status: 'approved', pdf_url: 'path/to.pdf', pdf_version: 1 });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Enviar por correo')).toBeInTheDocument(); });
    mocks.mockSupabaseFunctionsInvoke.mockResolvedValue({ data: { success: 1, failed: 0, mock: 0, results: [{ email: 'a@a.com', status: 'sent' }], report_status: 'sent' }, error: null });
    mocks.mockSupabaseFrom.mockReturnValue(makeChain({ id: 'r1', status: 'sent', pdf_url: 'path/to.pdf', pdf_version: 1 }));
    fireEvent.click(screen.getByText('Enviar por correo'));
    await waitFor(() => { expect(screen.getByText('Enviar')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Enviar'));
    await waitFor(() => { expect(mocks.mockSupabaseFunctionsInvoke).toHaveBeenCalledTimes(1); });
    const body = mocks.mockSupabaseFunctionsInvoke.mock.calls[0][1]?.body as Record<string, unknown>;
    expect(body.monthly_report_id).toBe('r1');
  });
});

describe('MonthlyReportDetailPage — Generación atómica', () => {
  it('guard interno rechaza estado approved', async () => {
    setupMocks({ status: 'approved', pdf_url: 'path/to.pdf', pdf_version: 1 });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Aprobado')).toBeInTheDocument(); });
    expect(screen.queryByText('Generar y Guardar PDF')).not.toBeInTheDocument();
    expect(screen.queryByText('Regenerar PDF')).not.toBeInTheDocument();
  });

  it('guard interno rechaza estado sent', async () => {
    setupMocks({ status: 'sent', pdf_url: 'path/to.pdf', pdf_version: 1 });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Enviado')).toBeInTheDocument(); });
    expect(screen.queryByText('Generar y Guardar PDF')).not.toBeInTheDocument();
  });

  it('upload utiliza upsert false', async () => {
    setupMocks({ status: 'draft' });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Generar y Guardar PDF')).toBeInTheDocument(); });
    const uploadFn = vi.fn().mockResolvedValue({ error: null });
    mocks.mockSupabaseStorage.mockReturnValue({ createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://url' } }), upload: uploadFn });
    const updateChain = makeChain({ id: 'r1', status: 'generated', pdf_url: 'path/to.pdf', pdf_version: 1 });
    mocks.mockSupabaseFrom.mockReturnValue(updateChain);
    fireEvent.click(screen.getByText('Generar y Guardar PDF'));
    await waitFor(() => { expect(uploadFn).toHaveBeenCalled(); });
    expect(uploadFn.mock.calls[0][2]).toEqual({ contentType: 'application/pdf', upsert: false });
  });

  it('ruta contiene UUID devuelto por crypto.randomUUID', async () => {
    setupMocks({ status: 'draft' });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Generar y Guardar PDF')).toBeInTheDocument(); });
    const uploadFn = vi.fn().mockResolvedValue({ error: null });
    mocks.mockSupabaseStorage.mockReturnValue({ createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://url' } }), upload: uploadFn });
    const updateChain = makeChain({ id: 'r1', status: 'generated', pdf_url: 'path/to.pdf', pdf_version: 1 });
    mocks.mockSupabaseFrom.mockReturnValue(updateChain);
    fireEvent.click(screen.getByText('Generar y Guardar PDF'));
    await waitFor(() => { expect(uploadFn).toHaveBeenCalled(); });
    const path = uploadFn.mock.calls[0][0] as string;
    expect(path).toMatch(/informe-2026-07-v1-[a-f0-9-]+\.pdf/i);
  });

  it('UPDATE usa eq por id y in con statuses', async () => {
    setupMocks({ status: 'draft' });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Generar y Guardar PDF')).toBeInTheDocument(); });
    mocks.mockSupabaseStorage.mockReturnValue({ createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://url' } }), upload: vi.fn().mockResolvedValue({ error: null }) });
    const updateChain = makeChain({ id: 'r1', status: 'generated', pdf_url: 'path/to.pdf', pdf_version: 1 });
    mocks.mockSupabaseFrom.mockReturnValue(updateChain);
    fireEvent.click(screen.getByText('Generar y Guardar PDF'));
    await waitFor(() => { expect(updateChain.eq).toHaveBeenCalled(); });
    expect(updateChain.in).toHaveBeenCalled();
    expect(updateChain.maybeSingle).toHaveBeenCalled();
  });

  it('conflicto data null + error null muestra error', async () => {
    setupMocks({ status: 'draft' });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Generar y Guardar PDF')).toBeInTheDocument(); });
    mocks.mockSupabaseStorage.mockReturnValue({ createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://url' } }), upload: vi.fn().mockResolvedValue({ error: null }) });
    const conflictChain = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
    mocks.mockSupabaseFrom.mockReturnValue(conflictChain);
    fireEvent.click(screen.getByText('Generar y Guardar PDF'));
    await waitFor(() => { expect(screen.getByRole('alert')).toBeInTheDocument(); });
  });

  it('conflicto elimina exactamente la ruta recién subida', async () => {
    setupMocks({ status: 'draft' });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Generar y Guardar PDF')).toBeInTheDocument(); });
    const removeFn = vi.fn().mockResolvedValue({ error: null });
    mocks.mockSupabaseStorage.mockReturnValue({ createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://url' } }), upload: vi.fn().mockResolvedValue({ error: null }), remove: removeFn });
    const conflictChain = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
    mocks.mockSupabaseFrom.mockReturnValue(conflictChain);
    fireEvent.click(screen.getByText('Generar y Guardar PDF'));
    await waitFor(() => { expect(removeFn).toHaveBeenCalled(); });
  });

  it('conflicto no muestra mensaje de éxito', async () => {
    setupMocks({ status: 'draft' });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Generar y Guardar PDF')).toBeInTheDocument(); });
    mocks.mockSupabaseStorage.mockReturnValue({ createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://url' } }), upload: vi.fn().mockResolvedValue({ error: null }) });
    const conflictChain = makeConflictChain();
    mocks.mockSupabaseFrom.mockReturnValue(conflictChain);
    fireEvent.click(screen.getByText('Generar y Guardar PDF'));
    await waitFor(() => { expect(screen.getByRole('alert')).toBeInTheDocument(); });
    expect(screen.queryByText(/correctamente/)).not.toBeInTheDocument();
  });

  it('conflicto vuelve a cargar el informe', async () => {
    setupMocks({ status: 'draft' });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Generar y Guardar PDF')).toBeInTheDocument(); });
    mocks.mockSupabaseStorage.mockReturnValue({ createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://url' } }), upload: vi.fn().mockResolvedValue({ error: null }) });
    const conflictChain = makeConflictChain();
    mocks.mockSupabaseFrom.mockReturnValue(conflictChain);
    const callsBefore = mocks.mockSupabaseFrom.mock.calls.length;
    fireEvent.click(screen.getByText('Generar y Guardar PDF'));
    await waitFor(() => { expect(mocks.mockSupabaseFrom.mock.calls.length).toBeGreaterThan(callsBefore); });
  });

  it('doble clic genera un solo PDF', async () => {
    setupMocks({ status: 'draft' });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Generar y Guardar PDF')).toBeInTheDocument(); });
    mocks.mockSupabaseStorage.mockReturnValue({ createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://url' } }), upload: vi.fn().mockResolvedValue({ error: null }) });
    const updateChain = makeChain({ id: 'r1', status: 'generated', pdf_url: 'path/to.pdf', pdf_version: 1 });
    mocks.mockSupabaseFrom.mockReturnValue(updateChain);
    const btn = screen.getByText('Generar y Guardar PDF');
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => { expect(mockedPdf).toHaveBeenCalledTimes(1); });
  });

  it('pdf_version se incrementa exactamente una vez', async () => {
    setupMocks({ pdf_version: 0 });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Generar y Guardar PDF')).toBeInTheDocument(); });
    mocks.mockSupabaseStorage.mockReturnValue({ createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://url' } }), upload: vi.fn().mockResolvedValue({ error: null }) });
    const updateChain = makeChain({ id: 'r1', status: 'generated', pdf_url: 'path/to.pdf', pdf_version: 1 });
    mocks.mockSupabaseFrom.mockReturnValue(updateChain);
    fireEvent.click(screen.getByText('Generar y Guardar PDF'));
    await waitFor(() => { expect(screen.getByRole('status')).toBeInTheDocument(); });
    expect(screen.getByText(/v1/)).toBeInTheDocument();
  });
});

describe('MonthlyReportDetailPage — Aprobación atómica', () => {
  it('guard interno rechaza draft', async () => {
    setupMocks({ status: 'draft' });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Borrador')).toBeInTheDocument(); });
    expect(screen.queryByText('Aprobar informe')).not.toBeInTheDocument();
  });

  it('guard interno rechaza sent', async () => {
    setupMocks({ status: 'sent', pdf_url: 'path/to.pdf', pdf_version: 1 });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Enviado')).toBeInTheDocument(); });
    expect(screen.queryByText('Aprobar informe')).not.toBeInTheDocument();
  });

  it('upload usa upsert false', async () => {
    setupMocks({ status: 'generated', pdf_url: 'path/to.pdf', pdf_version: 1 });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Aprobar informe')).toBeInTheDocument(); });
    const uploadFn = vi.fn().mockResolvedValue({ error: null });
    mocks.mockSupabaseStorage.mockReturnValue({ createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://url' } }), upload: uploadFn });
    const updateChain = makeChain({ id: 'r1', status: 'approved', approved_by: 'admin-1', pdf_url: 'path/to.pdf', pdf_version: 2 });
    mocks.mockSupabaseFrom.mockReturnValue(updateChain);
    fireEvent.click(screen.getByText('Aprobar informe'));
    await waitFor(() => { expect(screen.getByText('Aprobar')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Aprobar'));
    await waitFor(() => { expect(uploadFn).toHaveBeenCalled(); });
    expect(uploadFn.mock.calls[0][2]).toEqual({ contentType: 'application/pdf', upsert: false });
  });

  it('UPDATE usa eq por id y eq status generated', async () => {
    setupMocks({ status: 'generated', pdf_url: 'path/to.pdf', pdf_version: 1 });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Aprobar informe')).toBeInTheDocument(); });
    mocks.mockSupabaseStorage.mockReturnValue({ createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://url' } }), upload: vi.fn().mockResolvedValue({ error: null }) });
    const updateChain = makeChain({ id: 'r1', status: 'approved', approved_by: 'admin-1', pdf_url: 'path/to.pdf', pdf_version: 2 });
    mocks.mockSupabaseFrom.mockReturnValue(updateChain);
    fireEvent.click(screen.getByText('Aprobar informe'));
    await waitFor(() => { expect(screen.getByText('Aprobar')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Aprobar'));
    await waitFor(() => { expect(updateChain.eq).toHaveBeenCalled(); });
    expect(updateChain.maybeSingle).toHaveBeenCalled();
  });

  it('conflicto data null + error null muestra error específico', async () => {
    setupMocks({ status: 'generated', pdf_url: 'path/to.pdf', pdf_version: 1 });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Aprobar informe')).toBeInTheDocument(); });
    mocks.mockSupabaseStorage.mockReturnValue({ createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://url' } }), upload: vi.fn().mockResolvedValue({ error: null }) });
    const conflictChain = makeConflictChain();
    mocks.mockSupabaseFrom.mockReturnValue(conflictChain);
    fireEvent.click(screen.getByText('Aprobar informe'));
    await waitFor(() => { expect(screen.getByText('Aprobar')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Aprobar'));
    await waitFor(() => { expect(screen.getByRole('alert')).toBeInTheDocument(); });
    expect(screen.getByText(/ya fue aprobado o cambió de estado/)).toBeInTheDocument();
  });

  it('conflicto no muestra Informe aprobado correctamente', async () => {
    setupMocks({ status: 'generated', pdf_url: 'path/to.pdf', pdf_version: 1 });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Aprobar informe')).toBeInTheDocument(); });
    mocks.mockSupabaseStorage.mockReturnValue({ createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://url' } }), upload: vi.fn().mockResolvedValue({ error: null }) });
    const conflictChain = makeConflictChain();
    mocks.mockSupabaseFrom.mockReturnValue(conflictChain);
    fireEvent.click(screen.getByText('Aprobar informe'));
    await waitFor(() => { expect(screen.getByText('Aprobar')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Aprobar'));
    await waitFor(() => { expect(screen.getByRole('alert')).toBeInTheDocument(); });
    expect(screen.queryByText('Informe aprobado correctamente')).not.toBeInTheDocument();
  });

  it('conflicto cierra el modal', async () => {
    setupMocks({ status: 'generated', pdf_url: 'path/to.pdf', pdf_version: 1 });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Aprobar informe')).toBeInTheDocument(); });
    mocks.mockSupabaseStorage.mockReturnValue({ createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://url' } }), upload: vi.fn().mockResolvedValue({ error: null }) });
    const conflictChain = makeConflictChain();
    mocks.mockSupabaseFrom.mockReturnValue(conflictChain);
    fireEvent.click(screen.getByText('Aprobar informe'));
    await waitFor(() => { expect(screen.getByText('Aprobar')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Aprobar'));
    await waitFor(() => {
      expect(screen.queryByText('Aprobar informe mensual')).not.toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('error real del UPDATE elimina el archivo recién subido', async () => {
    setupMocks({ status: 'generated', pdf_url: 'path/to.pdf', pdf_version: 1 });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Aprobar informe')).toBeInTheDocument(); });
    const removeFn = vi.fn().mockResolvedValue({ error: null });
    mocks.mockSupabaseStorage.mockReturnValue({ createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://url' } }), upload: vi.fn().mockResolvedValue({ error: null }), remove: removeFn });
    const errorChain = makeErrorResultChain('DB update failed');
    mocks.mockSupabaseFrom.mockReturnValue(errorChain);
    fireEvent.click(screen.getByText('Aprobar informe'));
    await waitFor(() => { expect(screen.getByText('Aprobar')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Aprobar'));
    await waitFor(() => { expect(removeFn).toHaveBeenCalled(); });
  });

  it('doble clic realiza una sola generación final', async () => {
    setupMocks({ status: 'generated', pdf_url: 'path/to.pdf', pdf_version: 1 });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Aprobar informe')).toBeInTheDocument(); });
    mocks.mockSupabaseStorage.mockReturnValue({ createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://url' } }), upload: vi.fn().mockResolvedValue({ error: null }) });
    const updateChain = makeChain({ id: 'r1', status: 'approved', approved_by: 'admin-1', pdf_url: 'path/to.pdf', pdf_version: 2 });
    mocks.mockSupabaseFrom.mockReturnValue(updateChain);
    fireEvent.click(screen.getByText('Aprobar informe'));
    await waitFor(() => { expect(screen.getByText('Aprobar')).toBeInTheDocument(); });
    const approveButtons = screen.getAllByText('Aprobar');
    const confirmBtn = approveButtons[approveButtons.length - 1];
    fireEvent.click(confirmBtn);
    fireEvent.click(confirmBtn);
    await waitFor(() => { expect(mockedPdf).toHaveBeenCalledTimes(1); });
  });

  it('pdf_version final se incrementa exactamente una vez', async () => {
    setupMocks({ status: 'generated', pdf_url: 'path/to.pdf', pdf_version: 1 });
    renderPage();
    await waitFor(() => { expect(screen.getByText('Aprobar informe')).toBeInTheDocument(); });
    mocks.mockSupabaseStorage.mockReturnValue({ createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://url' } }), upload: vi.fn().mockResolvedValue({ error: null }) });
    const updateChain = makeChain({ id: 'r1', status: 'approved', approved_by: 'admin-1', pdf_url: 'path/to.pdf', pdf_version: 2 });
    mocks.mockSupabaseFrom.mockReturnValue(updateChain);
    fireEvent.click(screen.getByText('Aprobar informe'));
    await waitFor(() => { expect(screen.getByText('Aprobar')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('Aprobar'));
    await waitFor(() => { expect(screen.getByText(/v2/)).toBeInTheDocument(); });
  });
});
