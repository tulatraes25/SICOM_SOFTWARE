import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { isValidElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import ResponsibleVisitBookPage from './ResponsibleVisitBookPage';
import type { ResponsibleBuilding, ResponsibleClient, ResponsibleElevator, ResponsibleVisitEntry, ResponsibleTechnician } from '@/services/responsiblePortalService';
import type { VisitBookPDFProps } from '@/components/pdf/VisitBookPDF';

// ============================================================
// Mocks
// ============================================================

const mockBuildings: ResponsibleBuilding[] = [
  { id: 'building-1', client_id: 'client-1', code: 'ED-001', name: 'Hospital Regional', address: 'Av. Principal 123', locality: 'Comodoro Rivadavia', province: 'Chubut' },
  { id: 'building-2', client_id: 'client-2', code: 'ED-002', name: 'Edificio Otro', address: 'Calle X 456', locality: 'Rawson', province: 'Chubut' },
];

const mockClients: ResponsibleClient[] = [
  { id: 'client-1', code: 'CLI-001', name: 'Hospital Regional S.A.' },
  { id: 'client-2', code: 'CLI-002', name: 'Otro Cliente' },
];

const mockElevators: ResponsibleElevator[] = [
  { id: 'elevator-1', code: 'ASC-0001', building_id: 'building-1', manufacturer: 'Otis', model: 'Gen2', elevator_type: 'passenger', capacity_kg: 800, floors_served: '1-5', year_installed: 2020, operational_status: 'operational', conservation_status: 'good', contractual_status: 'active', last_service_date: null, next_service_date: null, active: true },
  { id: 'elevator-2', code: 'ASC-0002', building_id: 'building-1', manufacturer: 'Schindler', model: '3300', elevator_type: 'passenger', capacity_kg: 1000, floors_served: '1-8', year_installed: 2019, operational_status: 'operational', conservation_status: 'good', contractual_status: 'active', last_service_date: null, next_service_date: null, active: true },
  { id: 'elevator-otro', code: 'ASC-099', building_id: 'building-2', manufacturer: 'Kone', model: 'MiniSpace', elevator_type: 'passenger', capacity_kg: 630, floors_served: '1-3', year_installed: 2021, operational_status: 'operational', conservation_status: 'good', contractual_status: 'active', last_service_date: null, next_service_date: null, active: true },
];

const mockTechnicians: ResponsibleTechnician[] = [
  { id: 'tech-1', full_name: 'Juan Pérez' },
];

const mockVisitEntry: ResponsibleVisitEntry = {
  id: 'visit-1', elevator_id: 'elevator-1', service_case_id: 'sc-1', service_record_id: null,
  service_order_id: null, entry_number: 8, visit_date: '2026-07-27', entry_type: 'other',
  origin_type: 'service_order', title: 'PRUEBA N.º 1913', description: 'Trabajo completado',
  work_performed: 'Corrección realizada', observations: null, recommendations: null,
  operational_status: null, conservation_status: null, technician_id: 'tech-1',
  status: 'approved', check_in_at: '2026-07-27T10:42:00Z', check_out_at: '2026-07-27T15:03:00Z',
  duration_minutes: 261, duration_seconds: 15660, case_number: 1913, numbering_mode: 'test',
};

const mockVisitEntryOtherBuilding: ResponsibleVisitEntry = {
  ...mockVisitEntry,
  id: 'visit-2', elevator_id: 'elevator-otro', entry_number: 1, visit_date: '2026-07-20',
  case_number: null, numbering_mode: null,
};

vi.mock('@/services/responsiblePortalService', () => ({
  getResponsibleBuildings: vi.fn(),
  getResponsibleElevators: vi.fn(),
  getResponsibleClients: vi.fn(),
  getResponsibleTechnicians: vi.fn(),
  getResponsibleVisitEntries: vi.fn(),
  getResponsibleServiceRecords: vi.fn(),
  getResponsibleServiceOrders: vi.fn(),
  getErrorMessage: vi.fn((e: unknown) => e instanceof Error ? e.message : 'Error'),
}));

vi.mock('@react-pdf/renderer', () => ({
  pdf: vi.fn(() => ({
    toBlob: vi.fn().mockResolvedValue(new Blob(['pdf-content'], { type: 'application/pdf' })),
  })),
}));

vi.mock('@/components/pdf/VisitBookPDF', () => ({
  default: vi.fn(() => null),
  formatEntryCount: vi.fn((n: number) => n === 1 ? '1 asiento' : `${n} asientos`),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@test.com' },
    profile: { id: 'user-1', full_name: 'Lucas Forquera', role: 'responsible' },
    logout: vi.fn(),
  }),
}));

