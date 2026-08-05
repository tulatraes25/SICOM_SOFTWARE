import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const migrationPath = resolve(__dirname, '../../supabase/migrations/070_monthly_report_email_deliveries.sql');
const migration = readFileSync(migrationPath, 'utf-8');

const edgeFnPath = resolve(__dirname, '../../supabase/functions/send-monthly-report-email/index.ts');
const edgeFn = readFileSync(edgeFnPath, 'utf-8');

describe('Migration 070 — monthly_report_email_deliveries RLS', () => {
  it('no contiene service_role_full_access', () => {
    expect(migration).not.toContain('service_role_full_access');
  });

  it('política de lectura usa TO authenticated', () => {
    expect(migration).toContain('CREATE POLICY "authenticated_read_own"');
    expect(migration).toContain('FOR SELECT');
    expect(migration).toContain('TO authenticated');
    expect(migration).toContain('USING (sent_by = auth.uid())');
  });

  it('no existen policies INSERT/UPDATE/DELETE para authenticated', () => {
    const policyBlocks = migration.split('CREATE POLICY');
    for (const block of policyBlocks.slice(1)) {
      expect(block).not.toMatch(/FOR\s+(INSERT|UPDATE|DELETE|ALL)/i);
    }
  });

  it('no usa FOR ALL sin TO', () => {
    expect(migration).not.toMatch(/FOR\s+ALL/i);
  });

  it('mantiene RLS habilitado', () => {
    expect(migration).toContain('ALTER TABLE public.monthly_report_email_deliveries ENABLE ROW LEVEL SECURITY;');
  });
});

describe('Edge Function — send-monthly-report-email auditoría', () => {
  it('define auditFailed como estado interno', () => {
    expect(edgeFn).toContain('let auditFailed = false;');
  });

  it('fallo pending → sent produce audit_failed=true', () => {
    expect(edgeFn).toContain('if (updateAuditError || !updatedAuditRow || updatedAuditRow.status !== "sent")');
    expect(edgeFn).toContain('auditFailed = true;');
    expect(edgeFn).toContain('"audit_update_failed"');
  });

  it('correo enviado con fallo de auditoría conserva success', () => {
    expect(edgeFn).toContain('results.push({ email, status: "sent", error: "audit_update_failed" });');
    expect(edgeFn).toContain('successCount++;');
  });

  it('fallo de auditoría no impide report_status sent', () => {
    expect(edgeFn).toContain('const allSent = successCount > 0 && failedCount === 0 && results.every(r => r.status === "sent");');
    expect(edgeFn).toContain('let reportStatus: string = allSent ? "sent" : "approved";');
  });

  it('fallo pending → failed produce audit_failed=true', () => {
    expect(edgeFn).toContain('if (failedAuditError || !failedAuditRow || failedAuditRow.status !== "failed")');
    expect(edgeFn).toContain('auditFailed = true;');
  });

  it('update failed inspecciona data y error', () => {
    expect(edgeFn).toContain('.select("id, status, error_message")');
    expect(edgeFn).toContain('failedAuditError');
    expect(edgeFn).toContain('failedAuditRow');
  });

  it('update sent inspecciona data y error', () => {
    expect(edgeFn).toContain('.select("id, status, provider_message_id")');
    expect(edgeFn).toContain('updateAuditError');
    expect(edgeFn).toContain('updatedAuditRow');
  });

  it('respuesta incluye audit_failed', () => {
    expect(edgeFn).toContain('audit_failed: auditFailed,');
  });

  it('no usa try/catch vacío para detectar errores de Supabase', () => {
    expect(edgeFn).not.toContain('} catch {}');
  });
});
