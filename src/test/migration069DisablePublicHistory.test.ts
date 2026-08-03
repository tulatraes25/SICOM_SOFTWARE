import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const migrationPath = resolve(__dirname, '../../supabase/migrations/069_disable_public_elevator_history.sql');
const migration = readFileSync(migrationPath, 'utf-8');

describe('Migration 069 — Disable public elevator history', () => {
  it('no contiene pg_proc_acl', () => {
    expect(migration).not.toContain('pg_proc_acl');
  });

  it('usa to_regprocedure con las tres firmas exactas', () => {
    expect(migration).toContain('public.get_public_elevator_history_by_token(text,integer)');
    expect(migration).toContain('public.get_public_elevator_by_token(text)');
    expect(migration).toContain('public.register_public_qr_scan(text,text)');
  });

  it('usa has_function_privilege', () => {
    expect(migration).toContain('has_function_privilege');
  });

  it('verifica anon=false para historial', () => {
    expect(migration).toContain("'anon'");
    expect(migration).toContain('v_history_oid');
    expect(migration).toContain('EXECUTE');
    expect(migration).toContain('anon can still execute public elevator history');
  });

  it('verifica authenticated=false para historial', () => {
    expect(migration).toContain("'authenticated'");
    expect(migration).toContain('v_history_oid');
    expect(migration).toContain('authenticated can still execute public elevator history');
  });

  it('verifica service_role=true para historial', () => {
    expect(migration).toContain("'service_role'");
    expect(migration).toContain('v_history_oid');
    expect(migration).toContain('service_role lost access to public elevator history');
  });

  it('verifica anon=true para get_public_elevator_by_token', () => {
    expect(migration).toContain("'anon'");
    expect(migration).toContain('v_elevator_oid');
    expect(migration).toContain('get_public_elevator_by_token lost anon access');
  });

  it('verifica anon=true para register_public_qr_scan', () => {
    expect(migration).toContain("'anon'");
    expect(migration).toContain('v_scan_oid');
    expect(migration).toContain('register_public_qr_scan lost anon access');
  });

  it('usa RAISE EXCEPTION', () => {
    expect(migration).toContain('RAISE EXCEPTION');
  });

  it('no usa RAISE WARNING', () => {
    expect(migration).not.toContain('RAISE WARNING');
  });

  it('conserva los REVOKE y GRANT existentes', () => {
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.get_public_elevator_history_by_token(TEXT, INTEGER) FROM PUBLIC',
    );
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.get_public_elevator_history_by_token(TEXT, INTEGER) FROM anon',
    );
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.get_public_elevator_history_by_token(TEXT, INTEGER) FROM authenticated',
    );
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.get_public_elevator_history_by_token(TEXT, INTEGER) TO service_role',
    );
  });

  it('no modifica datos ni tablas', () => {
    const lines = migration.split('\n');
    let inDoBlock = false;
    for (const line of lines) {
      if (line.includes('DO $$')) inDoBlock = true;
      if (line.includes('$$;')) inDoBlock = false;
      if (!inDoBlock) {
        const trimmed = line.trim();
        expect(trimmed.startsWith('INSERT INTO') || trimmed.startsWith('UPDATE ') || trimmed.startsWith('DELETE FROM')).toBe(false);
      }
    }
    expect(migration).not.toContain('ALTER TABLE');
    expect(migration).not.toContain('CREATE TABLE');
  });
});
