import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const migrationPath = resolve(__dirname, '../../supabase/migrations/066_harden_service_order_assignment.sql');
const migration = readFileSync(migrationPath, 'utf-8');

const fn = migration.slice(
  migration.indexOf('CREATE OR REPLACE FUNCTION public.assign_service_order_technicians'),
  migration.indexOf('LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;', migration.indexOf('CREATE OR REPLACE FUNCTION public.assign_service_order_technicians')) + 'LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;'.length,
);

describe('Migration 066 — assign_service_order_technicians contract', () => {
  it('admin permitido', () => { expect(fn).toContain("'admin'"); });
  it('supervisor permitido', () => { expect(fn).toContain("'supervisor'"); });
  it('técnico no puede ejecutar', () => { expect(fn).toContain("v_role NOT IN ('admin', 'supervisor')"); });
  it('FOR UPDATE', () => { expect(fn).toContain('FOR UPDATE'); });
  it('solo ready/assigned', () => { expect(fn).toContain("'ready', 'assigned'"); });
  it('draft bloqueado implícitamente', () => { expect(fn).toContain('NOT IN'); });
  it('in_progress bloqueado implícitamente', () => { expect(fn).toContain('NOT IN'); });
  it('array vacío bloqueado', () => { expect(fn).toContain('Debe seleccionar al menos un técnico'); });
  it('duplicados bloqueados', () => { expect(fn).toContain('No se permiten técnicos duplicados'); });
  it('técnicos activos', () => { expect(fn).toContain('active = true'); });
  it('roles technician', () => { expect(fn).toContain("role = 'technician'"); });
  it('lead obligatorio', () => { expect(fn).toContain('Debe seleccionar un técnico principal'); });
  it('lead incluido', () => { expect(fn).toContain('El técnico principal debe formar parte de la asignación'); });
  it('exactamente un principal', () => { expect(fn).toContain('v_tid = p_is_lead'); });
  it('validaciones antes del DELETE', () => {
    const deleteIdx = fn.indexOf('DELETE FROM');
    const validationChecks = ['Debe seleccionar al menos', 'No se permiten', 'Uno o más técnicos'];
    for (const check of validationChecks) {
      expect(fn.indexOf(check)).toBeLessThan(deleteIdx);
    }
  });
  it('evento con lead', () => { expect(fn).toContain('lead_technician_id'); });
  it('SECURITY DEFINER', () => { expect(fn).toContain('SECURITY DEFINER'); });
  it('search_path', () => { expect(fn).toContain('search_path = public, pg_temp'); });
  it('REVOKE PUBLIC', () => { expect(migration).toContain('REVOKE ALL ON FUNCTION public.assign_service_order_technicians(UUID, UUID[], UUID) FROM PUBLIC'); });
  it('REVOKE anon', () => { expect(migration).toContain('REVOKE ALL ON FUNCTION public.assign_service_order_technicians(UUID, UUID[], UUID) FROM anon'); });
  it('GRANT authenticated', () => { expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.assign_service_order_technicians(UUID, UUID[], UUID) TO authenticated'); });
});
