import { describe, it, expect } from 'vitest';
import { getLocalDateInputValue, formatDateOnlyEsAR, formatDateOnlyLongEsAR, formatTimestampDateEsAR } from './dateUtils';

describe('dateUtils', () => {
  describe('getLocalDateInputValue', () => {
    it('devuelve YYYY-MM-DD desde un Date', () => {
      const d = new Date(2026, 6, 3, 21, 30); // 2026-07-03 21:30 local
      expect(getLocalDateInputValue(d)).toBe('2026-07-03');
    });

    it('usa la fecha actual si no se pasa argumento', () => {
      const result = getLocalDateInputValue();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('fecha local nocturna no pasa al día UTC siguiente', () => {
      // Simula 2026-08-03 21:30 en Argentina (UTC-3 = 2026-08-04 00:30 UTC)
      const d = new Date(2026, 7, 3, 21, 30); // month is 0-indexed
      expect(getLocalDateInputValue(d)).toBe('2026-08-03');
    });
  });

  describe('formatDateOnlyEsAR', () => {
    it('DATE 2026-08-03 se muestra 3/8/2026', () => {
      expect(formatDateOnlyEsAR('2026-08-03')).toBe('3/8/2026');
    });

    it('DATE 2026-01-15 se muestra 15/1/2026', () => {
      expect(formatDateOnlyEsAR('2026-01-15')).toBe('15/1/2026');
    });

    it('valor vacío devuelve N/D', () => {
      expect(formatDateOnlyEsAR('')).toBe('N/D');
    });

    it('valor inválido se devuelve tal cual', () => {
      expect(formatDateOnlyEsAR('bad-date')).toBe('bad-date');
    });
  });

  describe('formatDateOnlyLongEsAR', () => {
    it('2026-08-03 muestra 03 de agosto de 2026', () => {
      expect(formatDateOnlyLongEsAR('2026-08-03')).toBe('03 de agosto de 2026');
    });

    it('2026-01-01 muestra 01 de enero de 2026', () => {
      expect(formatDateOnlyLongEsAR('2026-01-01')).toBe('01 de enero de 2026');
    });

    it('valor vacío devuelve N/D', () => {
      expect(formatDateOnlyLongEsAR('')).toBe('N/D');
    });
  });

  describe('formatTimestampDateEsAR', () => {
    it('timestamp 2026-08-04T00:30:00Z se muestra 3/8/2026', () => {
      expect(formatTimestampDateEsAR('2026-08-04T00:30:00Z')).toBe('3/8/2026');
    });

    it('valor vacío devuelve N/D', () => {
      expect(formatTimestampDateEsAR('')).toBe('N/D');
    });

    it('valor inválido se devuelve tal cual', () => {
      expect(formatTimestampDateEsAR('not-a-date')).toBe('not-a-date');
    });
  });
});
