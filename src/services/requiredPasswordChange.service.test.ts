import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { completeRequiredPasswordChange } from './requiredPasswordChange.service';

const { mockInvoke } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
}));

vi.mock('@/config/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));

beforeEach(() => { vi.clearAllMocks(); });

describe('completeRequiredPasswordChange', () => {
  it('envía únicamente new_password', async () => {
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
    await completeRequiredPasswordChange('newpass123');
    expect(mockInvoke).toHaveBeenCalledWith('complete-required-password-change', {
      body: { new_password: 'newpass123' },
    });
  });

  it('no envía user_id', async () => {
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
    await completeRequiredPasswordChange('newpass123');
    const body = mockInvoke.mock.calls[0][1].body;
    expect(body).not.toHaveProperty('user_id');
  });

  it('rechaza menos de 8 caracteres', async () => {
    await expect(completeRequiredPasswordChange('short')).rejects.toThrow('8 y 128');
  });

  it('rechaza más de 128 caracteres', async () => {
    await expect(completeRequiredPasswordChange('a'.repeat(129))).rejects.toThrow('8 y 128');
  });

  it('rechaza solo espacios', async () => {
    await expect(completeRequiredPasswordChange('       ')).rejects.toThrow('8 y 128');
  });

  it('acepta 8 caracteres', async () => {
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
    await completeRequiredPasswordChange('12345678');
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('valida success:true', async () => {
    mockInvoke.mockResolvedValue({ data: { success: false }, error: null });
    await expect(completeRequiredPasswordChange('newpass123')).rejects.toThrow('No se pudo actualizar la contraseña.');
  });

  it('rechaza respuesta 2xx inválida', async () => {
    mockInvoke.mockResolvedValue({ data: { other: 'field' }, error: null });
    await expect(completeRequiredPasswordChange('newpass123')).rejects.toThrow('No se pudo actualizar la contraseña.');
  });

  it('preserva mensaje de FunctionsHttpError', async () => {
    const MSG = 'El cambio de contraseña no está pendiente';
    const response = new Response(JSON.stringify({ error: MSG }), { status: 409 });
    const err = new FunctionsHttpError(response);
    mockInvoke.mockResolvedValue({ data: null, error: err });
    await expect(completeRequiredPasswordChange('newpass123')).rejects.toThrow(MSG);
  });

  it('body no JSON usa fallback', async () => {
    const response = new Response('not json', { status: 500 });
    const err = new FunctionsHttpError(response);
    mockInvoke.mockResolvedValue({ data: null, error: err });
    await expect(completeRequiredPasswordChange('newpass123')).rejects.toThrow('Edge Function returned a non-2xx status code');
  });

  it('body sin error usa fallback', async () => {
    const response = new Response(JSON.stringify({ details: 'something' }), { status: 500 });
    const err = new FunctionsHttpError(response);
    mockInvoke.mockResolvedValue({ data: null, error: err });
    await expect(completeRequiredPasswordChange('newpass123')).rejects.toThrow('Edge Function returned a non-2xx status code');
  });

  it('no expone details ni hint', async () => {
    const MSG = 'test';
    const response = new Response(JSON.stringify({ error: MSG, details: 'internal', hint: 'none' }), { status: 409 });
    const err = new FunctionsHttpError(response);
    mockInvoke.mockResolvedValue({ data: null, error: err });
    try {
      await completeRequiredPasswordChange('newpass123');
      expect.fail('should have thrown');
    } catch (e: unknown) {
      const msg = (e as Error).message;
      expect(msg).toBe(MSG);
      expect(msg).not.toContain('details');
      expect(msg).not.toContain('hint');
    }
  });

  it('context.json se lee una sola vez', async () => {
    const MSG = 'test';
    const jsonFn = vi.fn().mockResolvedValue({ error: MSG });
    const response = new Response(null);
    Object.defineProperty(response, 'json', { value: jsonFn });
    const err = new FunctionsHttpError(response);
    mockInvoke.mockResolvedValue({ data: null, error: err });
    await expect(completeRequiredPasswordChange('newpass123')).rejects.toThrow(MSG);
    expect(jsonFn).toHaveBeenCalledTimes(1);
  });
});
