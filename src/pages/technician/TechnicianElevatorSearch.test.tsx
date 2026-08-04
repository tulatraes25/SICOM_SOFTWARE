import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TechnicianElevatorSearch from './TechnicianElevatorSearch';

const { mockSearch, mockNavigate } = vi.hoisted(() => ({
  mockSearch: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock('@/services/serviceRecords.service', () => ({
  searchElevatorsForTechnician: (...args: unknown[]) => mockSearch(...args),
}));

vi.mock('@/config/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'tech-1' } } }) },
  },
}));

vi.mock('@/components/layout/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'tech-1' }, profile: { role: 'technician' }, isAuthenticated: true }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function makeElevator(overrides: Record<string, unknown> = {}) {
  return {
    id: 'e1',
    code: 'ASC-0001',
    operational_status: 'operativo',
    manufacturer: 'Otis',
    model: 'Gen2',
    building: {
      id: 'b1',
      name: 'Edificio Central',
      address: 'Av. Test 123',
      locality: 'CABA',
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockNavigate.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe('TechnicianElevatorSearch — Render', () => {
  it('renderiza el buscador', () => {
    render(<MemoryRouter><TechnicianElevatorSearch /></MemoryRouter>);
    expect(screen.getByPlaceholderText(/Buscar por código/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Buscar/i })).toBeInTheDocument();
  });
});

describe('TechnicianElevatorSearch — Búsqueda', () => {
  it('no consulta con texto vacío', async () => {
    render(<MemoryRouter><TechnicianElevatorSearch /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /Buscar/i }));
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('permite buscar ASC-0001', async () => {
    mockSearch.mockResolvedValue([]);
    render(<MemoryRouter><TechnicianElevatorSearch /></MemoryRouter>);
    const input = screen.getByPlaceholderText(/Buscar por código/);
    fireEvent.change(input, { target: { value: 'ASC-0001' } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar/i }));
    expect(input).toHaveValue('ASC-0001');
  });

  it('llama searchElevatorsForTechnician con ASC-0001', async () => {
    mockSearch.mockResolvedValue([]);
    render(<MemoryRouter><TechnicianElevatorSearch /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText(/Buscar por código/), { target: { value: 'ASC-0001' } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar/i }));
    await waitFor(() => {
      expect(mockSearch).toHaveBeenCalledWith('ASC-0001');
    });
  });

  it('muestra estado de carga', async () => {
    let resolveSearch: (value: unknown[]) => void;
    mockSearch.mockImplementation(() => new Promise((r) => { resolveSearch = r; }));
    render(<MemoryRouter><TechnicianElevatorSearch /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText(/Buscar por código/), { target: { value: 'ASC' } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar/i }));
    await waitFor(() => {
      expect(screen.getByText('Buscando...')).toBeInTheDocument();
    });
    resolveSearch!([]);
  });

  it('evita una segunda llamada mientras carga', async () => {
    let resolveSearch: (value: unknown[]) => void;
    mockSearch.mockImplementation(() => new Promise((r) => { resolveSearch = r; }));
    render(<MemoryRouter><TechnicianElevatorSearch /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText(/Buscar por código/), { target: { value: 'ASC' } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar/i }));
    await waitFor(() => {
      expect(screen.getByText('Buscando...')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Buscar/i }));
    resolveSearch!([]);
    await waitFor(() => {
      expect(mockSearch).toHaveBeenCalledTimes(1);
    });
  });
});