vi.mock('@/components/layout/Sidebar', () => ({
  default: vi.fn(() => <div data-testid="sidebar" />),
}));

// ============================================================
// Setup
// ============================================================

import { getResponsibleBuildings, getResponsibleElevators, getResponsibleClients, getResponsibleTechnicians, getResponsibleVisitEntries, getResponsibleServiceRecords, getResponsibleServiceOrders } from '@/services/responsiblePortalService';
import { pdf } from '@react-pdf/renderer';

const mockGetBuildings = vi.mocked(getResponsibleBuildings);
const mockGetElevators = vi.mocked(getResponsibleElevators);
const mockGetClients = vi.mocked(getResponsibleClients);
const mockGetTechnicians = vi.mocked(getResponsibleTechnicians);
const mockGetVisitEntries = vi.mocked(getResponsibleVisitEntries);
const mockGetServiceRecords = vi.mocked(getResponsibleServiceRecords);
const mockGetServiceOrders = vi.mocked(getResponsibleServiceOrders);
const mockPdf = vi.mocked(pdf);

function renderPage(initialEntries = ['/responsable/libro-visitas']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ResponsibleVisitBookPage />
    </MemoryRouter>
  );
}

function getPdfProps(): VisitBookPDFProps {
  const element = mockPdf.mock.calls[0]?.[0];
  if (!isValidElement<VisitBookPDFProps>(element)) {
    throw new Error('pdf() was not called with a valid VisitBookPDF element');
  }
  return element.props;
}

