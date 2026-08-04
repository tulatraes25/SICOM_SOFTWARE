/**
 * Date utilities for SICOM — Argentina timezone safe.
 *
 * All functions avoid `new Date(string)` for DATE-only values
 * to prevent UTC offset shifting.
 */

/**
 * Get local date input value (YYYY-MM-DD) from a Date object.
 * Uses local getters (getFullYear, getMonth, getDate) — never toISOString().
 */
export function getLocalDateInputValue(date?: Date): string {
  const d = date || new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Format a DATE column string (YYYY-MM-DD) to es-AR short format.
 * Does NOT use `new Date()` — parses components directly.
 */
export function formatDateOnlyEsAR(value: string): string {
  if (!value) return 'N/D';
  const parts = value.split('-');
  if (parts.length !== 3) return value;
  const [y, m, d] = parts;
  if (!y || !m || !d) return value;
  return `${parseInt(d, 10)}/${parseInt(m, 10)}/${y}`;
}

/**
 * Format a DATE column string (YYYY-MM-DD) to es-AR long format.
 * Does NOT use `new Date()`.
 */
export function formatDateOnlyLongEsAR(value: string): string {
  if (!value) return 'N/D';
  const parts = value.split('-');
  if (parts.length !== 3) return value;
  const [y, m, d] = parts;
  if (!y || !m || !d) return value;
  const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const monthIdx = parseInt(m, 10) - 1;
  if (monthIdx < 0 || monthIdx > 11) return value;
  return `${String(d).padStart(2, '0')} de ${monthNames[monthIdx]} de ${y}`;
}

/**
 * Format a timestamp string to es-AR date using Argentina timezone.
 * For timestamps like '2026-08-04T00:30:00Z', shows '3/8/2026'.
 */
export function formatTimestampDateEsAR(value: string): string {
  if (!value) return 'N/D';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
  } catch {
    return value;
  }
}
