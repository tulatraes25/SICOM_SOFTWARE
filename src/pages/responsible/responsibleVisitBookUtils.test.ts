import { describe, it, expect } from 'vitest';
import { sortResponsibleVisitEntries, buildResponsibleVisitBookEntries } from './responsibleVisitBookUtils';
import type { ResponsibleVisitEntry, ResponsibleElevator, ResponsibleTechnician, ResponsibleServiceRecord, ResponsibleServiceOrder } from '@/services/responsiblePortalService';

// ============================================================
// Test data factories
// ============================================================

function makeVisit(overrides: Partial<ResponsibleVisitEntry> = {}): ResponsibleVisitEntry {
  return {
    id: 'v-1', elevator_id: 'e-1', service_case_id: null, service_record_id: null,
    service_order_id: null, entry_number: 1, visit_date: '2026-07-15', entry_type: 'other',
    origin_type: 'maintenance', title: 'Test', description: 'Test desc',
    work_performed: null, observations: null, recommendations: null,
    operational_status: null, conservation_status: null, technician_id: null,
    status: 'approved', check_in_at: null, check_out_at: null,
    duration_minutes: null, duration_seconds: null, case_number: null, numbering_mode: null,
    ...overrides,
  };
}

function makeElevator(overrides: Partial<ResponsibleElevator> = {}): ResponsibleElevator {
  return {
    id: 'e-1', code: 'ASC-0001', building_id: 'b-1', manufacturer: null, model: null,
    elevator_type: null, capacity_kg: null, floors_served: null, year_installed: null,
    operational_status: null, conservation_status: null, contractual_status: null,
    last_service_date: null, next_service_date: null, active: true, ...overrides,
  };
}

// ============================================================
// sortResponsibleVisitEntries — elevator scope
// ============================================================

describe('sortResponsibleVisitEntries — elevator scope', () => {
  const elevMap = new Map([['e-1', makeElevator()]]);

  it('orders by visit_date ascending', () => {
    const entries = [
      makeVisit({ id: 'v-1', visit_date: '2026-07-20', entry_number: 1 }),
      makeVisit({ id: 'v-2', visit_date: '2026-07-10', entry_number: 2 }),
      makeVisit({ id: 'v-3', visit_date: '2026-07-15', entry_number: 3 }),
    ];
    const sorted = sortResponsibleVisitEntries(entries, elevMap, 'elevator');
    expect(sorted.map((e) => e.visit_date)).toEqual(['2026-07-10', '2026-07-15', '2026-07-20']);
  });

  it('orders by entry_number ascending on same date', () => {
    const entries = [
      makeVisit({ id: 'v-1', visit_date: '2026-07-15', entry_number: 3 }),
      makeVisit({ id: 'v-2', visit_date: '2026-07-15', entry_number: 1 }),
      makeVisit({ id: 'v-3', visit_date: '2026-07-15', entry_number: 2 }),
    ];
    const sorted = sortResponsibleVisitEntries(entries, elevMap, 'elevator');
    expect(sorted.map((e) => e.entry_number)).toEqual([1, 2, 3]);
  });

  it('does not mutate the original array', () => {
    const entries = [
      makeVisit({ id: 'v-1', visit_date: '2026-07-20', entry_number: 1 }),
      makeVisit({ id: 'v-2', visit_date: '2026-07-10', entry_number: 2 }),
    ];
    const original = [...entries];
    sortResponsibleVisitEntries(entries, elevMap, 'elevator');
    expect(entries).toEqual(original);
  });
});

// ============================================================
// sortResponsibleVisitEntries — building scope
// ============================================================

