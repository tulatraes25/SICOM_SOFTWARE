import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getResponsibleMonthlyReportDownload } from './responsiblePortalService';

const mockInvoke = vi.fn();

vi.mock('@/config/supabase', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
  },
}));

const VALID_RESPONSE = {
  signed_url: 'https://fwdxwbwrmpctapjhoyuj.supabase.co/storage/v1/object/sign/test',
  expires_in: 60,
  filename: 'informe-mensual-asc-1-2026-07-v1.pdf',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockInvoke.mockResolvedValue({ data: VALID_RESPONSE, error: null });
});

describe('getResponsibleMonthlyReportDownload', () => {
  it('éxito: llama a la Edge Function con el body correcto y retorna respuesta válida', async () => {
    const result = await getResponsibleMonthlyReportDownload('report-uuid-1');
    expect(mockInvoke).toHaveBeenCalledWith('get-responsible-monthly-report-url', { body: { monthly_report_id: 'report-uuid-1' } });
    expect(result).toEqual(VALID_RESPONSE);
  });

  it('error de invoke lanza mensaje controlado', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'Internal' } });
    await expect(getResponsibleMonthlyReportDownload('report-uuid-1')).rejects.toThrow('No se pudo preparar la descarga del informe');
  });

  it('respuesta sin signed_url lanza error', async () => {
    mockInvoke.mockResolvedValue({ data: { expires_in: 60, filename: 'test.pdf' }, error: null });
    await expect(getResponsibleMonthlyReportDownload('report-uuid-1')).rejects.toThrow('Respuesta de descarga inválida');
  });

  it('URL insegura lanza error', async () => {
    mockInvoke.mockResolvedValue({ data: { signed_url: 'javascript:alert(1)', expires_in: 60, filename: 'test.pdf' }, error: null });
    await expect(getResponsibleMonthlyReportDownload('report-uuid-1')).rejects.toThrow('Respuesta de descarga inválida');
  });

  it('filename inseguro lanza error', async () => {
    mockInvoke.mockResolvedValue({ data: { signed_url: 'https://example.com/test', expires_in: 60, filename: '../../informe.pdf' }, error: null });
    await expect(getResponsibleMonthlyReportDownload('report-uuid-1')).rejects.toThrow('Respuesta de descarga inválida');
  });

  it('monthly_report_id vacío lanza error', async () => {
    await expect(getResponsibleMonthlyReportDownload('')).rejects.toThrow('Informe inválido');
    await expect(getResponsibleMonthlyReportDownload('   ')).rejects.toThrow('Informe inválido');
  });

  it('expires_in distinto de 60 lanza error', async () => {
    mockInvoke.mockResolvedValue({ data: { signed_url: 'https://example.com/test', expires_in: 120, filename: 'test.pdf' }, error: null });
    await expect(getResponsibleMonthlyReportDownload('report-uuid-1')).rejects.toThrow('Respuesta de descarga inválida');
  });
});
