import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ServiceRecordDetail from './ServiceRecordDetail';

const { mockGetServiceRecordById } = vi.hoisted(() => ({
  mockGetServiceRecordById: vi.fn(),
}));

vi.mock('@/services/serviceRecords.service', () => ({
  getServiceRecordById: (...args: unknown[]) => mockGetServiceRecordById(...args),
}));

vi.mock('@/config/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'tech-1' } } }) },
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://example.com' } }),
      })),
    },
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: () => ({ id: 'r1' }), useNavigate: () => vi.fn() };
});

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'tech-1' },
    profile: { id: 'tech-1', full_name: 'Técnico 1', role: 'technician', email: 't@t.com', active: true, created_at: '', updated_at: '' },
    logout: () => Promise.resolve(),
    login: () => Promise.resolve({ error: null }),
    getRedirectPath: () => '/',
    hasRole: () => true,
    isAdmin: false,
    isTechnician: true,
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

vi.mock('@/components/service/ServiceChecklist', () => ({
  default: ({ items, readOnly }: { items: Array<{ item_name: string; status: string }>; readOnly?: boolean }) => (
    <div data-testid="service-checklist" data-readonly={readOnly ? 'true' : 'false'}>
      {items.map((item) => (
        <span key={item.item_name}>{item.item_name}</span>
      ))}
    </div>
  ),
}));

vi.mock('@/components/service/ServicePhotoUpload', () => ({
  default: ({ photos, readOnly }: { photos: Array<{ id: string }>; readOnly?: boolean }) => (
    <div data-testid="service-photo-upload" data-readonly={readOnly ? 'true' : 'false'}>
      {photos.map((p) => (
        <span key={p.id}>foto-{p.id}</span>
      ))}
    </div>
  ),
}));

function makeRecord(overrides = {}) {
  return {
    id: 'r1', elevator_id: 'e1', technician_id: 'tech-1', service_date: '2026-08-03',
    service_type: 'preventivo', status: 'draft', description: 'Test description',
    observations: 'Test observations', technical_report: 'Test report',
    operational_status_at_service: 'operativo', conservation_status_at_service: 'conforme',
    created_at: '2026-08-03T10:00:00Z', updated_at: '2026-08-03T10:00:00Z',
    elevator: {
      id: 'e1', code: 'ASC-001', manufacturer: 'Otis', model: 'Gen2',
      operational_status: 'operativo', conservation_status: 'conforme',
      building: { name: 'Edificio', address: 'Av. Test', locality: 'Comodoro', client: { name: 'Cliente' } },
    },
    checklist: [], photos: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe('ServiceRecordDetail — Carga', () => {
  it('carga el mantenimiento', async () => {
    mockGetServiceRecordById.mockResolvedValue(makeRecord());
    render(<MemoryRouter><ServiceRecordDetail /></MemoryRouter>);
    await waitFor(() => {
      expect(mockGetServiceRecordById).toHaveBeenCalledWith('r1');
    });
  });
});

describe('ServiceRecordDetail — Ascensor', () => {
  it('muestra ascensor', async () => {
    mockGetServiceRecordById.mockResolvedValue(makeRecord());
    render(<MemoryRouter><ServiceRecordDetail /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('ASC-001')).toBeInTheDocument();
      expect(screen.getByText(/Otis/)).toBeInTheDocument();
      expect(screen.getByText(/Gen2/)).toBeInTheDocument();
    });
  });
});

describe('ServiceRecordDetail — Checklist', () => {
  it('muestra checklist', async () => {
    mockGetServiceRecordById.mockResolvedValue(makeRecord({
      checklist: [
        { item_name: 'Estado de puertas', status: 'ok', notes: '' },
        { item_name: 'Botonera de cabina', status: 'needs_attention', notes: '' },
      ],
    }));
    render(<MemoryRouter><ServiceRecordDetail /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByTestId('service-checklist')).toBeInTheDocument();
      expect(screen.getByText('Estado de puertas')).toBeInTheDocument();
      expect(screen.getByText('Botonera de cabina')).toBeInTheDocument();
    });
  });
});

describe('ServiceRecordDetail — Notas', () => {
  it('muestra notas', async () => {
    mockGetServiceRecordById.mockResolvedValue(makeRecord());
    render(<MemoryRouter><ServiceRecordDetail /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Test description')).toBeInTheDocument();
      expect(screen.getByText('Test observations')).toBeInTheDocument();
      expect(screen.getByText('Test report')).toBeInTheDocument();
    });
  });
});

describe('ServiceRecordDetail — Fotos', () => {
  it('muestra fotos', async () => {
    mockGetServiceRecordById.mockResolvedValue(makeRecord({
      photos: [{ id: 'p1', storage_path: 'r1/photo1.jpg', photo_type: 'general' }],
    }));
    render(<MemoryRouter><ServiceRecordDetail /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByTestId('service-photo-upload')).toBeInTheDocument();
      expect(screen.getByText('foto-p1')).toBeInTheDocument();
    });
  });
});

describe('ServiceRecordDetail — Permisos por estado', () => {
  it('borrador permite editar', async () => {
    mockGetServiceRecordById.mockResolvedValue(makeRecord({ status: 'draft' }));
    render(<MemoryRouter><ServiceRecordDetail /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /editar/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /enviar a revisión/i })).toBeInTheDocument();
    });
  });

  it('enviado no permite editar', async () => {
    mockGetServiceRecordById.mockResolvedValue(makeRecord({ status: 'submitted' }));
    render(<MemoryRouter><ServiceRecordDetail /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /enviar a revisión/i })).not.toBeInTheDocument();
    });
  });

  it('rechazado permite editar', async () => {
    mockGetServiceRecordById.mockResolvedValue(makeRecord({ status: 'rejected' }));
    render(<MemoryRouter><ServiceRecordDetail /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /editar/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /enviar a revisión/i })).not.toBeInTheDocument();
    });
  });

  it('aprobado no permite modificar', async () => {
    mockGetServiceRecordById.mockResolvedValue(makeRecord({ status: 'approved' }));
    render(<MemoryRouter><ServiceRecordDetail /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /enviar a revisión/i })).not.toBeInTheDocument();
    });
  });
});

describe('ServiceRecordDetail — Error', () => {
  it('error de carga visible', async () => {
    mockGetServiceRecordById.mockRejectedValue(new Error('Registro no encontrado'));
    render(<MemoryRouter><ServiceRecordDetail /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Registro no encontrado')).toBeInTheDocument();
    });
  });
});

describe('ServiceRecordDetail — Registro inexistente', () => {
  it('registro inexistente manejado correctamente', async () => {
    mockGetServiceRecordById.mockResolvedValue(null);
    render(<MemoryRouter><ServiceRecordDetail /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Registro no encontrado')).toBeInTheDocument();
    });
  });
});

describe('ServiceRecordDetail — Fecha', () => {
  it('muestra fecha sin desplazamiento', async () => {
    mockGetServiceRecordById.mockResolvedValue(makeRecord({ service_date: '2026-08-03' }));
    render(<MemoryRouter><ServiceRecordDetail /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('3/8/2026')).toBeInTheDocument();
    });
  });
});
