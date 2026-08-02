import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ElevatorsPage from './ElevatorsPage';

const { mockListElevators, mockSearchElevators, mockFilterElevators, mockDeactivateElevator, mockReactivateElevator, mockListClients, mockCreateAuditLog } = vi.hoisted(() => ({
  mockListElevators: vi.fn(),
  mockSearchElevators: vi.fn(),
  mockFilterElevators: vi.fn(),
  mockDeactivateElevator: vi.fn(),
  mockReactivateElevator: vi.fn(),
  mockListClients: vi.fn(),
  mockCreateAuditLog: vi.fn(),
}));

vi.mock('@/services/elevators.service', () => ({
  listElevators: (...a: unknown[]) => mockListElevators(...a),
  searchElevators: (...a: unknown[]) => mockSearchElevators(...a),
  filterElevators: (...a: unknown[]) => mockFilterElevators(...a),
  deactivateElevator: (...a: unknown[]) => mockDeactivateElevator(...a),
  reactivateElevator: (...a: unknown[]) => mockReactivateElevator(...a),
}));

vi.mock('@/services/clients.service', () => ({ listClients: (...a: unknown[]) => mockListClients(...a) }));
vi.mock('@/services/audit.service', () => ({ createAuditLog: (...a: unknown[]) => mockCreateAuditLog(...a) }));
vi.mock('@/components/layout/Sidebar', () => ({ default: () => <div data-testid="sidebar" /> }));
vi.mock('@/components/qr/ModalQR', () => ({ default: () => <div data-testid="modal-qr" /> }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'admin1' },
    profile: { id: 'admin1', full_name: 'Admin', role: 'admin', email: 'a@a.com', active: true, created_at: '', updated_at: '' },
    logout: () => Promise.resolve(), login: () => Promise.resolve({ error: null }),
    getRedirectPath: () => '/', hasRole: () => true, isAdmin: true, isTechnician: false,
    isSupervisor: false, isResponsible: false, isAuthenticated: true, loading: false, error: null,
  })),
}));

function makeElevator(overrides: Record<string, unknown> = {}) {
  return {
    id: 'e1', code: 'ASC-001', client_id: 'c1', building_id: 'b1', active: true,
    operational_status: 'operativo', conservation_status: 'conforme', contractual_status: 'activo',
    responsible_user_id: null, qr_token: 'tok', serial_number: '', manufacturer: '', model: '',
    capacity_kg: 0, floors_served: '', year_installed: 0, elevator_type: 'pasajeros',
    conservation_company: '', supervisor_name: '', supervisor_phone: '', notes: '',
    building: { name: 'Edificio Centro', client_id: 'c1' }, client: { name: 'Cliente Alpha' },
    created_at: '', updated_at: '', ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockListClients.mockResolvedValue([]);
  mockFilterElevators.mockResolvedValue([]);
  mockFilterElevators.mockResolvedValue([]);
  mockSearchElevators.mockResolvedValue([]);
  mockDeactivateElevator.mockResolvedValue(undefined);
  mockReactivateElevator.mockResolvedValue(undefined);
  mockCreateAuditLog.mockResolvedValue(undefined);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => { vi.restoreAllMocks(); });

describe('ElevatorsPage — Filtro de vigencia', () => {
  it('filtro inicial es Activos', async () => {
    render(<MemoryRouter><ElevatorsPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('No hay ascensores activos.')).toBeInTheDocument(); });
  });

  it('filtro Inactivos solicita active=false', async () => {
    render(<MemoryRouter><ElevatorsPage /></MemoryRouter>);
    await waitFor(() => { expect(mockFilterElevators).toHaveBeenCalled(); });
    const lastCall = mockFilterElevators.mock.calls[mockFilterElevators.mock.calls.length - 1][0];
    expect(lastCall.active).toBe(true);
    fireEvent.change(screen.getByLabelText(/vigencia/i), { target: { value: 'inactive' } });
    await waitFor(() => {
      const call = mockFilterElevators.mock.calls[mockFilterElevators.mock.calls.length - 1][0];
      expect(call.active).toBe(false);
    });
  });

  it('filtro Todos no filtra active', async () => {
    render(<MemoryRouter><ElevatorsPage /></MemoryRouter>);
    await waitFor(() => { expect(mockFilterElevators).toHaveBeenCalled(); });
    fireEvent.change(screen.getByLabelText(/vigencia/i), { target: { value: 'all' } });
    await waitFor(() => {
      const call = mockFilterElevators.mock.calls[mockFilterElevators.mock.calls.length - 1][0];
      expect(call.active).toBeUndefined();
    });
  });
});

