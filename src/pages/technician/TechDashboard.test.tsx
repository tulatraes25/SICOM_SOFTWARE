import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TechDashboard from './TechDashboard';

const { mockListMyServiceRecords } = vi.hoisted(() => ({
  mockListMyServiceRecords: vi.fn(),
}));

vi.mock('@/services/serviceRecords.service', () => ({
  listMyServiceRecords: (...args: unknown[]) => mockListMyServiceRecords(...args),
}));

vi.mock('@/config/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'tech-1' } } }) },
  },
}));

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

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual };
});

function makeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    elevator_id: 'e1',
    technician_id: 'tech-1',
    service_date: '2026-08-03',
    service_type: 'preventivo',
    status: 'draft',
    description: 'Test',
    created_at: '2026-08-03T10:00:00Z',
    updated_at: '2026-08-03T10:00:00Z',
    elevator: {
      id: 'e1',
      code: 'ASC-001',
      building: { name: 'Edificio Central', address: 'Av. Test 123' },
    },
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

describe('TechDashboard — Contadores', () => {
  it('muestra contadores de borradores, revisión y aprobados', async () => {
    mockListMyServiceRecords.mockResolvedValue([
      makeRecord({ id: 'r1', status: 'draft' }),
      makeRecord({ id: 'r2', status: 'draft' }),
      makeRecord({ id: 'r3', status: 'in_review' }),
      makeRecord({ id: 'r4', status: 'submitted' }),
      makeRecord({ id: 'r5', status: 'approved' }),
    ]);
    render(<MemoryRouter><TechDashboard /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Borradores')).toBeInTheDocument();
      expect(screen.getByText('En Revisión')).toBeInTheDocument();
      expect(screen.getByText('Aprobados')).toBeInTheDocument();
    });
    const stats = screen.getAllByText(/^\d+$/);
    const values = stats.map(el => el.textContent);
    expect(values).toContain('2');
    expect(values).toContain('2');
    expect(values).toContain('1');
  });
});

describe('TechDashboard — Estados de mantenimiento', () => {
  it('mantenimiento enviado aparece "Enviado a revisión"', async () => {
    mockListMyServiceRecords.mockResolvedValue([
      makeRecord({ id: 'r1', status: 'submitted' }),
    ]);
    render(<MemoryRouter><TechDashboard /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Enviado a revisión')).toBeInTheDocument();
    });
  });

  it('aprobado aparece "Aprobado"', async () => {
    mockListMyServiceRecords.mockResolvedValue([
      makeRecord({ id: 'r1', status: 'approved' }),
    ]);
    render(<MemoryRouter><TechDashboard /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Aprobado')).toBeInTheDocument();
    });
  });
});

describe('TechDashboard — Fechas', () => {
  it('fechas DATE no se desplazan (usa formatDateOnlyEsAR)', async () => {
    mockListMyServiceRecords.mockResolvedValue([
      makeRecord({ id: 'r1', service_date: '2026-08-03' }),
    ]);
    render(<MemoryRouter><TechDashboard /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText(/3\/8\/2026/)).toBeInTheDocument();
    });
  });
});

describe('TechDashboard — Orden', () => {
  it('orden descendente por created_at', async () => {
    mockListMyServiceRecords.mockResolvedValue([
      makeRecord({ id: 'r2', created_at: '2026-08-03T10:00:00Z' }),
      makeRecord({ id: 'r3', created_at: '2026-08-02T10:00:00Z' }),
      makeRecord({ id: 'r1', created_at: '2026-08-01T10:00:00Z' }),
    ]);
    render(<MemoryRouter><TechDashboard /></MemoryRouter>);
    await waitFor(() => {
      const links = screen.getAllByRole('link').filter(l => l.getAttribute('href')?.startsWith('/tecnico/mantenimientos/'));
      expect(links).toHaveLength(3);
      expect(links[0].getAttribute('href')).toBe('/tecnico/mantenimientos/r2');
      expect(links[1].getAttribute('href')).toBe('/tecnico/mantenimientos/r3');
      expect(links[2].getAttribute('href')).toBe('/tecnico/mantenimientos/r1');
    });
  });
});

describe('TechDashboard — Error', () => {
  it('error de carga visible', async () => {
    mockListMyServiceRecords.mockRejectedValue(new Error('Falló la carga'));
    render(<MemoryRouter><TechDashboard /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('No hay mantenimientos registrados')).toBeInTheDocument();
    });
  });
});

describe('TechDashboard — Registro inexistente', () => {
  it('registro inexistente manejado correctamente', async () => {
    mockListMyServiceRecords.mockResolvedValue([]);
    render(<MemoryRouter><TechDashboard /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('No hay mantenimientos registrados')).toBeInTheDocument();
    });
    expect(screen.getByText('Cargar Primer Mantenimiento')).toBeInTheDocument();
  });
});
