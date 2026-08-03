import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const migrationPath = resolve(__dirname, '../../supabase/migrations/067_simplify_single_technician_assignment.sql');
const migration = readFileSync(migrationPath, 'utf-8');

const fn = migration.slice(
  migration.indexOf('CREATE OR REPLACE FUNCTION public.assign_service_order_technicians'),
  migration.indexOf('LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;', migration.indexOf('CREATE OR REPLACE FUNCTION public.assign_service_order_technicians')) + 'LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;'.length,
);

describe('Migration 067 — assign_service_order_technicians contract (single technician)', () => {
  it('admin permitido', () => { expect(fn).toContain("'admin'"); });
  it('supervisor permitido', () => { expect(fn).toContain("'supervisor'"); });
  it('FOR UPDATE', () => { expect(fn).toContain('FOR UPDATE'); });
  it('draft permitido', () => { expect(fn).toContain("'draft'"); });
  it('ready permitido', () => { expect(fn).toContain("'ready'"); });
  it('assigned permitido', () => { expect(fn).toContain("'assigned'"); });
  it('otros estados bloqueados', () => { expect(fn).toContain('NOT IN'); });
  it('array vacío bloqueado', () => { expect(fn).toContain('Debe seleccionar un técnico.'); });
  it('más de un técnico bloqueado', () => { expect(fn).toContain('Solo puede asignar un técnico por orden.'); });
  it('técnico activo', () => { expect(fn).toContain('active = true'); });
  it('role technician', () => { expect(fn).toContain("role = 'technician'"); });
  it('validaciones antes del DELETE', () => {
    const deleteIdx = fn.indexOf('DELETE FROM');
    const validationChecks = ['Debe seleccionar un técnico', 'Solo puede asignar'];
    for (const check of validationChecks) {
      expect(fn.indexOf(check)).toBeLessThan(deleteIdx);
    }
  });
  it('inserta una sola fila', () => {
    expect(fn).toContain('INSERT INTO public.service_order_technicians');
    expect(fn).toContain('VALUES (p_order_id, v_tech_id, v_user_id, true)');
  });
  it('is_lead=true interno', () => { expect(fn).toContain('true)'); });
  it('SECURITY DEFINER', () => { expect(fn).toContain('SECURITY DEFINER'); });
  it('search_path', () => { expect(fn).toContain('search_path = public, pg_temp'); });
  it('REVOKE PUBLIC', () => { expect(migration).toContain('REVOKE ALL ON FUNCTION public.assign_service_order_technicians(UUID, UUID[], UUID) FROM PUBLIC'); });
  it('REVOKE anon', () => { expect(migration).toContain('REVOKE ALL ON FUNCTION public.assign_service_order_technicians(UUID, UUID[], UUID) FROM anon'); });
  it('GRANT authenticated', () => { expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.assign_service_order_technicians(UUID, UUID[], UUID) TO authenticated'); });
  it('no modifica service_orders schema', () => {
    expect(migration).not.toMatch(/CREATE\s+TABLE.*service_orders/i);
    expect(migration).not.toMatch(/DROP\s+TABLE.*service_orders/i);
  });
  it('conserva LANGUAGE plpgsql SECURITY DEFINER SET search_path', () => {
    expect(fn).toContain('LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp');
  });
});
