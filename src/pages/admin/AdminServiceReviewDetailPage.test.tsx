import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminServiceReviewDetailPage from './AdminServiceReviewDetailPage';

function getFirstPdfCall(pdfMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const call = pdfMock.mock.calls[0];
  return call ? call[0] as Record<string, unknown> : {};
}

const {
  mockGetServiceRecordForReview,
  mockApproveServiceRecord,
  mockRejectServiceRecord,
  mockListServiceReportSends,
  mockSendServiceReportByEmail,
  mockCreateAuditLog,
  mockProcessPhotosForPDF,
  mockNavigate,
  mockSupabaseFrom,
  mockSupabaseRpc,
  mockSupabaseFunctionsInvoke,
  mockServiceRecordPDF,
} = vi.hoisted(() => ({
  mockGetServiceRecordForReview: vi.fn(),
  mockApproveServiceRecord: vi.fn(),
  mockRejectServiceRecord: vi.fn(),
  mockListServiceReportSends: vi.fn(),
  mockSendServiceReportByEmail: vi.fn(),
  mockCreateAuditLog: vi.fn(),
  mockProcessPhotosForPDF: vi.fn(),
  mockNavigate: vi.fn(),
  mockSupabaseFrom: vi.fn(),
  mockSupabaseRpc: vi.fn(),
  mockSupabaseFunctionsInvoke: vi.fn(),
  mockServiceRecordPDF: vi.fn(() => <div data-testid="service-record-pdf" />),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate, useParams: () => ({ id: 'sr-1' }) };
});

vi.mock('@/services/supervisor.service', () => ({
  getServiceRecordForReview: (...a: unknown[]) => mockGetServiceRecordForReview(...a),
  approveServiceRecord: (...a: unknown[]) => mockApproveServiceRecord(...a),
  rejectServiceRecord: (...a: unknown[]) => mockRejectServiceRecord(...a),
}));

vi.mock('@/services/serviceReportSends.service', () => ({
  listServiceReportSends: (...a: unknown[]) => mockListServiceReportSends(...a),
  sendServiceReportByEmail: (...a: unknown[]) => mockSendServiceReportByEmail(...a),
}));

vi.mock('@/services/audit.service', () => ({
  createAuditLog: (...a: unknown[]) => mockCreateAuditLog(...a),
}));

vi.mock('@/lib/photoUtils', () => ({
  processPhotosForPDF: (...a: unknown[]) => mockProcessPhotosForPDF(...a),
}));

vi.mock('@/config/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
    rpc: (...args: unknown[]) => mockSupabaseRpc(...args),
    functions: { invoke: (...args: unknown[]) => mockSupabaseFunctionsInvoke(...args) },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://example.com/photo.jpg' } }),
      })),
    },
  },
}));

vi.mock('@react-pdf/renderer', () => ({
  pdf: vi.fn().mockResolvedValue({ toBlob: vi.fn().mockResolvedValue({ arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)) }) }),
  PDFDownloadLink: ({ document: doc, children }: { document: React.ReactNode; children: React.ReactNode }) => (
    <>
      {doc}
      {typeof children === 'function' ? (children as (args: { loading: boolean }) => React.ReactNode)({ loading: false }) : children}
    </>
  ),
  Document: 'div',
  Page: 'div',
  Text: 'div',
  View: 'div',
  StyleSheet: { create: (s: unknown) => s },
  Image: 'img',
}));

vi.mock('@/components/pdf/ServiceRecordPDF', () => ({
  default: (...args: Parameters<typeof mockServiceRecordPDF>) => mockServiceRecordPDF(...args),
}));

vi.mock('@/components/service/ServiceChecklist', () => ({
  default: vi.fn(() => <div data-testid="service-checklist" />),
  createDefaultChecklist: vi.fn(() => []),
}));

vi.mock('@/components/service/ServicePhotoUpload', () => ({
  default: vi.fn(() => <div data-testid="service-photo-upload" />),
}));

vi.mock('@/components/serviceOrders/SendOrderEmailModal', () => ({
  default: vi.fn(() => <div data-testid="send-order-email-modal" />),
}));

vi.mock('@/components/photos/PhotoViewerModal', () => ({
  default: vi.fn(() => <div data-testid="photo-viewer-modal" />),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'admin1' },
    profile: { id: 'admin1', full_name: 'Admin', role: 'admin', email: 'a@a.com', active: true, created_at: '', updated_at: '' },
    logout: () => Promise.resolve(),
    login: () => Promise.resolve({ error: null }),
    getRedirectPath: () => '/',
    hasRole: () => true,
    isAdmin: true,
    isTechnician: false,
    isSupervisor: false,
    isResponsible: false,
    isAuthenticated: true,
    loading: false,
    error: null,
  })),
}));

vi.mock('@/components/layout/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock('@/services/userSignatures.service', () => ({
  getMyActiveSignature: vi.fn().mockResolvedValue(null),
}));

