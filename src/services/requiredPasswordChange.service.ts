import { supabase } from '@/config/supabase';
import { FunctionsHttpError } from '@supabase/supabase-js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getFallbackMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (isRecord(error) && typeof error.message === 'string') return error.message;
  return 'No se pudo actualizar la contraseña.';
}

async function getInvokeErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body: unknown = await error.context.json();
      if (isRecord(body) && typeof body.error === 'string' && body.error) {
        return body.error;
      }
    } catch {
      // body is not JSON or json() failed
    }
  }
  return getFallbackMessage(error);
}

export async function completeRequiredPasswordChange(newPassword: string): Promise<void> {
  if (typeof newPassword !== 'string' || newPassword.trim().length === 0) {
    throw new Error('La contraseña debe tener entre 8 y 128 caracteres');
  }
  if (newPassword.length < 8 || newPassword.length > 128) {
    throw new Error('La contraseña debe tener entre 8 y 128 caracteres');
  }

  const { data, error } = await supabase.functions.invoke('complete-required-password-change', {
    body: { new_password: newPassword },
  });

  if (error) {
    throw new Error(await getInvokeErrorMessage(error));
  }

  if (!isRecord(data) || data.success !== true) {
    throw new Error('No se pudo actualizar la contraseña.');
  }
}
