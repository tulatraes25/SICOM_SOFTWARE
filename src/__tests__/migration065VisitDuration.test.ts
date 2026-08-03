import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const migrationPath = resolve(__dirname, '../../supabase/migrations/065_fix_visit_duration_calculation.sql');
const migration = readFileSync(migrationPath, 'utf-8');

const completeFn = migration.slice(
  migration.indexOf('CREATE OR REPLACE FUNCTION public.complete_service_order_with_visit'),
  migration.indexOf('LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;', migration.indexOf('CREATE OR REPLACE FUNCTION public.complete_service_order_with_visit')) + 'LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;'.length,
);

const cancelFn = migration.slice(
  migration.indexOf('CREATE OR REPLACE FUNCTION public.cancel_service_order_with_visit'),
  migration.indexOf('LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;', migration.indexOf('CREATE OR REPLACE FUNCTION public.cancel_service_order_with_visit')) + 'LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;'.length,
);

describe('Migration 065 — complete_service_order_with_visit contract', () => {
  it('conserva admin', () => {
    expect(completeFn).toContain("'admin'");
  });

  it('conserva supervisor', () => {
    expect(completeFn).toContain("'supervisor'");
  });

  it('conserva technician', () => {
    expect(completeFn).toContain("'technician'");
  });

  it('conserva FOR UPDATE', () => {
    expect(completeFn).toContain('FOR UPDATE');
  });

  it('conserva técnico principal', () => {
    expect(completeFn).toContain('is_lead');
    expect(completeFn).toContain('Solo el técnico principal puede completar');
  });

  it('conserva estado visited', () => {
    expect(completeFn).toContain("'visited'");
  });

  it('usa v_closed_at', () => {
    expect(completeFn).toContain('v_closed_at');
  });

  it('usa check_in_at para cálculo', () => {
    expect(completeFn).toContain('v_visit.check_in_at');
  });

  it('no acumula duration_seconds', () => {
    expect(completeFn).not.toContain("COALESCE(v_visit.duration_seconds, 0)");
  });

  it('actualiza service_order_technicians', () => {
    expect(completeFn).toContain('service_order_technicians');
    expect(completeFn).toContain('completed_at');
  });

  it('inserta order_completed', () => {
    expect(completeFn).toContain('order_completed');
  });

  it('tiene SECURITY DEFINER', () => {
    expect(completeFn).toContain('SECURITY DEFINER');
  });

  it('tiene search_path', () => {
    expect(completeFn).toContain('search_path = public, pg_temp');
  });
});

describe('Migration 065 — cancel_service_order_with_visit contract', () => {
  it('solo admite admin/supervisor', () => {
    expect(cancelFn).toContain("'admin', 'supervisor'");
    expect(cancelFn).not.toContain("'technician'");
  });

  it('exige motivo', () => {
    expect(cancelFn).toContain('trim(p_reason)');
    expect(cancelFn).toContain('motivo de cancelación es obligatorio');
  });

  it('conserva cancellation_reason', () => {
    expect(cancelFn).toContain('cancellation_reason = p_reason');
  });

  it('conserva FOR UPDATE', () => {
    expect(cancelFn).toContain('FOR UPDATE');
  });

  it('protege estado approved', () => {
    expect(cancelFn).toContain("'approved'");
  });

  it('protege estado cancelled', () => {
    expect(cancelFn).toContain("'cancelled'");
  });

  it('usa v_closed_at', () => {
    expect(cancelFn).toContain('v_closed_at');
  });

  it('usa check_in_at para cálculo', () => {
    expect(cancelFn).toContain('v_visit.check_in_at');
  });

  it('no acumula duration_seconds', () => {
    expect(cancelFn).not.toContain("COALESCE(v_visit.duration_seconds, 0)");
  });

  it('inserta order_cancelled', () => {
    expect(cancelFn).toContain('order_cancelled');
  });

  it('tiene SECURITY DEFINER', () => {
    expect(cancelFn).toContain('SECURITY DEFINER');
  });
});

describe('Migration 065 — permissions', () => {
  it('revoke PUBLIC on complete', () => {
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.complete_service_order_with_visit(UUID, TEXT) FROM PUBLIC');
  });

  it('revoke anon on complete', () => {
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.complete_service_order_with_visit(UUID, TEXT) FROM anon');
  });

  it('grant authenticated on complete', () => {
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.complete_service_order_with_visit(UUID, TEXT) TO authenticated');
  });

  it('revoke PUBLIC on cancel', () => {
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.cancel_service_order_with_visit(UUID, TEXT) FROM PUBLIC');
  });

  it('revoke anon on cancel', () => {
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.cancel_service_order_with_visit(UUID, TEXT) FROM anon');
  });

  it('grant authenticated on cancel', () => {
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.cancel_service_order_with_visit(UUID, TEXT) TO authenticated');
  });
});

describe('Migration 065 — backfill', () => {
  it('UPDATE y GET DIAGNOSTICS están dentro del mismo bloque DO', () => {
    const doBlockStart = migration.indexOf('DO $$');
    const doBlockEnd = migration.indexOf('END $$;', doBlockStart) + 'END $$;'.length;
    const backfillBlock = migration.slice(doBlockStart, doBlockEnd);
    expect(backfillBlock).toContain('UPDATE public.elevator_visit_entries');
    expect(backfillBlock).toContain('GET DIAGNOSTICS v_count = ROW_COUNT');
  });

  it('existe GET DIAGNOSTICS v_count = ROW_COUNT', () => {
    expect(migration).toContain('GET DIAGNOSTICS v_count = ROW_COUNT');
  });

  it('el bloque informa el conteo', () => {
    expect(migration).toContain("RAISE NOTICE 'Migration 065: corrected duration for % rows'");
  });

  it('backfill usa IS DISTINCT FROM', () => {
    expect(migration).toContain('IS DISTINCT FROM');
  });

  it('no modifica updated_at en backfill', () => {
    const backfillSection = migration.slice(0, migration.indexOf('complete_service_order_with_visit'));
    expect(backfillSection).not.toContain('updated_at');
  });

  it('usa CTE calculated', () => {
    expect(migration).toContain('WITH calculated AS');
  });
});
