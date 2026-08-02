import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ElevatorForm from './ElevatorForm';

const { mockListClients, mockGetBuildingsByClient, mockListResponsible, mockCreateElevator, mockUpdateElevator, mockCreateAuditLog } = vi.hoisted(() => ({
  mockListClients: vi.fn(),
  mockGetBuildingsByClient: vi.fn(),
  mockListResponsible: vi.fn(),
  mockCreateElevator: vi.fn(),
  mockUpdateElevator: vi.fn(),
  mockCreateAuditLog: vi.fn(),
}));

vi.mock('@/services/clients.service', () => ({ listClients: (...a: unknown[]) => mockListClients(...a) }));
vi.mock('@/services/buildings.service', () => ({ getBuildingsByClient: (...a: unknown[]) => mockGetBuildingsByClient(...a) }));
vi.mock('@/services/profiles.service', () => ({ listResponsible: (...a: unknown[]) => mockListResponsible(...a) }));
vi.mock('@/services/elevators.service', () => ({ createElevator: (...a: unknown[]) => mockCreateElevator(...a), updateElevator: (...a: unknown[]) => mockUpdateElevator(...a) }));
vi.mock('@/services/audit.service', () => ({ createAuditLog: (...a: unknown[]) => mockCreateAuditLog(...a) }));
vi.mock('./RecipientsManager', () => ({ default: () => <div data-testid="recipients-manager">Destinatarios de informes</div> }));

const onSuccess = vi.fn();
const onCancel = vi.fn();

function renderForm(elevator?: Parameters<typeof ElevatorForm>[0]['elevator']) {
  return render(<MemoryRouter><ElevatorForm elevator={elevator} onSuccess={onSuccess} onCancel={onCancel} /></MemoryRouter>);
}

beforeEach(() => { vi.clearAllMocks(); mockListClients.mockResolvedValue([]); mockListResponsible.mockResolvedValue([]); mockGetBuildingsByClient.mockResolvedValue([]); });

describe('ElevatorForm — Creación', () => {
  it('no llama listResponsible', async () => {
    renderForm();
    await waitFor(() => { expect(mockListResponsible).not.toHaveBeenCalled(); });
  });

  it('no muestra selector editable Responsable Autorizado', async () => {
    renderForm();
    await waitFor(() => { expect(screen.getByText('Crear Ascensor')).toBeInTheDocument(); });
    expect(screen.queryByText('Responsable Autorizado')).not.toBeInTheDocument();
  });

  it('creación muestra Sin asignar', async () => {
    renderForm();
    await waitFor(() => { expect(screen.getByText('Crear Ascensor')).toBeInTheDocument(); });
    expect(screen.getByText('Sin asignar')).toBeInTheDocument();
  });

  it('creación muestra instrucción de asignar desde Usuarios', async () => {
    renderForm();
    await waitFor(() => { expect(screen.getByText('Crear Ascensor')).toBeInTheDocument(); });
    expect(screen.getByText(/Responsables de edificios/)).toBeInTheDocument();
  });

  it('creación no envía responsible_user_id', async () => {
    mockCreateElevator.mockResolvedValue({ id: 'new-1' });
    mockListClients.mockResolvedValue([{ id: 'c1', name: 'Test', active: true, code: 'C001', created_at: '', updated_at: '' }]);
    mockGetBuildingsByClient.mockResolvedValue([{ id: 'b1', name: 'Test', client_id: 'c1', code: 'B001', address: '', locality: '', province: '', active: true, created_at: '', updated_at: '' }]);
    renderForm();
    await waitFor(() => { expect(screen.getByText('Crear Ascensor')).toBeInTheDocument(); });
    fireEvent.change(screen.getByLabelText(/código/i), { target: { value: 'ASC-001' } });
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Test')).toBeInTheDocument(); });
    fireEvent.change(screen.getByLabelText(/edificio/i), { target: { value: 'b1' } });
    fireEvent.click(screen.getByText('Crear Ascensor'));
    await waitFor(() => { expect(mockCreateElevator).toHaveBeenCalledTimes(1); });
    const sent = mockCreateElevator.mock.calls[0][0];
    expect(sent).not.toHaveProperty('responsible_user_id');
  });
});

