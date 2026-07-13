import { describe, it, expect } from 'vitest';
import { formatDate, formatDateTime, formatPeriod, formatPeriodDisplay } from '@/lib/utils';

describe('formatDate', () => {
  it('formatea DATE correctamente: 2026-07-09 → 09/07/2026', () => {
    expect(formatDate('2026-07-09')).toBe('09/07/2026');
  });

  it('formatea 2026-01-01 → 01/01/2026', () => {
    expect(formatDate('2026-01-01')).toBe('01/01/2026');
  });

  it('formatea 2026-12-31 → 31/12/2026', () => {
    expect(formatDate('2026-12-31')).toBe('31/12/2026');
  });

  it('maneja null', () => {
    expect(formatDate(null as any)).toBe('N/D');
  });

  it('maneja string vacío', () => {
    expect(formatDate('')).toBe('N/D');
  });

  it('maneja Date object', () => {
    const date = new Date(2026, 6, 9); // 9 de julio
    expect(formatDate(date)).toContain('09');
  });
});

describe('formatDateTime', () => {
  it('formatea timestamp correctamente', () => {
    const result = formatDateTime('2026-07-09T14:30:00Z');
    expect(result).toContain('09');
    expect(result).toContain('07');
    expect(result).toContain('2026');
  });

  it('maneja null', () => {
    expect(formatDateTime(null as any)).toBe('N/D');
  });
});

describe('formatPeriod', () => {
  it('formatea período correctamente', () => {
    const date = new Date(2026, 6, 1); // Julio 2026
    expect(formatPeriod(date)).toBe('2026-07');
  });

  it('maneja enero', () => {
    const date = new Date(2026, 0, 1);
    expect(formatPeriod(date)).toBe('2026-01');
  });

  it('maneja diciembre', () => {
    const date = new Date(2026, 11, 31);
    expect(formatPeriod(date)).toBe('2026-12');
  });
});

describe('formatPeriodDisplay', () => {
  it('muestra período legible', () => {
    const result = formatPeriodDisplay('2026-07');
    expect(result).toContain('julio');
    expect(result).toContain('2026');
  });
});