describe('TechnicianElevatorSearch — Resultados', () => {
  it('muestra código del ascensor', async () => {
    mockSearch.mockResolvedValue([makeElevator()]);
    render(<MemoryRouter><TechnicianElevatorSearch /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText(/Buscar por código/), { target: { value: 'ASC' } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar/i }));
    await waitFor(() => {
      expect(screen.getByText('ASC-0001')).toBeInTheDocument();
    });
  });

  it('muestra edificio', async () => {
    mockSearch.mockResolvedValue([makeElevator()]);
    render(<MemoryRouter><TechnicianElevatorSearch /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText(/Buscar por código/), { target: { value: 'ASC' } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar/i }));
    await waitFor(() => {
      expect(screen.getByText('Edificio Central')).toBeInTheDocument();
    });
  });

  it('muestra localidad cuando existe', async () => {
    mockSearch.mockResolvedValue([makeElevator()]);
    render(<MemoryRouter><TechnicianElevatorSearch /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText(/Buscar por código/), { target: { value: 'ASC' } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar/i }));
    await waitFor(() => {
      expect(screen.getByText('CABA')).toBeInTheDocument();
    });
  });

  it('muestra fabricante/modelo cuando existen', async () => {
    mockSearch.mockResolvedValue([makeElevator()]);
    render(<MemoryRouter><TechnicianElevatorSearch /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText(/Buscar por código/), { target: { value: 'ASC' } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar/i }));
    await waitFor(() => {
      expect(screen.getByText('ASC-0001')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Otis/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Gen2/)).not.toBeInTheDocument();
  });

  it('muestra estados traducidos', async () => {
    mockSearch.mockResolvedValue([makeElevator({ operational_status: 'no_operativo' })]);
    render(<MemoryRouter><TechnicianElevatorSearch /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText(/Buscar por código/), { target: { value: 'ASC' } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar/i }));
    await waitFor(() => {
      expect(screen.getByText('No Operativo')).toBeInTheDocument();
    });
  });

  it('resultado vacío muestra el mensaje real', async () => {
    mockSearch.mockResolvedValue([]);
    render(<MemoryRouter><TechnicianElevatorSearch /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText(/Buscar por código/), { target: { value: 'ZZZ' } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar/i }));
    await waitFor(() => {
      expect(screen.getByText('No se encontraron ascensores')).toBeInTheDocument();
    });
  });

  it('una búsqueda posterior reemplaza resultados anteriores', async () => {
    mockSearch
      .mockResolvedValueOnce([makeElevator({ code: 'ASC-0001' })])
      .mockResolvedValueOnce([makeElevator({ code: 'ASC-0002' })]);
    render(<MemoryRouter><TechnicianElevatorSearch /></MemoryRouter>);
    const input = screen.getByPlaceholderText(/Buscar por código/);
    fireEvent.change(input, { target: { value: 'ASC-0001' } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar/i }));
    await waitFor(() => {
      expect(screen.getByText('ASC-0001')).toBeInTheDocument();
    });
    fireEvent.change(input, { target: { value: 'ASC-0002' } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar/i }));
    await waitFor(() => {
      expect(screen.getByText('ASC-0002')).toBeInTheDocument();
    });
    expect(screen.queryByText('ASC-0001')).not.toBeInTheDocument();
  });

  it('no muestra datos que el servicio no devolvió', async () => {
    mockSearch.mockResolvedValue([makeElevator({ building: null })]);
    render(<MemoryRouter><TechnicianElevatorSearch /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText(/Buscar por código/), { target: { value: 'ASC' } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar/i }));
    await waitFor(() => {
      expect(screen.getByText('ASC-0001')).toBeInTheDocument();
    });
    expect(screen.queryByText('Edificio Central')).not.toBeInTheDocument();
    expect(screen.queryByText('CABA')).not.toBeInTheDocument();
  });
});

describe('TechnicianElevatorSearch — Navegación', () => {
  it('"Cargar Mantenimiento" navega a la ruta real', async () => {
    mockSearch.mockResolvedValue([makeElevator()]);
    render(<MemoryRouter><TechnicianElevatorSearch /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText(/Buscar por código/), { target: { value: 'ASC' } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar/i }));
    await waitFor(() => {
      expect(screen.getByText('Cargar Mantenimiento')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Cargar Mantenimiento'));
    expect(mockNavigate).toHaveBeenCalledWith('/tecnico/ascensores/e1/mantenimiento/nuevo');
  });
});

describe('TechnicianElevatorSearch — Error', () => {
  it('error del servicio muestra mensaje visible', async () => {
    mockSearch.mockRejectedValue(new Error('Error de red'));
    render(<MemoryRouter><TechnicianElevatorSearch /></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText(/Buscar por código/), { target: { value: 'ASC' } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar/i }));
    await waitFor(() => {
      expect(screen.getByText('Error de red')).toBeInTheDocument();
    });
  });
});