describe('sortResponsibleVisitEntries — building scope', () => {
  const elevMap = new Map([
    ['e-1', makeElevator({ id: 'e-1', code: 'ASC-10' })],
    ['e-2', makeElevator({ id: 'e-2', code: 'ASC-2' })],
    ['e-3', makeElevator({ id: 'e-3', code: 'ASC-100' })],
  ]);

  it('orders first by visit_date ascending', () => {
    const entries = [
      makeVisit({ id: 'v-1', elevator_id: 'e-1', visit_date: '2026-07-20', entry_number: 1 }),
      makeVisit({ id: 'v-2', elevator_id: 'e-2', visit_date: '2026-07-10', entry_number: 1 }),
    ];
    const sorted = sortResponsibleVisitEntries(entries, elevMap, 'building');
    expect(sorted.map((e) => e.visit_date)).toEqual(['2026-07-10', '2026-07-20']);
  });

  it('orders by elevator code within same date using natural sort', () => {
    const entries = [
      makeVisit({ id: 'v-1', elevator_id: 'e-1', visit_date: '2026-07-15', entry_number: 1 }), // ASC-10
      makeVisit({ id: 'v-2', elevator_id: 'e-2', visit_date: '2026-07-15', entry_number: 1 }), // ASC-2
      makeVisit({ id: 'v-3', elevator_id: 'e-3', visit_date: '2026-07-15', entry_number: 1 }), // ASC-100
    ];
    const sorted = sortResponsibleVisitEntries(entries, elevMap, 'building');
    expect(sorted.map((e) => elevMap.get(e.elevator_id)?.code)).toEqual(['ASC-2', 'ASC-10', 'ASC-100']);
  });

  it('ASC-2 comes before ASC-10 (natural sort)', () => {
    const entries = [
      makeVisit({ id: 'v-1', elevator_id: 'e-1', visit_date: '2026-07-15', entry_number: 1 }), // ASC-10
      makeVisit({ id: 'v-2', elevator_id: 'e-2', visit_date: '2026-07-15', entry_number: 1 }), // ASC-2
    ];
    const sorted = sortResponsibleVisitEntries(entries, elevMap, 'building');
    expect(sorted[0].elevator_id).toBe('e-2');
    expect(sorted[1].elevator_id).toBe('e-1');
  });

  it('orders by entry_number within same elevator and date', () => {
    const entries = [
      makeVisit({ id: 'v-1', elevator_id: 'e-2', visit_date: '2026-07-15', entry_number: 3 }),
      makeVisit({ id: 'v-2', elevator_id: 'e-2', visit_date: '2026-07-15', entry_number: 1 }),
    ];
    const sorted = sortResponsibleVisitEntries(entries, elevMap, 'building');
    expect(sorted.map((e) => e.entry_number)).toEqual([1, 3]);
  });

  it('does not use elevator_id for ordering (UUIDs are scrambled)', () => {
    const entries = [
      makeVisit({ id: 'v-1', elevator_id: 'zzz-uuid', visit_date: '2026-07-15', entry_number: 1 }),
      makeVisit({ id: 'v-2', elevator_id: 'aaa-uuid', visit_date: '2026-07-15', entry_number: 2 }),
    ];
    const localMap = new Map([
      ['zzz-uuid', makeElevator({ id: 'zzz-uuid', code: 'ASC-100' })],
      ['aaa-uuid', makeElevator({ id: 'aaa-uuid', code: 'ASC-2' })],
    ]);
    const sorted = sortResponsibleVisitEntries(entries, localMap, 'building');
    expect(sorted[0].elevator_id).toBe('aaa-uuid');
    expect(sorted[1].elevator_id).toBe('zzz-uuid');
  });
});

// ============================================================
// buildResponsibleVisitBookEntries
// ============================================================

