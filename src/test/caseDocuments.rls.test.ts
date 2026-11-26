// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

// Run the actual migration against PostgreSQL in memory. The fixture supplies
// Supabase's auth/storage interfaces and the existing case visibility rules;
// no network, production credentials, files or real accounts are used.
const migration = readFileSync(resolve('supabase/migrations/073_service_case_documents.sql'), 'utf8');
const ids = {
  admin: '10000000-0000-4000-8000-000000000001',
  supervisor: '10000000-0000-4000-8000-000000000002',
  technician: '10000000-0000-4000-8000-000000000003',
  otherTechnician: '10000000-0000-4000-8000-000000000004',
  responsible: '10000000-0000-4000-8000-000000000005',
  inactive: '10000000-0000-4000-8000-000000000006',
  assignedCase: '20000000-0000-4000-8000-000000000001',
  otherCase: '20000000-0000-4000-8000-000000000002',
  orderCase: '20000000-0000-4000-8000-000000000003',
  order: '30000000-0000-4000-8000-000000000001',
  document: '40000000-0000-4000-8000-000000000001',
};
let db: PGlite;

async function actAs(userId: string, role = 'authenticated') {
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await db.exec(`SET ROLE ${role}`);
}

function objectPath(userId = ids.admin, caseId = ids.assignedCase) {
  return `${caseId}/${userId}/${ids.document}.pdf`;
}

async function upload(userId = ids.admin, caseId = ids.assignedCase, metadata = { mimetype: 'application/pdf', size: 1024 }) {
  return db.query(`INSERT INTO storage.objects (bucket_id, name, owner_id, metadata)
    VALUES ('service-case-documents', $1, $2, $3::jsonb) RETURNING id`,
  [objectPath(userId, caseId), userId, JSON.stringify(metadata)]);
}

async function register(caseId = ids.assignedCase, fileName = 'Informe 2020.pdf') {
  return db.query<{ document: { id: string; title: string; document_date: string; file_size: number } }>(
    `SELECT public.register_service_case_document($1, $2, $3, $4, $5) AS document`,
    [ids.document, caseId, fileName, 'Informe histórico', '2020-06-15'],
  );
}

async function savedAttachment(caseId = ids.assignedCase) {
  await actAs(ids.admin);
  await upload(ids.admin, caseId);
  await register(caseId);
}

