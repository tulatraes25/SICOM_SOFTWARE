import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ElevatorQRCode from './ElevatorQRCode';

const { mockDownloadQrStickerPng, mockGetElevatorPublicUrl } = vi.hoisted(() => ({
  mockDownloadQrStickerPng: vi.fn(),
  mockGetElevatorPublicUrl: vi.fn((token: string) => `https://sistema.sicompatagonia.com/s/ascensor/${token}`),
}));

vi.mock('@/utils/qrSticker', () => ({
  downloadQrStickerPng: (...args: unknown[]) => mockDownloadQrStickerPng(...args),
}));

vi.mock('@/config/supabase', () => ({
  getElevatorPublicUrl: (...args: unknown[]) => mockGetElevatorPublicUrl(...args),
}));

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value, size }: { value: string; size: number }) => (
    <svg
      data-testid="qr-svg"
      data-public-url={value}
      data-size={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M0 0h10v10H0z" />
    </svg>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockDownloadQrStickerPng.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ElevatorQRCode — Descarga PNG', () => {
  it('reutiliza el enlace público existente y nunca genera un token distinto', () => {
    render(<ElevatorQRCode qrToken="token-existente" elevatorCode="ASC-22/01" />);
    expect(mockGetElevatorPublicUrl).toHaveBeenCalledWith('token-existente');
    expect(screen.getByTestId('qr-svg')).toHaveAttribute(
      'data-public-url',
      'https://sistema.sicompatagonia.com/s/ascensor/token-existente',
    );
    expect(screen.getByText('ASC-22/01')).toBeInTheDocument();
  });

  it('ofrece botón claro para descargar el PNG del QR', async () => {
    render(<ElevatorQRCode qrToken="token-existente" elevatorCode="ASC-22/01" />);
    const button = screen.getByRole('button', { name: 'Descargar QR (PNG)' });
    expect(button).toHaveAttribute('type', 'button');
    fireEvent.click(button);
    await waitFor(() => {
      expect(mockDownloadQrStickerPng).toHaveBeenCalledTimes(1);
    });
    expect(mockDownloadQrStickerPng).toHaveBeenCalledWith(
      screen.getByTestId('qr-svg'),
      'ASC-22/01',
    );
  });

  it('evita clics duplicados mientras el PNG se genera', async () => {
    let finish!: () => void;
    mockDownloadQrStickerPng.mockReturnValue(
      new Promise<void>((resolve) => { finish = resolve; }),
    );
    render(<ElevatorQRCode qrToken="t" elevatorCode="ASC-001" />);
    const button = screen.getByRole('button', { name: 'Descargar QR (PNG)' });
    fireEvent.click(button);
    expect(screen.getByRole('button', { name: 'Generando PNG...' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Generando PNG...' }));
    expect(mockDownloadQrStickerPng).toHaveBeenCalledTimes(1);
    finish();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Descargar QR (PNG)' })).not.toBeDisabled();
    });
  });

  it('muestra error accionable al fallar la exportación', async () => {
    mockDownloadQrStickerPng.mockRejectedValueOnce(new Error('Canvas disabled'));
    render(<ElevatorQRCode qrToken="t" elevatorCode="ASC-001" />);
    fireEvent.click(screen.getByRole('button', { name: 'Descargar QR (PNG)' }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/No se pudo generar el PNG/);
    });
    expect(screen.getByRole('button', { name: 'Descargar QR (PNG)' })).not.toBeDisabled();
  });

  it('respeta los permisos de presentación del componente', () => {
    render(<ElevatorQRCode qrToken="t" elevatorCode="ASC-001" allowDownload={false} allowPrint={false} showUrl={false} />);
    expect(screen.queryByRole('button', { name: 'Descargar QR (PNG)' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Imprimir' })).not.toBeInTheDocument();
    expect(screen.queryByText('https://sistema.sicompatagonia.com/s/ascensor/t')).not.toBeInTheDocument();
  });
});