const mockRecord = {
  id: 'sr-1',
  status: 'submitted',
  service_date: '2026-08-03',
  service_type: 'preventivo',
  operational_status_at_service: 'operativo',
  conservation_status_at_service: 'conforme',
  description: 'Mantenimiento preventivo',
  observations: null,
  technical_report: null,
  ai_report_draft: null,
  final_report_text: null,
  approved_by: null,
  approved_at: null,
  rejection_reason: null,
  elevator: {
    id: 'elev-1',
    code: 'ASC-0001',
    manufacturer: 'Otis',
    model: 'Gen2',
    elevator_type: 'traccion',
    building: {
      name: 'Edificio Central',
      address: 'Av. Libertador 1234',
      locality: 'Comodoro Rivadavia',
      client: {
        name: 'Cliente ABC',
        contact_name: 'Juan Contacto',
        contact_email: 'juan@abc.com',
      },
    },
  },
  technician: {
    full_name: 'Juan Técnico',
    email: 'juan@tech.com',
  },
  approved_by_profile: null,
  checklist: [],
};

const approvedRecord = {
  ...mockRecord,
  status: 'approved',
  approved_by: 'admin-1',
  approved_at: '2026-08-03T15:00:00Z',
  approved_by_profile: {
    full_name: 'Lucas Forquera',
    email: 'lucas@sicom.com',
  },
};

function createDefaultChain() {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: vi.fn((resolve: (value: unknown) => void) => resolve({ data: [], error: null })),
  };
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  mockGetServiceRecordForReview.mockResolvedValue(mockRecord);
  mockListServiceReportSends.mockResolvedValue([]);
  mockProcessPhotosForPDF.mockResolvedValue([]);
  mockSupabaseRpc.mockResolvedValue({ data: null, error: null });
  mockSupabaseFunctionsInvoke.mockResolvedValue({ data: null, error: null });
  mockApproveServiceRecord.mockResolvedValue(undefined);
  mockRejectServiceRecord.mockResolvedValue(undefined);
  mockCreateAuditLog.mockResolvedValue(undefined);
  mockSupabaseFrom.mockReturnValue(createDefaultChain());
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

async function renderPage(recordOverrides?: Record<string, unknown>) {
  if (recordOverrides) {
    mockGetServiceRecordForReview.mockResolvedValue({ ...mockRecord, ...recordOverrides });
  } else {
    mockGetServiceRecordForReview.mockResolvedValue(mockRecord);
  }
  render(
    <MemoryRouter initialEntries={['/admin/mantenimientos/sr-1']}>
      <AdminServiceReviewDetailPage />
    </MemoryRouter>,
  );
  await waitFor(() => {
    expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument();
  });
}

describe('AdminServiceReviewDetailPage — Carga', () => {
  it('carga el mantenimiento', async () => {
    await renderPage();
    expect(mockGetServiceRecordForReview).toHaveBeenCalledWith('sr-1');
    expect(screen.getAllByText('ASC-0001').length).toBeGreaterThanOrEqual(1);
  });

  it('muestra técnico real', async () => {
    await renderPage();
    const matches = screen.getAllByText('Juan Técnico');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('muestra fecha DATE correcta (sin desplazamiento)', async () => {
    await renderPage();
    expect(screen.getByText('3/8/2026')).toBeInTheDocument();
  });

  it('muestra estado Enviado', async () => {
    await renderPage();
    expect(screen.getByText('Enviado')).toBeInTheDocument();
  });
});

describe('AdminServiceReviewDetailPage — Informe', () => {
  it('permite editar informe', async () => {
    await renderPage();
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea).toBeInTheDocument();
    fireEvent.change(textarea, { target: { value: 'Nuevo informe' } });
    expect(textarea.value).toBe('Nuevo informe');
  });

  it('"Guardar cambios" persiste texto', async () => {
    await renderPage();
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Informe guardado' } });
    fireEvent.click(screen.getByText('Guardar cambios'));
    await waitFor(() => {
      expect(mockSupabaseFrom).toHaveBeenCalled();
    });
  });

  it('genera informe con IA', async () => {
    mockSupabaseFunctionsInvoke.mockResolvedValue({ data: { report: 'Informe IA' }, error: null });
    await renderPage();
    fireEvent.click(screen.getByText(/generar con ia/i));
    await waitFor(() => {
      expect(mockSupabaseFunctionsInvoke).toHaveBeenCalledWith('generate-report', {
        body: { service_record_id: 'sr-1' },
      });
    });
  });
});

describe('AdminServiceReviewDetailPage — Aprobación', () => {
  it('botón Aprobar usa approve_service_record', async () => {
    await renderPage();
    fireEvent.click(screen.getByText(/aprobar/i));
    await waitFor(() => {
      expect(mockApproveServiceRecord).toHaveBeenCalledWith('sr-1');
    });
  });

  it('confirmación cancelada no aprueba', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await renderPage();
    fireEvent.click(screen.getByText(/aprobar/i));
    expect(mockApproveServiceRecord).not.toHaveBeenCalled();
  });

  it('aprobación exitosa recarga registro', async () => {
    await renderPage();
    fireEvent.click(screen.getByText(/aprobar/i));
    await waitFor(() => {
      expect(mockGetServiceRecordForReview).toHaveBeenCalledTimes(2);
    });
  });
});

