import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PublicElevatorView from '@/pages/public/PublicElevatorView';

const { mockGetPublicElevatorByToken, mockLogQRScan, mockGetPublicServiceHistory } = vi.hoisted(() => ({
  mockGetPublicElevatorByToken: vi.fn(),
  mockLogQRScan: vi.fn(),
  mockGetPublicServiceHistory: vi.fn(),
}));

vi.mock('@/services/publicElevator.service', () => ({
  getPublicElevatorByToken: (...args: unknown[]) => mockGetPublicElevatorByToken(...args),
  logQRScan: (...args: unknown[]) => mockLogQRScan(...args),
  getPublicServiceHistory: (...args: unknown[]) => mockGetPublicServiceHistory(...args),
}));

const VALID_ELEVATOR = {
  id: 'code-1',
  code: 'ASC-001',
  manufacturer: 'Otis',
  model: 'Gen2',
  operational_status: 'operativo',
  conservation_status: 'conforme',
  last_service_date: '2026-07-15',
  building_name: 'Edificio Central',
  building_address: 'Av. San Martín 100',
  building_locality: 'Comodoro Rivadavia',
  building_province: 'Chubut',
  company_name: 'SICOM',
};

function renderView(token = 'test-token') {
  return render(
    <MemoryRouter initialEntries={[`/s/ascensor/${token}`]}>
      <Routes>
        <Route path="/s/ascensor/:token" element={<PublicElevatorView />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PublicElevatorView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPublicElevatorByToken.mockResolvedValue(VALID_ELEVATOR);
    mockLogQRScan.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('muestra "Último mantenimiento"', async () => {
    renderView();
    const introBtn = await screen.findByRole('button', { name: /ver estado del ascensor/i });
    await userEvent.click(introBtn);
    expect(screen.getByText('Último mantenimiento')).toBeDefined();
  });

  it('muestra la fecha correcta cuando last_service_date existe', async () => {
    renderView();
    const introBtn = await screen.findByRole('button', { name: /ver estado del ascensor/i });
    await userEvent.click(introBtn);
    expect(screen.getByText(/14 de julio de 2026/)).toBeDefined();
  });

  it('muestra mensaje sin mantenimiento cuando last_service_date es null', async () => {
    mockGetPublicElevatorByToken.mockResolvedValue({
      ...VALID_ELEVATOR,
      last_service_date: null,
    });
    renderView();
    const introBtn = await screen.findByRole('button', { name: /ver estado del ascensor/i });
    await userEvent.click(introBtn);
    expect(screen.getByText('Sin mantenimientos aprobados registrados para este equipo.')).toBeDefined();
  });

  it('no muestra "Historial Reciente"', async () => {
    renderView();
    const introBtn = await screen.findByRole('button', { name: /ver estado del ascensor/i });
    await userEvent.click(introBtn);
    expect(screen.queryByText('Historial Reciente')).toBeNull();
  });

  it('no llama getPublicServiceHistory', async () => {
    renderView();
    await screen.findByRole('button', { name: /ver estado del ascensor/i });
    expect(mockGetPublicServiceHistory).not.toHaveBeenCalled();
  });

  it('llama getPublicElevatorByToken una sola vez', async () => {
    renderView();
    await screen.findByRole('button', { name: /ver estado del ascensor/i });
    expect(mockGetPublicElevatorByToken).toHaveBeenCalledTimes(1);
    expect(mockGetPublicElevatorByToken).toHaveBeenCalledWith('test-token');
  });

  it('registra el escaneo QR', async () => {
    renderView();
    await screen.findByRole('button', { name: /ver estado del ascensor/i });
    expect(mockLogQRScan).toHaveBeenCalledTimes(1);
    expect(mockLogQRScan).toHaveBeenCalledWith('test-token');
  });

  it('token inválido muestra mensaje correcto', async () => {
    mockGetPublicElevatorByToken.mockResolvedValue(null);
    renderView();
    expect(await screen.findByText('Ascensor no encontrado')).toBeDefined();
    expect(screen.getByText('No se encontró un ascensor asociado a este código QR.')).toBeDefined();
  });

  it('token inválido no muestra datos de ascensor', async () => {
    mockGetPublicElevatorByToken.mockResolvedValue(null);
    renderView();
    await screen.findByText('Ascensor no encontrado');
    expect(screen.queryByText('ASC-001')).toBeNull();
    expect(screen.queryByText('Otis')).toBeNull();
  });

  it('mantiene publicidad inicial (muestra "Ver estado del ascensor")', async () => {
    renderView();
    expect(await screen.findByRole('button', { name: /ver estado del ascensor/i })).toBeDefined();
    expect(screen.queryByText('Estado del ascensor')).toBeNull();
  });

  it('botón permite ver el estado', async () => {
    renderView();
    const introBtn = await screen.findByRole('button', { name: /ver estado del ascensor/i });
    await userEvent.click(introBtn);
    expect(await screen.findByText('Estado del ascensor')).toBeDefined();
    expect(screen.getByText('ASC-001')).toBeDefined();
  });

  it('no muestra UUID internos', async () => {
    renderView();
    const introBtn = await screen.findByRole('button', { name: /ver estado del ascensor/i });
    await userEvent.click(introBtn);
    const bodyText = document.body.textContent || '';
    expect(bodyText).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });
});
