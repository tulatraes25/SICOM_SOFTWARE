import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const message = [
    '❌ Variables de entorno de Supabase no configuradas.',
    '',
    'Crea el archivo .env.local en la raíz del proyecto con:',
    'VITE_SUPABASE_URL=tu-url-de-supabase',
    'VITE_SUPABASE_ANON_KEY=tu-anon-key',
    '',
    'Consulta .env.example para más detalles.',
  ].join('\n');

  if (import.meta.env.DEV) {
    console.error(message);
  } else {
    throw new Error('Supabase configuration missing');
  }
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || ''
);

export const appConfig = {
  url: import.meta.env.VITE_APP_URL || window.location.origin,
  publicUrl: import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin,
};

/**
 * Construye la URL pública completa para un ascensor
 * Formato: {base}/s/ascensor/{token}
 */
export function getElevatorPublicUrl(qrToken: string): string {
  const baseUrl = (import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, '');
  return `${baseUrl}/s/ascensor/${qrToken}`;
}