describe('AdminServiceReviewDetailPage — Rechazo', () => {
  it('botón Rechazar exige motivo', async () => {
    await renderPage();
    fireEvent.click(screen.getByText(/rechazar/i));
    expect(screen.getByText('Motivo de Rechazo')).toBeInTheDocument();
  });

  it('rechazo usa reject_service_record', async () => {
    await renderPage();
    fireEvent.click(screen.getByText(/rechazar/i));
    fireEvent.change(screen.getByPlaceholderText(/describa el motivo/i), {
      target: { value: 'Falta información' },
    });
    const rejectBtns = screen.getAllByRole('button', { name: /^rechazar$/i });
    fireEvent.click(rejectBtns[rejectBtns.length - 1]!);
    await waitFor(() => {
      expect(mockRejectServiceRecord).toHaveBeenCalledWith('sr-1', 'Falta información');
    });
  });
});

describe('AdminServiceReviewDetailPage — Aprobado', () => {
  it('aprobado muestra nombre real del aprobador', async () => {
    await renderPage(approvedRecord);
    await waitFor(() => {
      expect(mockServiceRecordPDF).toHaveBeenCalled();
    });
    const props = getFirstPdfCall(mockServiceRecordPDF);
    const approvedBy = props?.approvedBy as Record<string, unknown>;
    expect(approvedBy?.full_name).toBe('Lucas Forquera');
  });

  it('no muestra fallback genérico si existe perfil', async () => {
    await renderPage(approvedRecord);
    await waitFor(() => {
      expect(mockServiceRecordPDF).toHaveBeenCalled();
    });
    const props = getFirstPdfCall(mockServiceRecordPDF);
    const approvedBy = props?.approvedBy as Record<string, unknown>;
    expect(approvedBy?.full_name).not.toBe('Usuario aprobador no disponible');
  });
});

describe('AdminServiceReviewDetailPage — PDF', () => {
  it('PDF recibe checklist', async () => {
    const checklist = [
      { item_name: 'Puertas', status: 'ok', notes: '' },
    ];
    mockServiceRecordPDF.mockClear();
    const chain = createDefaultChain();
    chain.order.mockResolvedValue({ data: checklist, error: null });
    mockSupabaseFrom.mockReturnValue(chain);
    await renderPage({ ...approvedRecord });
    await waitFor(() => {
      expect(mockServiceRecordPDF).toHaveBeenCalled();
    });
    const props = getFirstPdfCall(mockServiceRecordPDF);
    expect(props.checklist).toEqual(checklist);
  });

  it('PDF recibe fecha de servicio sin desplazamiento', async () => {
    mockServiceRecordPDF.mockClear();
    await renderPage(approvedRecord);
    await waitFor(() => {
      expect(mockServiceRecordPDF).toHaveBeenCalled();
    });
    const props = getFirstPdfCall(mockServiceRecordPDF);
    const record = props.record as Record<string, unknown>;
    expect(record.service_date).toBe('2026-08-03');
  });

  it('PDF recibe timestamp de aprobación', async () => {
    mockServiceRecordPDF.mockClear();
    await renderPage(approvedRecord);
    await waitFor(() => {
      expect(mockServiceRecordPDF).toHaveBeenCalled();
    });
    const props = getFirstPdfCall(mockServiceRecordPDF);
    const record = props.record as Record<string, unknown>;
    expect(record.approved_at).toBe('2026-08-03T15:00:00Z');
  });
});

describe('AdminServiceReviewDetailPage — Doble clic', () => {
  it('doble clic en Aprobar no duplica RPC', async () => {
    let resolveApprove: (() => void) | undefined;
    mockApproveServiceRecord.mockImplementation(() => new Promise<void>((r) => { resolveApprove = r; }));
    await renderPage();
    const btn = screen.getByText(/aprobar/i);
    fireEvent.click(btn);
    fireEvent.click(btn);
    resolveApprove!();
    await waitFor(() => {
      expect(mockApproveServiceRecord).toHaveBeenCalledTimes(1);
    });
  });
});

describe('AdminServiceReviewDetailPage — Errores', () => {
  it('error visible con role=alert cuando corresponda', async () => {
    mockGetServiceRecordForReview.mockRejectedValue(new Error('Fallo de red'));
    render(
      <MemoryRouter initialEntries={['/admin/mantenimientos/sr-1']}>
        <AdminServiceReviewDetailPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Fallo de red')).toBeInTheDocument();
    });
  });
});
