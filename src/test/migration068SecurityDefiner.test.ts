import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const migrationPath = resolve(__dirname, '../../supabase/migrations/068_harden_legacy_security_definer_functions.sql');
const migration = readFileSync(migrationPath, 'utf-8');

const FRONTEND_RPC = [
  'approve_service_record(UUID)',
  'reject_service_record(UUID, TEXT)',
  'save_review_report(UUID, TEXT, TEXT)',
  'start_service_review(UUID)',
  'set_service_photo_report_selection(UUID, BOOLEAN)',
];

const INTERNAL_FN = [
  'create_visit_from_service_order(UUID)',
  'get_public_service_history(UUID)',
  'handle_new_user()',
  'increment_services_count(UUID)',
  'is_valid_service_record_id(TEXT)',
  'update_visit_on_order_approve(UUID)',
  'update_visit_on_order_complete(UUID, TEXT)',
  'update_visit_on_order_corrections(UUID, TEXT)',
];

const ALL_13 = [...FRONTEND_RPC, ...INTERNAL_FN];

describe('Migration 068 — Hardened SECURITY DEFINER functions', () => {
  it('contiene las 13 firmas exactas', () => {
    for (const fn of ALL_13) {
      expect(migration).toContain(fn);
    }
  });

  it('las 12 originalmente inseguras reciben SET search_path', () => {
    // 4 frontend RPCs use ALTER FUNCTION
    for (const fn of FRONTEND_RPC.slice(0, 4)) {
      expect(migration).toContain(`ALTER FUNCTION public.${fn}`);
    }
    // 7 internal functions use ALTER FUNCTION
    for (const fn of INTERNAL_FN.filter(f => f !== 'create_visit_from_service_order(UUID)')) {
      expect(migration).toContain(`ALTER FUNCTION public.${fn}`);
    }
    // create_visit_from_service_order uses CREATE OR REPLACE with search_path
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.create_visit_from_service_order');
    // All 12 get search_path
    expect(migration).toContain('SET search_path = public, pg_temp');
  });

  it('set_service_photo_report_selection conserva search_path sin ALTER', () => {
    expect(migration).not.toContain('ALTER FUNCTION public.set_service_photo_report_selection');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.set_service_photo_report_selection(UUID, BOOLEAN)');
  });

  it('las 13 revocan PUBLIC', () => {
    for (const fn of ALL_13) {
      expect(migration).toContain(`REVOKE ALL ON FUNCTION public.${fn} FROM PUBLIC`);
    }
  });

  it('las 13 revocan anon', () => {
    for (const fn of ALL_13) {
      expect(migration).toContain(`REVOKE ALL ON FUNCTION public.${fn} FROM anon`);
    }
  });

  it('las 5 RPC de frontend conceden authenticated', () => {
    for (const fn of FRONTEND_RPC) {
      expect(migration).toContain(`GRANT EXECUTE ON FUNCTION public.${fn} TO authenticated`);
    }
  });

  it('las 8 internas revocan authenticated', () => {
    for (const fn of INTERNAL_FN) {
      expect(migration).toContain(`REVOKE ALL ON FUNCTION public.${fn} FROM authenticated`);
    }
  });

  it('service_role queda preservado (sin REVOKE service_role)', () => {
    const revokeLines = migration.split('\n').filter(l => l.trim().startsWith('REVOKE ALL'));
    for (const line of revokeLines) {
      expect(line).not.toContain('service_role');
    }
  });

  it('no modifica RPCs públicas por token', () => {
    expect(migration).not.toContain('get_public_elevator_by_token');
    expect(migration).not.toContain('get_public_elevator_history_by_token');
    expect(migration).not.toContain('register_public_qr_scan');
  });

  it('no modifica funciones *_with_visit', () => {
    expect(migration).not.toContain('start_service_order_with_visit');
    expect(migration).not.toContain('complete_service_order_with_visit');
    expect(migration).not.toContain('approve_service_order_with_visit');
    expect(migration).not.toContain('request_order_corrections_with_visit');
    expect(migration).not.toContain('cancel_service_order_with_visit');
  });

  it('no hay DROP FUNCTION', () => {
    expect(migration).not.toContain('DROP FUNCTION');
  });

  it('no hay DROP TRIGGER', () => {
    expect(migration).not.toContain('DROP TRIGGER');
  });

  it('no hay cambios de tablas', () => {
    expect(migration).not.toContain('ALTER TABLE');
    expect(migration).not.toContain('CREATE TABLE');
  });

  it('no hay cambios de datos fuera de funciones', () => {
    const lines = migration.split('\n');
    let inFunction = false;
    for (const line of lines) {
      if (line.includes('CREATE OR REPLACE FUNCTION') || line.includes('ALTER FUNCTION')) inFunction = true;
      if (line.includes('$$ LANGUAGE plpgsql')) inFunction = false;
      if (!inFunction && (line.trim().startsWith('INSERT INTO') || line.trim().startsWith('UPDATE ') || line.trim().startsWith('DELETE FROM'))) {
        expect.fail(`Standalone DML outside function body: ${line.trim()}`);
      }
    }
  });

  it('no hay GRANT ON ALL FUNCTIONS', () => {
    expect(migration).not.toContain('GRANT EXECUTE ON ALL FUNCTIONS');
  });

  it('existe bloque de verificación final', () => {
    expect(migration).toContain('$$;');
    const lastBlock = migration.slice(migration.lastIndexOf('DO $$'));
    expect(lastBlock).toContain('RAISE NOTICE');
  });

  it('handle_new_user mantiene tratamiento especial', () => {
    expect(migration).toContain('handle_new_user()');
    expect(migration).toContain('prorettype');
  });

  it('get_public_service_history queda restringida', () => {
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.get_public_service_history(UUID) FROM anon');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.get_public_service_history(UUID) FROM authenticated');
  });

  it('set_service_photo_report_selection deja de ser anon', () => {
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.set_service_photo_report_selection(UUID, BOOLEAN) FROM anon');
  });

  it('no se agrega extensions al search_path', () => {
    expect(migration).not.toContain('uuid-ossp');
    expect(migration).not.toContain('pgcrypto');
  });
});