describe('ElevatorsPage — Visualización', () => {
  it('muestra columnas Estado operativo y Vigencia', async () => {
    mockFilterElevators.mockResolvedValue([makeElevator()]);
    render(<MemoryRouter><ElevatorsPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('ASC-001')).toBeInTheDocument(); });
    expect(screen.getAllByText('Operativo').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Activo').length).toBeGreaterThanOrEqual(1);
  });

  it('activo muestra badge Activo', async () => {
    mockFilterElevators.mockResolvedValue([makeElevator({ active: true })]);
    render(<MemoryRouter><ElevatorsPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('Activo')).toBeInTheDocument(); });
  });

  it('inactivo muestra badge Inactivo', async () => {
    mockFilterElevators.mockResolvedValue([makeElevator({ active: false })]);
    render(<MemoryRouter><ElevatorsPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('Inactivo')).toBeInTheDocument(); });
  });

  it('activo muestra Desactivar', async () => {
    mockFilterElevators.mockResolvedValue([makeElevator({ active: true })]);
    render(<MemoryRouter><ElevatorsPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByTitle(/Desactivar ascensor/)).toBeInTheDocument(); });
  });

  it('inactivo muestra Reactivar', async () => {
    mockFilterElevators.mockResolvedValue([makeElevator({ active: false })]);
    render(<MemoryRouter><ElevatorsPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByTitle(/Reactivar ascensor/)).toBeInTheDocument(); });
  });

  it('no muestra papelera como Eliminar', async () => {
    mockFilterElevators.mockResolvedValue([makeElevator()]);
    render(<MemoryRouter><ElevatorsPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('ASC-001')).toBeInTheDocument(); });
    expect(screen.queryByTitle(/Eliminar/)).not.toBeInTheDocument();
  });

  it('nombres de cliente y edificio se muestran sin any', async () => {
    mockFilterElevators.mockResolvedValue([makeElevator()]);
    render(<MemoryRouter><ElevatorsPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('Cliente Alpha')).toBeInTheDocument(); });
    expect(screen.getByText('Edificio Centro')).toBeInTheDocument();
  });

  it('estado vacío Activos', async () => {
    render(<MemoryRouter><ElevatorsPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('No hay ascensores activos.')).toBeInTheDocument(); });
  });

  it('estado vacío Inactivos', async () => {
    render(<MemoryRouter><ElevatorsPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText(/ascensores/)).toBeInTheDocument(); });
    fireEvent.change(screen.getByLabelText(/vigencia/i), { target: { value: 'inactive' } });
    await waitFor(() => { expect(screen.getByText('No hay ascensores inactivos.')).toBeInTheDocument(); });
  });
});