describe('private case PDF migration permissions', () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      CREATE ROLE anon NOLOGIN;
      CREATE ROLE authenticated NOLOGIN;
      CREATE SCHEMA auth;
      CREATE SCHEMA storage;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      CREATE TABLE public.profiles (id uuid PRIMARY KEY, role text NOT NULL, active boolean NOT NULL);
      CREATE TABLE public.service_cases (id uuid PRIMARY KEY, assigned_to uuid, status text NOT NULL);
      CREATE TABLE public.service_orders (id uuid PRIMARY KEY, service_case_id uuid NOT NULL);
      CREATE TABLE public.service_order_technicians (service_order_id uuid, technician_id uuid);
      CREATE TABLE public.service_case_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), service_case_id uuid,
        event_type text, performed_by uuid, details jsonb
      );
      CREATE TABLE public.audit_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid,
        action text, entity_type text, entity_id uuid, new_data jsonb
      );
      CREATE TABLE storage.buckets (
        id text PRIMARY KEY, name text, public boolean,
        file_size_limit bigint, allowed_mime_types text[]
      );
      CREATE TABLE storage.objects (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        bucket_id text REFERENCES storage.buckets(id), name text NOT NULL,
        owner_id text, metadata jsonb, UNIQUE (bucket_id, name)
      );
      CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS
        $$ SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
      CREATE FUNCTION storage.filename(name text) RETURNS text LANGUAGE sql IMMUTABLE AS
        $$ SELECT (string_to_array(name, '/'))[array_length(string_to_array(name, '/'), 1)] $$;
      GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated;
      GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
      GRANT SELECT ON storage.buckets TO authenticated;
      GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.service_cases ENABLE ROW LEVEL SECURITY;
      CREATE POLICY service_cases_staff ON public.service_cases FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'supervisor'))
      );
      CREATE POLICY service_cases_technician ON public.service_cases FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'technician')
        AND (assigned_to = auth.uid() OR id IN (
          SELECT so.service_case_id FROM service_orders so JOIN service_order_technicians sot
          ON sot.service_order_id = so.id WHERE sot.technician_id = auth.uid()
        ))
      );
      INSERT INTO profiles VALUES
        ('${ids.admin}', 'admin', true), ('${ids.supervisor}', 'supervisor', true),
        ('${ids.technician}', 'technician', true), ('${ids.otherTechnician}', 'technician', true),
        ('${ids.responsible}', 'responsible', true), ('${ids.inactive}', 'admin', false);
      INSERT INTO service_cases VALUES
        ('${ids.assignedCase}', '${ids.technician}', 'closed'),
        ('${ids.otherCase}', '${ids.otherTechnician}', 'open'),
        ('${ids.orderCase}', NULL, 'open');
      INSERT INTO service_orders VALUES ('${ids.order}', '${ids.orderCase}');
      INSERT INTO service_order_technicians VALUES ('${ids.order}', '${ids.technician}');
    `);
    await db.exec(migration);
  }, 30_000);

  beforeEach(async () => { await db.exec('BEGIN'); });
  afterEach(async () => { await db.exec('ROLLBACK; RESET ROLE'); });
  afterAll(async () => { await db?.close(); });

  it('creates a private bucket restricted to PDFs up to 20 MB', async () => {
    const { rows } = await db.query('SELECT public, file_size_limit, allowed_mime_types FROM storage.buckets');
    expect(rows).toEqual([{ public: false, file_size_limit: 20 * 1024 * 1024, allowed_mime_types: ['application/pdf'] }]);
  });

  it.each([ids.admin, ids.supervisor])('allows authorized staff %s to attach a historical PDF to a closed case', async (userId) => {
    await actAs(userId);
    await upload(userId);
    const result = await register();
    expect(result.rows[0].document).toMatchObject({ id: ids.document, title: 'Informe histórico', document_date: '2020-06-15', file_size: 1024 });
    expect((await db.query('SELECT status FROM service_cases WHERE id = $1', [ids.assignedCase])).rows).toEqual([{ status: 'closed' }]);
    await db.exec('RESET ROLE');
    expect((await db.query('SELECT event_type FROM service_case_events')).rows).toEqual([{ event_type: 'document_uploaded' }]);
    expect((await db.query('SELECT entity_type FROM audit_logs')).rows).toEqual([{ entity_type: 'service_case_documents' }]);
  });

  it.each([ids.technician, ids.responsible, ids.inactive])('denies uploads by unauthorized/inactive user %s', async (userId) => {
    await actAs(userId);
    await expect(upload(userId)).rejects.toMatchObject({ code: '42501' });
  });

  it.each([ids.technician, ids.responsible, ids.inactive])('denies direct RPC calls by unauthorized/inactive user %s', async (userId) => {
    await actAs(userId);
    await expect(register()).rejects.toMatchObject({ code: '42501' });
  });

  it('denies anonymous RPC execution', async () => {
    await actAs('', 'anon');
    await expect(register()).rejects.toMatchObject({ code: '42501' });
  });

  it('rejects another uploader path', async () => {
    await actAs(ids.supervisor);
    await expect(upload(ids.admin)).rejects.toMatchObject({ code: '42501' });
  });

  it('rejects a path for a nonexistent case', async () => {
    await actAs(ids.admin);
    await expect(upload(ids.admin, '20000000-0000-4000-8000-000000000099')).rejects.toMatchObject({ code: '42501' });
  });

  it('only exposes registered PDFs to technicians assigned to the case', async () => {
    await savedAttachment();
    await actAs(ids.technician);
    expect((await db.query('SELECT id FROM service_case_documents')).rows).toEqual([{ id: ids.document }]);
    expect((await db.query('SELECT name FROM storage.objects')).rows).toHaveLength(1);
    await actAs(ids.otherTechnician);
    expect((await db.query('SELECT id FROM service_case_documents')).rows).toEqual([]);
    expect((await db.query('SELECT name FROM storage.objects')).rows).toEqual([]);
    await actAs(ids.responsible);
    expect((await db.query('SELECT name FROM storage.objects')).rows).toEqual([]);
    await actAs(ids.inactive);
    expect((await db.query('SELECT id FROM service_case_documents')).rows).toEqual([]);
    expect((await db.query('SELECT name FROM storage.objects')).rows).toEqual([]);
  });

  it('honors existing technician access through a service order', async () => {
    await savedAttachment(ids.orderCase);
    await actAs(ids.technician);
    expect((await db.query('SELECT id FROM service_case_documents')).rows).toEqual([{ id: ids.document }]);
    expect((await db.query('SELECT name FROM storage.objects')).rows).toHaveLength(1);
  });

  it('permits cleanup of an own unregistered upload', async () => {
    await actAs(ids.admin);
    await upload();
    expect((await db.query('DELETE FROM storage.objects RETURNING id')).rows).toHaveLength(1);
  });

  it('prevents other staff from removing an unregistered upload', async () => {
    await actAs(ids.admin);
    await upload();
    await actAs(ids.supervisor);
    expect((await db.query('DELETE FROM storage.objects RETURNING id')).rows).toEqual([]);
  });

  it('prevents API clients from deleting or replacing a registered PDF', async () => {
    await savedAttachment();
    expect((await db.query('DELETE FROM storage.objects RETURNING id')).rows).toEqual([]);
    expect((await db.query("UPDATE storage.objects SET metadata = '{}' RETURNING id")).rows).toEqual([]);
  });

  it('enforces the PDF foreign key even when RLS is bypassed or an older snapshot would permit cleanup', async () => {
    await savedAttachment();
    await db.exec('RESET ROLE');
    await expect(db.query('DELETE FROM storage.objects')).rejects.toMatchObject({ code: expect.stringMatching(/^(23001|23503)$/) });
  });

  it('prevents direct metadata writes outside the registering RPC', async () => {
    await savedAttachment();
    await expect(db.query("UPDATE service_case_documents SET title = 'Alterado'")).rejects.toMatchObject({ code: '42501' });
  });

  it.each([
    { mimetype: 'text/plain', size: 10 },
    { mimetype: 'application/pdf', size: 0 },
    { mimetype: 'application/pdf', size: 20 * 1024 * 1024 + 1 },
  ])('rejects invalid Storage metadata %j before registration', async (metadata) => {
    await actAs(ids.admin);
    await upload(ids.admin, ids.assignedCase, metadata);
    await expect(register()).rejects.toMatchObject({ code: '22023' });
  });

  it('does not register files that do not exist in Storage', async () => {
    await actAs(ids.admin);
    await expect(register()).rejects.toMatchObject({ code: '22023' });
  });

  it('makes retries idempotent without duplicating history or audits', async () => {
    await savedAttachment();
    await register();
    await db.exec('RESET ROLE');
    expect((await db.query('SELECT id FROM service_case_documents')).rows).toHaveLength(1);
    expect((await db.query('SELECT id FROM service_case_events')).rows).toHaveLength(1);
    expect((await db.query('SELECT id FROM audit_logs')).rows).toHaveLength(1);
  });

  it('rolls back metadata and history if the audit cannot be written', async () => {
    await db.exec("ALTER TABLE audit_logs ADD CONSTRAINT simulate_audit_failure CHECK (entity_type <> 'service_case_documents')");
    await actAs(ids.admin);
    await upload();
    await db.exec('SAVEPOINT registration_attempt');
    await expect(register()).rejects.toMatchObject({ code: '23514' });
    await db.exec('ROLLBACK TO registration_attempt; RESET ROLE');
    expect((await db.query('SELECT id FROM service_case_documents')).rows).toEqual([]);
    expect((await db.query('SELECT id FROM service_case_events')).rows).toEqual([]);
    expect((await db.query('SELECT id FROM storage.objects')).rows).toHaveLength(1);
  });
});