describe('ElevatorForm — Edición', () => {
  const elevator = {
    id: 'e1', code: 'ASC-001', client_id: 'c1', building_id: 'b1', elevator_type: 'pasajeros',
    serial_number: 'SN001', manufacturer: 'Otis', model: 'Gen2', capacity_kg: 630,
    floors_served: 'PB,1,2', year_installed: 2020, operational_status: 'operativo',
    conservation_status: 'conforme', contractual_status: 'activo', responsible_user_id: 'u1',
    conservation_company: 'SAETA', supervisor_name: 'Juan', supervisor_phone: '+54 299 123',
    qr_token: 'tok', building: { id: 'b1', name: 'Edificio', client_id: 'c1', code: 'B001', address: '', locality: '', province: '', active: true, created_at: '', updated_at: '' } as import('@/types/database').Building,     client: { id: 'c1', name: 'Cliente', code: 'C001', active: true, created_at: '', updated_at: '' } as import('@/types/database').Client,
    active: true, notes: '', created_at: '', updated_at: '',
  };

  it('edición asignada muestra Asignado', async () => {
    renderForm(elevator);
    await waitFor(() => { expect(screen.getByText('Asignado')).toBeInTheDocument(); });
  });

  it('edición asignada muestra instrucción de gestión centralizada', async () => {
    renderForm(elevator);
    await waitFor(() => { expect(screen.getByText(/Responsables de edificios/)).toBeInTheDocument(); });
  });

  it('edición no permite cambiar responsable', async () => {
    renderForm(elevator);
    await waitFor(() => { expect(screen.getByText('Actualizar')).toBeInTheDocument(); });
    expect(screen.queryByText('Responsable Autorizado')).not.toBeInTheDocument();
  });

  it('actualización no envía responsible_user_id', async () => {
    mockUpdateElevator.mockResolvedValue({ id: 'e1' });
    renderForm(elevator);
    await waitFor(() => { expect(screen.getByText('Actualizar')).toBeInTheDocument(); });
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => { expect(mockUpdateElevator).toHaveBeenCalledTimes(1); });
    const sent = mockUpdateElevator.mock.calls[0][1];
    expect(sent).not.toHaveProperty('responsible_user_id');
  });

  it('conserva empresa conservadora', async () => {
    renderForm(elevator);
    await waitFor(() => { expect(screen.getByDisplayValue('SAETA')).toBeInTheDocument(); });
  });

  it('conserva supervisor y teléfono', async () => {
    renderForm(elevator);
    await waitFor(() => {
      expect(screen.getByDisplayValue('Juan')).toBeInTheDocument();
      expect(screen.getByDisplayValue('+54 299 123')).toBeInTheDocument();
    });
  });

  it('conserva RecipientsManager en edición', async () => {
    renderForm(elevator);
    await waitFor(() => { expect(screen.getByText('Destinatarios de informes')).toBeInTheDocument(); });
  });
});

describe('ElevatorForm — Errores', () => {
  it('error de create se muestra', async () => {
    mockCreateElevator.mockRejectedValue(new Error('Falló create'));
    mockListClients.mockResolvedValue([{ id: 'c1', name: 'Test', active: true, code: 'C001', created_at: '', updated_at: '' }]);
    mockGetBuildingsByClient.mockResolvedValue([{ id: 'b1', name: 'Test', client_id: 'c1', code: 'B001', address: '', locality: '', province: '', active: true, created_at: '', updated_at: '' }]);
    renderForm();
    await waitFor(() => { expect(screen.getByText('Crear Ascensor')).toBeInTheDocument(); });
    fireEvent.change(screen.getByLabelText(/código/i), { target: { value: 'ASC-001' } });
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Test')).toBeInTheDocument(); });
    fireEvent.change(screen.getByLabelText(/edificio/i), { target: { value: 'b1' } });
    fireEvent.click(screen.getByText('Crear Ascensor'));
    await waitFor(() => { expect(screen.getByText('Falló create')).toBeInTheDocument(); });
  });

  it('error de update se muestra', async () => {
    mockUpdateElevator.mockRejectedValue(new Error('Falló update'));
    const elevator = {
      id: 'e1', code: 'ASC-001', client_id: 'c1', building_id: 'b1', elevator_type: 'pasajeros',
      serial_number: '', manufacturer: '', model: '', capacity_kg: 0,
      floors_served: '', year_installed: 0, operational_status: 'operativo',
      conservation_status: 'conforme', contractual_status: 'activo', responsible_user_id: '',
      conservation_company: '', supervisor_name: '', supervisor_phone: '',
      qr_token: 'tok', building: { id: 'b1', name: 'Edificio', client_id: 'c1', code: 'B001', address: '', locality: '', province: '', active: true, created_at: '', updated_at: '' } as import('@/types/database').Building,     client: { id: 'c1', name: 'Cliente', code: 'C001', active: true, created_at: '', updated_at: '' } as import('@/types/database').Client,
      active: true, notes: '', created_at: '', updated_at: '',
    };
    renderForm(elevator);
    await waitFor(() => { expect(screen.getByText('Actualizar')).toBeInTheDocument(); });
    fireEvent.submit(document.querySelector('form')!);
    await waitFor(() => { expect(screen.getByText('Falló update')).toBeInTheDocument(); });
  });
});

describe('ElevatorForm — Doble envío', () => {
  it('submit pendiente evita doble envío', async () => {
    let resolve!: (v: unknown) => void;
    mockCreateElevator.mockReturnValue(new Promise((r) => { resolve = r; }));
    mockListClients.mockResolvedValue([{ id: 'c1', name: 'Test', active: true, code: 'C001', created_at: '', updated_at: '' }]);
    mockGetBuildingsByClient.mockResolvedValue([{ id: 'b1', name: 'Test', client_id: 'c1', code: 'B001', address: '', locality: '', province: '', active: true, created_at: '', updated_at: '' }]);
    renderForm();
    await waitFor(() => { expect(screen.getByText('Crear Ascensor')).toBeInTheDocument(); });
    fireEvent.change(screen.getByLabelText(/código/i), { target: { value: 'ASC-001' } });
    fireEvent.change(screen.getByLabelText(/cliente/i), { target: { value: 'c1' } });
    await waitFor(() => { expect(screen.getByText('Test')).toBeInTheDocument(); });
    fireEvent.change(screen.getByLabelText(/edificio/i), { target: { value: 'b1' } });
    fireEvent.click(screen.getByText('Crear Ascensor'));
    fireEvent.click(screen.getByText('Crear Ascensor'));
    expect(mockCreateElevator).toHaveBeenCalledTimes(1);
    resolve({ id: 'new-1' });
    await waitFor(() => { expect(onSuccess).toHaveBeenCalled(); });
  });
});