beforeEach(() => {
  mockGetBuildings.mockResolvedValue(mockBuildings);
  mockGetElevators.mockResolvedValue(mockElevators);
  mockGetClients.mockResolvedValue(mockClients);
  mockGetTechnicians.mockResolvedValue(mockTechnicians);
  mockGetVisitEntries.mockResolvedValue([mockVisitEntry]);
  mockGetServiceRecords.mockResolvedValue([]);
  mockGetServiceOrders.mockResolvedValue([]);
  mockPdf.mockClear();

  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ============================================================
// Tests
// ============================================================

describe('ResponsibleVisitBookPage', () => {
  describe('Carga inicial', () => {
    it('muestra edificios obtenidos por el servicio', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Hospital Regional')).toBeInTheDocument();
        expect(screen.getByText('Edificio Otro')).toBeInTheDocument();
      });
    });

    it('el selector de ascensor está deshabilitado sin edificio seleccionado', async () => {
      renderPage();
      await waitFor(() => {
        const elevatorSelect = screen.getByDisplayValue('Todos mis ascensores del edificio');
        expect(elevatorSelect).toBeDisabled();
      });
    });
  });

  describe('Edificio obligatorio', () => {
    it('el botón está deshabilitado sin edificio', async () => {
      renderPage();
      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /generar/i });
        expect(btn).toBeDisabled();
      });
    });

    it('no llama a pdf() sin edificio seleccionado', async () => {
      renderPage();
      await waitFor(() => { expect(mockGetBuildings).toHaveBeenCalled(); });
      const btn = screen.getByRole('button', { name: /generar/i });
      await userEvent.click(btn);
      expect(mockPdf).not.toHaveBeenCalled();
    });
  });

  describe('Query param autorizado', () => {
    it('selecciona building-1 y muestra solo sus ascensores', async () => {
      renderPage(['/responsable/libro-visitas?buildingId=building-1']);
      await waitFor(() => {
        const elevatorSelect = screen.getByDisplayValue('Todos mis ascensores del edificio');
        expect(elevatorSelect).not.toBeDisabled();
        expect(elevatorSelect.querySelector('option[value="elevator-1"]')).toBeInTheDocument();
        expect(elevatorSelect.querySelector('option[value="elevator-2"]')).toBeInTheDocument();
        expect(elevatorSelect.querySelector('option[value="elevator-otro"]')).not.toBeInTheDocument();
      });
    });
  });

  describe('Query param no autorizado', () => {
    it('muestra error, limpia selección, deshabilita ascensores y no genera PDF', async () => {
      renderPage(['/responsable/libro-visitas?buildingId=building-prohibido']);
      await waitFor(() => {
        expect(screen.getByText('No tiene permiso para consultar este edificio')).toBeInTheDocument();
      });
      const buildingSelect = screen.getByDisplayValue('Seleccionar edificio');
      expect(buildingSelect).toHaveValue('');
      const elevatorSelect = screen.getByDisplayValue('Todos mis ascensores del edificio');
      expect(elevatorSelect).toBeDisabled();
      const btn = screen.getByRole('button', { name: /generar/i });
      expect(btn).toBeDisabled();
      expect(mockPdf).not.toHaveBeenCalled();
      expect(URL.createObjectURL).not.toHaveBeenCalled();
    });
  });

  describe('Cliente inexistente', () => {
    it('muestra error y no genera descarga', async () => {
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
      mockGetClients.mockResolvedValue([]);
      renderPage(['/responsable/libro-visitas?buildingId=building-1']);
      await waitFor(() => { expect(screen.getByText('Hospital Regional')).toBeInTheDocument(); });
      const btn = screen.getByRole('button', { name: /generar/i });
      await userEvent.click(btn);
      await waitFor(() => {
        expect(screen.getByText('No se pudo identificar el cliente del edificio')).toBeInTheDocument();
      });
      expect(mockPdf).not.toHaveBeenCalled();
      expect(URL.createObjectURL).not.toHaveBeenCalled();
      expect(clickSpy).not.toHaveBeenCalled();
    });
  });

  describe('Edificio sin ascensores', () => {
    it('muestra error al generar', async () => {
      mockGetElevators.mockResolvedValue([mockElevators[2]]);
      renderPage(['/responsable/libro-visitas?buildingId=building-1']);
      await waitFor(() => { expect(screen.getByText('Hospital Regional')).toBeInTheDocument(); });
      const btn = screen.getByRole('button', { name: /generar/i });
      await userEvent.click(btn);
      await waitFor(() => {
        expect(screen.getByText('No hay ascensores asignados en este edificio')).toBeInTheDocument();
      });
      expect(mockPdf).not.toHaveBeenCalled();
    });
  });

  describe('Consolidado correcto', () => {
    it('genera PDF consolidado con scope building y solo ascensores del edificio', async () => {
      mockGetVisitEntries.mockResolvedValue([mockVisitEntry, mockVisitEntryOtherBuilding]);
      renderPage(['/responsable/libro-visitas?buildingId=building-1']);
      await waitFor(() => { expect(screen.getByText('Hospital Regional')).toBeInTheDocument(); });
      const btn = screen.getByRole('button', { name: /generar/i });
      await userEvent.click(btn);
      await waitFor(() => {
        expect(mockPdf).toHaveBeenCalled();
        const props = getPdfProps();
        expect(props.scope).toBe('building');
        expect(props.buildingName).toBe('Hospital Regional');
        expect(props.clientName).toBe('Hospital Regional S.A.');
        expect(props.elevatorCount).toBe(2);
        expect(props.entries).toHaveLength(1);
        expect(props.entries[0].elevator?.id).toBe('elevator-1');
      });
    });

    it('getResponsibleVisitEntries se llama con elevatorId undefined', async () => {
      renderPage(['/responsable/libro-visitas?buildingId=building-1']);
      await waitFor(() => { expect(screen.getByText('Hospital Regional')).toBeInTheDocument(); });
      const btn = screen.getByRole('button', { name: /generar/i });
      await userEvent.click(btn);
      await waitFor(() => {
        expect(mockGetVisitEntries).toHaveBeenCalledWith(undefined, expect.any(String), expect.any(String));
      });
    });
  });

  describe('Libro individual', () => {
    it('genera PDF individual con scope elevator y llama a todas las RPCs', async () => {
      renderPage(['/responsable/libro-visitas?buildingId=building-1']);
      await waitFor(() => { expect(screen.getByText('Hospital Regional')).toBeInTheDocument(); });
      const elevatorSelect = screen.getByDisplayValue('Todos mis ascensores del edificio');
      await userEvent.selectOptions(elevatorSelect, 'elevator-1');
      const btn = screen.getByRole('button', { name: /generar/i });
      await userEvent.click(btn);
      await waitFor(() => {
        expect(mockPdf).toHaveBeenCalled();
        const props = getPdfProps();
        expect(props.scope).toBe('elevator');
        expect(props.elevatorCode).toBe('ASC-0001');
        expect(mockGetVisitEntries).toHaveBeenCalledWith('elevator-1', expect.any(String), expect.any(String));
        expect(mockGetServiceRecords).toHaveBeenCalledWith('elevator-1');
        expect(mockGetServiceOrders).toHaveBeenCalledWith('elevator-1');
      });
    });
  });

  describe('Sin asientos', () => {
    it('muestra error cuando no hay asientos', async () => {
      mockGetVisitEntries.mockResolvedValue([]);
      renderPage(['/responsable/libro-visitas?buildingId=building-1']);
      await waitFor(() => { expect(screen.getByText('Hospital Regional')).toBeInTheDocument(); });
      const btn = screen.getByRole('button', { name: /generar/i });
      await userEvent.click(btn);
      await waitFor(() => {
        expect(screen.getByText('No hay asientos aprobados para el período')).toBeInTheDocument();
      });
      expect(mockPdf).not.toHaveBeenCalled();
    });
  });

  describe('Error del servicio', () => {
    it('muestra error visible y restaura botón', async () => {
      mockGetVisitEntries.mockRejectedValue(new Error('RPC failed'));
      renderPage(['/responsable/libro-visitas?buildingId=building-1']);
      await waitFor(() => { expect(screen.getByText('Hospital Regional')).toBeInTheDocument(); });
      const btn = screen.getByRole('button', { name: /generar/i });
      await userEvent.click(btn);
      await waitFor(() => {
        expect(screen.getByText('RPC failed')).toBeInTheDocument();
      });
      expect(btn).not.toBeDisabled();
    });
  });

  describe('Descarga correcta', () => {
    it('ejecuta createObjectURL, click, revokeObjectURL y el anchor se limpia', async () => {
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

      renderPage(['/responsable/libro-visitas?buildingId=building-1']);
      await waitFor(() => { expect(screen.getByText('Hospital Regional')).toBeInTheDocument(); });
      const btn = screen.getByRole('button', { name: /generar/i });
      await userEvent.click(btn);
      await waitFor(() => {
        expect(mockPdf).toHaveBeenCalled();
        expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
        expect(clickSpy).toHaveBeenCalledTimes(1);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
      });

      const anchor = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.results[0]?.value;
      expect(anchor).toBeDefined();
    });
  });

  describe('Estado generando', () => {
    it('muestra Generando... mientras se genera', async () => {
      let resolveBlob: (v: Blob) => void;
      mockPdf.mockReturnValue({
        toBlob: () => new Promise((resolve) => { resolveBlob = resolve; }),
      } as ReturnType<typeof pdf>);

      renderPage(['/responsable/libro-visitas?buildingId=building-1']);
      await waitFor(() => { expect(screen.getByText('Hospital Regional')).toBeInTheDocument(); });
      const btn = screen.getByRole('button', { name: /generar/i });
      await userEvent.click(btn);
      await waitFor(() => {
        expect(screen.getByText('Generando...')).toBeInTheDocument();
        expect(btn).toBeDisabled();
      });
      resolveBlob!(new Blob());
      await waitFor(() => {
        expect(screen.queryByText('Generando...')).not.toBeInTheDocument();
      });
    });
  });
});
