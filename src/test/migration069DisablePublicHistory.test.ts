import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const migrationPath = resolve(__dirname, '../../supabase/migrations/069_disable_public_elevator_history.sql');
const migration = readFileSync(migrationPath, 'utf-8');

describe('Migration 069 — Disable public elevator history', () => {
  it('firma exacta de get_public_elevator_history_by_token(TEXT, INTEGER)', () => {
    expect(migration).toContain('public.get_public_elevator_history_by_token(TEXT, INTEGER)');
  });

  it('REVOKE PUBLIC', () => {
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.get_public_elevator_history_by_token(TEXT, INTEGER) FROM PUBLIC',
    );
  });

  it('REVOKE anon', () => {
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.get_public_elevator_history_by_token(TEXT, INTEGER) FROM anon',
    );
  });

  it('REVOKE authenticated', () => {
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.get_public_elevator_history_by_token(TEXT, INTEGER) FROM authenticated',
    );
  });

  it('GRANT service_role', () => {
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.get_public_elevator_history_by_token(TEXT, INTEGER) TO service_role',
    );
  });

  it('no DROP FUNCTION', () => {
    expect(migration).not.toContain('DROP FUNCTION');
  });

  it('no cambios de datos', () => {
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
  });

  it('no cambios de tablas', () => {
    expect(migration).not.toContain('ALTER TABLE');
    expect(migration).not.toContain('CREATE TABLE');
  });

  it('no modifica get_public_elevator_by_token', () => {
    expect(migration).not.toContain('CREATE OR REPLACE FUNCTION public.get_public_elevator_by_token');
    expect(migration).not.toContain('ALTER FUNCTION public.get_public_elevator_by_token');
  });

  it('no modifica register_public_qr_scan', () => {
    expect(migration).not.toContain('CREATE OR REPLACE FUNCTION public.register_public_qr_scan');
    expect(migration).not.toContain('ALTER FUNCTION public.register_public_qr_scan');
  });

  it('existe verificación final con RAISE EXCEPTION', () => {
    expect(migration).toContain('DO $$');
    expect(migration).toContain('RAISE EXCEPTION');
    expect(migration).toContain('RAISE NOTICE');
  });
});