describe('buildResponsibleVisitBookEntries', () => {
  const elevMap = new Map([['e-1', makeElevator()]]);
  const techMap = new Map<string, ResponsibleTechnician>([
    ['t-1', { id: 't-1', full_name: 'Juan Pérez' }],
  ]);
  const srMap = new Map<string, ResponsibleServiceRecord>();
  const soMap = new Map<string, ResponsibleServiceOrder>();

  it('adds elevator with id and code', () => {
    const entries = [makeVisit({ elevator_id: 'e-1' })];
    const result = buildResponsibleVisitBookEntries(entries, elevMap, techMap, srMap, soMap);
    expect(result[0].elevator).toEqual({ id: 'e-1', code: 'ASC-0001' });
  });

  it('adds resolved technician', () => {
    const entries = [makeVisit({ elevator_id: 'e-1', technician_id: 't-1' })];
    const result = buildResponsibleVisitBookEntries(entries, elevMap, techMap, srMap, soMap);
    expect(result[0].technician).toEqual({ id: 't-1', full_name: 'Juan Pérez' });
  });

  it('keeps technician id when not resolvable, full_name is undefined', () => {
    const entries = [makeVisit({ elevator_id: 'e-1', technician_id: 't-unknown' })];
    const result = buildResponsibleVisitBookEntries(entries, elevMap, techMap, srMap, soMap);
    expect(result[0].technician).toEqual({ id: 't-unknown', full_name: undefined });
  });

  it('adds service_case with case_number and numbering_mode', () => {
    const entries = [makeVisit({ elevator_id: 'e-1', service_case_id: 'sc-1', case_number: 1913, numbering_mode: 'test' })];
    const result = buildResponsibleVisitBookEntries(entries, elevMap, techMap, srMap, soMap);
    expect(result[0].service_case).toEqual({ id: 'sc-1', case_number: 1913, numbering_mode: 'test' });
  });

  it('case_number 1913 with test mode is correctly represented', () => {
    const entries = [makeVisit({ elevator_id: 'e-1', service_case_id: 'sc-1', case_number: 1913, numbering_mode: 'test' })];
    const result = buildResponsibleVisitBookEntries(entries, elevMap, techMap, srMap, soMap);
    expect(result[0].service_case?.case_number).toBe(1913);
    expect(result[0].service_case?.numbering_mode).toBe('test');
  });

  it('adds _serviceRecord when service_record_id exists', () => {
    const srMapLocal = new Map<string, ResponsibleServiceRecord>([
      ['sr-1', { id: 'sr-1', elevator_id: 'e-1', technician_id: 't-1', service_date: '2026-07-10', service_time: null, service_type: 'preventivo', status: 'approved', description: 'Desc', technical_report: null, observations: null, operational_status_at_service: null, conservation_status_at_service: null, approved_at: null, final_report_text: null }],
    ]);
    const entries = [makeVisit({ elevator_id: 'e-1', service_record_id: 'sr-1' })];
    const result = buildResponsibleVisitBookEntries(entries, elevMap, techMap, srMapLocal, soMap);
    expect(result[0]._serviceRecord).toBeDefined();
    expect((result[0]._serviceRecord as any)?.description).toBe('Desc');
  });

  it('adds _serviceOrder when service_order_id exists', () => {
    const soMapLocal = new Map<string, ResponsibleServiceOrder>([
      ['so-1', { id: 'so-1', elevator_id: 'e-1', subject: 'Orden X', order_type: 'corrective', status: 'approved', completion_summary: 'Listo', reviewed_at: null, service_case_id: null }],
    ]);
    const entries = [makeVisit({ elevator_id: 'e-1', service_order_id: 'so-1' })];
    const result = buildResponsibleVisitBookEntries(entries, elevMap, techMap, srMap, soMapLocal);
    expect(result[0]._serviceOrder).toBeDefined();
    expect((result[0]._serviceOrder as any)?.completion_summary).toBe('Listo');
  });

  it('optional relations are null when not present', () => {
    const entries = [makeVisit({ elevator_id: 'e-1' })];
    const result = buildResponsibleVisitBookEntries(entries, elevMap, techMap, srMap, soMap);
    expect(result[0].technician).toBeUndefined();
    expect(result[0].service_case).toBeUndefined();
    expect(result[0]._serviceRecord).toBeNull();
    expect(result[0]._serviceOrder).toBeNull();
  });
});

// ============================================================
// Missing elevator throws
// ============================================================

describe('buildResponsibleVisitBookEntries — missing elevator', () => {
  it('throws Error with entry number when elevator not found', () => {
    const emptyMap = new Map<string, ResponsibleElevator>();
    const entries = [makeVisit({ elevator_id: 'e-missing', entry_number: 42 })];
    expect(() => buildResponsibleVisitBookEntries(entries, emptyMap, new Map(), new Map(), new Map()))
      .toThrow('No se pudo identificar el ascensor del asiento N.º 42');
  });
});

// ============================================================
// No invented fields
// ============================================================

describe('buildResponsibleVisitBookEntries — no invented fields', () => {
  it('result does not contain registered_by, registered_at, is_rectification, created_at, updated_at', () => {
    const elevMap = new Map([['e-1', makeElevator()]]);
    const entries = [makeVisit({ elevator_id: 'e-1' })];
    const result = buildResponsibleVisitBookEntries(entries, elevMap, new Map(), new Map(), new Map());
    const entry = result[0];
    expect('registered_by' in entry).toBe(false);
    expect('registered_at' in entry).toBe(false);
    expect('is_rectification' in entry).toBe(false);
    expect('created_at' in entry).toBe(false);
    expect('updated_at' in entry).toBe(false);
  });
});