describe('ElevatorsPage — Desactivación', () => {
  it('asignado no puede desactivarse', async () => {
    mockFilterElevators.mockResolvedValue([makeElevator({ responsible_user_id: 'u1' })]);
    render(<MemoryRouter><ElevatorsPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('ASC-001')).toBeInTheDocument(); });
    fireEvent.click(screen.getByTitle(/Desactivar ascensor/));
    await waitFor(() => { expect(screen.getByRole('alert')).toHaveTextContent(/retiralo del responsable/); });
    expect(mockDeactivateElevator).not.toHaveBeenCalled();
  });

  it('desactivación confirmada llama una vez', async () => {
    mockFilterElevators.mockResolvedValue([makeElevator({ responsible_user_id: null })]);
    render(<MemoryRouter><ElevatorsPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('ASC-001')).toBeInTheDocument(); });
    fireEvent.click(screen.getByTitle(/Desactivar ascensor/));
    await waitFor(() => { expect(mockDeactivateElevator).toHaveBeenCalledTimes(1); });
  });

  it('éxito de desactivación visible', async () => {
    mockFilterElevators.mockResolvedValue([makeElevator({ responsible_user_id: null })]);
    render(<MemoryRouter><ElevatorsPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('ASC-001')).toBeInTheDocument(); });
    fireEvent.click(screen.getByTitle(/Desactivar ascensor/));
    await waitFor(() => { expect(screen.getByRole('status')).toHaveTextContent(/desactivado correctamente/); });
  });

  it('cancelación no ejecuta acción', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    mockFilterElevators.mockResolvedValue([makeElevator({ responsible_user_id: null })]);
    render(<MemoryRouter><ElevatorsPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('ASC-001')).toBeInTheDocument(); });
    fireEvent.click(screen.getByTitle(/Desactivar ascensor/));
    expect(mockDeactivateElevator).not.toHaveBeenCalled();
  });

  it('doble click produce una llamada', async () => {
    mockFilterElevators.mockResolvedValue([makeElevator({ responsible_user_id: null })]);
    render(<MemoryRouter><ElevatorsPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('ASC-001')).toBeInTheDocument(); });
    fireEvent.click(screen.getByTitle(/Desactivar ascensor/));
    fireEvent.click(screen.getByTitle(/Desactivar ascensor/));
    expect(mockDeactivateElevator).toHaveBeenCalledTimes(1);
  });
});

describe('ElevatorsPage — Reactivación', () => {
  it('reactivación confirmada llama una vez', async () => {
    mockFilterElevators.mockResolvedValue([makeElevator({ active: false })]);
    render(<MemoryRouter><ElevatorsPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('ASC-001')).toBeInTheDocument(); });
    fireEvent.click(screen.getByTitle(/Reactivar ascensor/));
    await waitFor(() => { expect(mockReactivateElevator).toHaveBeenCalledTimes(1); });
  });

  it('éxito de reactivación visible', async () => {
    mockFilterElevators.mockResolvedValue([makeElevator({ active: false })]);
    render(<MemoryRouter><ElevatorsPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('ASC-001')).toBeInTheDocument(); });
    fireEvent.click(screen.getByTitle(/Reactivar ascensor/));
    await waitFor(() => { expect(screen.getByRole('status')).toHaveTextContent(/reactivado correctamente/); });
  });
});

describe('ElevatorsPage — Errores', () => {
  it('error de carga visible', async () => {
    mockFilterElevators.mockRejectedValueOnce(new Error('Falló'));
    render(<MemoryRouter><ElevatorsPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByRole('alert')).toHaveTextContent(/No se pudieron cargar/); });
  });

  it('error de desactivación visible', async () => {
    mockFilterElevators.mockResolvedValue([makeElevator({ responsible_user_id: null })]);
    mockDeactivateElevator.mockRejectedValueOnce(new Error('Falló'));
    render(<MemoryRouter><ElevatorsPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('ASC-001')).toBeInTheDocument(); });
    fireEvent.click(screen.getByTitle(/Desactivar ascensor/));
    await waitFor(() => { expect(screen.getByRole('alert')).toHaveTextContent(/No se pudo desactivar/); });
  });

  it('error de reactivación visible', async () => {
    mockFilterElevators.mockResolvedValue([makeElevator({ active: false })]);
    mockReactivateElevator.mockRejectedValueOnce(new Error('Falló'));
    render(<MemoryRouter><ElevatorsPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('ASC-001')).toBeInTheDocument(); });
    fireEvent.click(screen.getByTitle(/Reactivar ascensor/));
    await waitFor(() => { expect(screen.getByRole('alert')).toHaveTextContent(/No se pudo reactivar/); });
  });

  it('botones de acción tienen type button', async () => {
    mockFilterElevators.mockResolvedValue([makeElevator()]);
    render(<MemoryRouter><ElevatorsPage /></MemoryRouter>);
    await waitFor(() => { expect(screen.getByText('ASC-001')).toBeInTheDocument(); });
    const actionButtons = screen.getAllByRole('button').filter((b) => b.getAttribute('type') === 'button');
    expect(actionButtons.length).toBeGreaterThan(0);
  });
});
