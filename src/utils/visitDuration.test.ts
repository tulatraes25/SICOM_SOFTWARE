import { describe, it, expect } from 'vitest';
import { calculateVisitDurationSeconds, formatVisitDuration } from './visitDuration';

describe('calculateVisitDurationSeconds', () => {
  it('10:42 a 15:03 devuelve 15660', () => {
    expect(calculateVisitDurationSeconds({
      check_in_at: '2026-07-27T10:42:00-03:00',
      check_out_at: '2026-07-27T15:03:00-03:00',
    })).toBe(15660);
  });

  it('timestamps prevalecen sobre duration_seconds=180', () => {
    expect(calculateVisitDurationSeconds({
      check_in_at: '2026-07-27T10:42:00-03:00',
      check_out_at: '2026-07-27T15:03:00-03:00',
      duration_seconds: 180,
    })).toBe(15660);
  });

  it('timestamps prevalecen sobre duration_minutes=3', () => {
    expect(calculateVisitDurationSeconds({
      check_in_at: '2026-07-27T10:42:00-03:00',
      check_out_at: '2026-07-27T15:03:00-03:00',
      duration_minutes: 3,
    })).toBe(15660);
  });

  it('sin timestamps usa duration_seconds', () => {
    expect(calculateVisitDurationSeconds({ duration_seconds: 40 })).toBe(40);
  });

  it('sin timestamps ni seconds usa duration_minutes', () => {
    expect(calculateVisitDurationSeconds({ duration_minutes: 45 })).toBe(2700);
  });

  it('timestamps inválidos usan duration_seconds', () => {
    expect(calculateVisitDurationSeconds({
      check_in_at: 'bad',
      check_out_at: 'also-bad',
      duration_seconds: 300,
    })).toBe(300);
  });

  it('salida anterior al ingreso no produce negativo', () => {
    expect(calculateVisitDurationSeconds({
      check_in_at: '2026-07-27T15:00:00-03:00',
      check_out_at: '2026-07-27T10:00:00-03:00',
    })).toBeNull();
  });

  it('cruce de medianoche', () => {
    expect(calculateVisitDurationSeconds({
      check_in_at: '2026-07-27T23:00:00-03:00',
      check_out_at: '2026-07-28T01:30:00-03:00',
    })).toBe(9000);
  });

  it('timestamps con diferentes offsets', () => {
    expect(calculateVisitDurationSeconds({
      check_in_at: '2026-07-27T10:00:00+00:00',
      check_out_at: '2026-07-27T14:00:00-03:00',
    })).toBe(25200);
  });

  it('todos los valores ausentes devuelven null', () => {
    expect(calculateVisitDurationSeconds({})).toBeNull();
  });

  it('duración cero devuelve null', () => {
    expect(calculateVisitDurationSeconds({
      check_in_at: '2026-07-27T10:00:00-03:00',
      check_out_at: '2026-07-27T10:00:00-03:00',
    })).toBeNull();
  });

  it('valores NaN son rechazados', () => {
    expect(calculateVisitDurationSeconds({ duration_seconds: NaN })).toBeNull();
  });

  it('valores infinitos son rechazados', () => {
    expect(calculateVisitDurationSeconds({ duration_seconds: Infinity })).toBeNull();
  });

  it('duration_seconds negativo es rechazado', () => {
    expect(calculateVisitDurationSeconds({ duration_seconds: -10 })).toBeNull();
  });
});

describe('formatVisitDuration', () => {
  it('10:42 a 15:03 devuelve 4h 21m', () => {
    expect(formatVisitDuration({
      check_in_at: '2026-07-27T10:42:00-03:00',
      check_out_at: '2026-07-27T15:03:00-03:00',
    })).toBe('4h 21m');
  });

  it('timestamps prevalecen sobre duration_seconds=180', () => {
    expect(formatVisitDuration({
      check_in_at: '2026-07-27T10:42:00-03:00',
      check_out_at: '2026-07-27T15:03:00-03:00',
      duration_seconds: 180,
    })).toBe('4h 21m');
  });

  it('timestamps prevalecen sobre duration_minutes=3', () => {
    expect(formatVisitDuration({
      check_in_at: '2026-07-27T10:42:00-03:00',
      check_out_at: '2026-07-27T15:03:00-03:00',
      duration_minutes: 3,
    })).toBe('4h 21m');
  });

  it('30 segundos devuelve <1 min', () => {
    expect(formatVisitDuration({ duration_seconds: 30 })).toBe('<1 min');
  });

  it('60 segundos devuelve 1 min', () => {
    expect(formatVisitDuration({ duration_seconds: 60 })).toBe('1 min');
  });

  it('119 segundos devuelve 1 min', () => {
    expect(formatVisitDuration({ duration_seconds: 119 })).toBe('1 min');
  });

  it('120 segundos devuelve 2 min', () => {
    expect(formatVisitDuration({ duration_seconds: 120 })).toBe('2 min');
  });

  it('59 minutos devuelve 59 min', () => {
    expect(formatVisitDuration({ duration_seconds: 3540 })).toBe('59 min');
  });

  it('60 minutos devuelve 1h', () => {
    expect(formatVisitDuration({ duration_seconds: 3600 })).toBe('1h');
  });

  it('61 minutos devuelve 1h 1m', () => {
    expect(formatVisitDuration({ duration_seconds: 3660 })).toBe('1h 1m');
  });

  it('cruce de medianoche', () => {
    expect(formatVisitDuration({
      check_in_at: '2026-07-27T23:00:00-03:00',
      check_out_at: '2026-07-28T01:30:00-03:00',
    })).toBe('2h 30m');
  });

  it('salida anterior al ingreso muestra -', () => {
    expect(formatVisitDuration({
      check_in_at: '2026-07-27T15:00:00-03:00',
      check_out_at: '2026-07-27T10:00:00-03:00',
    })).toBe('-');
  });

  it('timestamps inválidos usan duration_seconds', () => {
    expect(formatVisitDuration({
      check_in_at: 'bad',
      check_out_at: 'also-bad',
      duration_seconds: 300,
    })).toBe('5 min');
  });

  it('sin timestamps usa duration_minutes', () => {
    expect(formatVisitDuration({ duration_minutes: 45 })).toBe('45 min');
  });

  it('todos los valores ausentes devuelven -', () => {
    expect(formatVisitDuration({})).toBe('-');
  });

  it('duración cero devuelve -', () => {
    expect(formatVisitDuration({ duration_seconds: 0 })).toBe('-');
  });

  it('NaN es rechazado', () => {
    expect(formatVisitDuration({ duration_seconds: NaN })).toBe('-');
  });

  it('Infinity es rechazado', () => {
    expect(formatVisitDuration({ duration_seconds: Infinity })).toBe('-');
  });
});
