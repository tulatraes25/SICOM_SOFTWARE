import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatea una fecha DATE (YYYY-MM-DD) sin problemas de zona horaria.
 * Usa parseo manual para evitar que new Date("2026-07-09") se convierta a 08/07 por UTC.
 */
export function formatDate(dateStr: string | Date): string {
  if (!dateStr) return 'N/D';
  
  if (dateStr instanceof Date) {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(dateStr);
  }

  // Para strings DATE (YYYY-MM-DD), parsear manualmente
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  }

  // Fallback para timestamps
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateStr));
}

/**
 * Formatea un timestamp con zona horaria Argentina
 */
export function formatDateTime(dateStr: string | Date): string {
  if (!dateStr) return 'N/D';
  
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(date);
}

export function formatPeriod(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function formatPeriodDisplay(period: string): string {
  const [year, month] = period.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return new Intl.DateTimeFormat('es-AR', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function generateQRToken(length: number = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
