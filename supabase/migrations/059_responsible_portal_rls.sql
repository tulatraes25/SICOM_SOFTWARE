-- 059: Responsible portal RLS policies (column-safe RPCs)
-- Read-only access for responsible users to assigned elevators and approved data.
-- No new tables created. No recipient tables exposed.
-- No direct SELECT on any table with internal columns.
-- All data access via SECURITY DEFINER RPCs returning only public fields.
-- Uses existing elevators.responsible_user_id as sole assignment source.

-- ============================================================
-- 0. HELPER FUNCTION: is_active_responsible()
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_active_responsible()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'responsible'
      AND active = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_responsible() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_responsible() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_active_responsible() TO authenticated;

-- ============================================================
-- 1. REMOVE ALL EXISTING RESPONSIBLE SELECT POLICIES
-- ============================================================

-- elevators (CRITICAL: drops unscoped policy that allowed direct SELECT)
DROP POLICY IF EXISTS "Responsible can view assigned elevators" ON elevators;

-- buildings
DROP POLICY IF EXISTS "responsible_select_assigned_buildings" ON buildings;
DROP POLICY IF EXISTS "Responsible can view buildings" ON buildings;

-- elevator_visit_entries
DROP POLICY IF EXISTS "responsible_select_approved_visit_entries" ON elevator_visit_entries;

-- service_records
DROP POLICY IF EXISTS "responsible_select_approved_service_records" ON service_records;
DROP POLICY IF EXISTS "Responsible can view service records for assigned elevators" ON service_records;
DROP POLICY IF EXISTS "Responsible can view approved records for assigned elevators" ON service_records;

-- monthly_reports
DROP POLICY IF EXISTS "responsible_select_approved_monthly_reports" ON monthly_reports;
DROP POLICY IF EXISTS "Responsible can view approved reports for assigned elevators" ON monthly_reports;

-- service_checklist_items
DROP POLICY IF EXISTS "responsible_select_approved_checklist" ON service_checklist_items;

-- clients
DROP POLICY IF EXISTS "responsible_select_assigned_clients" ON clients;
DROP POLICY IF EXISTS "Responsible can view clients" ON clients;

-- profiles
DROP POLICY IF EXISTS "responsible_select_technician_names" ON profiles;

-- service_orders
DROP POLICY IF EXISTS "responsible_select_approved_service_orders" ON service_orders;
DROP POLICY IF EXISTS "so_responsible_select" ON service_orders;

-- ============================================================
-- 2. BUILDINGS — Scoped policy (safe: no internal columns)
-- ============================================================

CREATE POLICY "responsible_select_assigned_buildings"
  ON buildings FOR SELECT
  TO authenticated
  USING (
    public.is_active_responsible()
    AND EXISTS (
      SELECT 1 FROM elevators e
      WHERE e.building_id = buildings.id
        AND e.responsible_user_id = auth.uid()
        AND e.active = true
    )
  );

-- ============================================================
-- 3. SERVICE_CHECKLIST_ITEMS — Scoped policy (safe: checklist data)
-- ============================================================

CREATE POLICY "responsible_select_approved_checklist"
  ON service_checklist_items FOR SELECT
  TO authenticated
  USING (
    public.is_active_responsible()
    AND EXISTS (
      SELECT 1 FROM service_records sr
      JOIN elevators e ON e.id = sr.elevator_id
      WHERE sr.id = service_checklist_items.service_record_id
        AND e.responsible_user_id = auth.uid()
        AND e.active = true
        AND sr.status = 'approved'
    )
  );

-- ============================================================
-- 4. DROP OLD FUNCTIONS BEFORE RECREATING WITH NEW SIGNATURES
-- ============================================================

DROP FUNCTION IF EXISTS public.get_responsible_service_records(uuid);
DROP FUNCTION IF EXISTS public.get_responsible_monthly_reports(uuid);
DROP FUNCTION IF EXISTS public.get_responsible_visit_entries(uuid, date, date);
DROP FUNCTION IF EXISTS public.get_responsible_clients();
DROP FUNCTION IF EXISTS public.get_responsible_elevators(uuid);

-- ============================================================
-- 5. RPC: get_responsible_elevators()
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_responsible_elevators(
  p_building_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  code text,
  building_id uuid,
  manufacturer text,
  model text,
  elevator_type text,
  capacity_kg integer,
  floors_served text,
  year_installed integer,
  operational_status text,
  conservation_status text,
  contractual_status text,
  last_service_date date,
  next_service_date date,
  active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    e.id, e.code, e.building_id, e.manufacturer, e.model,
    e.elevator_type, e.capacity_kg, e.floors_served, e.year_installed,
    e.operational_status, e.conservation_status, e.contractual_status,
    e.last_service_date, e.next_service_date, e.active
  FROM elevators e
  WHERE public.is_active_responsible()
    AND e.responsible_user_id = auth.uid()
    AND e.active = true
    AND (p_building_id IS NULL OR e.building_id = p_building_id)
  ORDER BY e.code;
$$;

REVOKE ALL ON FUNCTION public.get_responsible_elevators(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_responsible_elevators(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_responsible_elevators(uuid) TO authenticated;

-- ============================================================
-- 6. RPC: get_responsible_clients()
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_responsible_clients()
RETURNS TABLE (id uuid, code text, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT c.id, c.code, c.name
  FROM clients c
  JOIN buildings b ON b.client_id = c.id
  JOIN elevators e ON e.building_id = b.id
  WHERE public.is_active_responsible()
    AND e.responsible_user_id = auth.uid()
    AND e.active = true
  ORDER BY c.name;
$$;

REVOKE ALL ON FUNCTION public.get_responsible_clients() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_responsible_clients() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_responsible_clients() TO authenticated;

-- ============================================================
-- 7. RPC: get_responsible_service_records()
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_responsible_service_records(
  p_elevator_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  elevator_id uuid,
  technician_id uuid,
  service_date date,
  service_time time,
  service_type text,
  status text,
  description text,
  technical_report text,
  observations text,
  operational_status_at_service text,
  conservation_status_at_service text,
  approved_at timestamptz,
  final_report_text text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    sr.id, sr.elevator_id, sr.technician_id, sr.service_date,
    sr.service_time, sr.service_type, sr.status,
    sr.description, sr.technical_report, sr.observations,
    sr.operational_status_at_service, sr.conservation_status_at_service,
    sr.approved_at, sr.final_report_text
  FROM service_records sr
  JOIN elevators e ON e.id = sr.elevator_id
  WHERE public.is_active_responsible()
    AND sr.status = 'approved'
    AND e.responsible_user_id = auth.uid()
    AND e.active = true
    AND (p_elevator_id IS NULL OR sr.elevator_id = p_elevator_id)
  ORDER BY sr.service_date DESC;
$$;

REVOKE ALL ON FUNCTION public.get_responsible_service_records(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_responsible_service_records(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_responsible_service_records(uuid) TO authenticated;

-- ============================================================
-- 8. RPC: get_responsible_visit_entries()
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_responsible_visit_entries(
  p_elevator_id uuid DEFAULT NULL,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  elevator_id uuid,
  service_case_id uuid,
  service_record_id uuid,
  service_order_id uuid,
  entry_number integer,
  visit_date date,
  entry_type text,
  origin_type text,
  title text,
  description text,
  work_performed text,
  observations text,
  recommendations text,
  operational_status text,
  conservation_status text,
  technician_id uuid,
  status text,
  check_in_at timestamptz,
  check_out_at timestamptz,
  duration_minutes integer,
  duration_seconds integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    eve.id, eve.elevator_id, eve.service_case_id, eve.service_record_id,
    eve.service_order_id, eve.entry_number, eve.visit_date,
    eve.entry_type, eve.origin_type, eve.title, eve.description,
    eve.work_performed, eve.observations, eve.recommendations,
    eve.operational_status, eve.conservation_status,
    eve.technician_id, eve.status,
    eve.check_in_at, eve.check_out_at,
    eve.duration_minutes, eve.duration_seconds
  FROM elevator_visit_entries eve
  JOIN elevators e ON e.id = eve.elevator_id
  WHERE public.is_active_responsible()
    AND eve.status = 'approved'
    AND e.responsible_user_id = auth.uid()
    AND e.active = true
    AND (p_elevator_id IS NULL OR eve.elevator_id = p_elevator_id)
    AND (p_date_from IS NULL OR eve.visit_date >= p_date_from)
    AND (p_date_to IS NULL OR eve.visit_date <= p_date_to)
  ORDER BY eve.visit_date DESC, eve.entry_number DESC;
$$;

REVOKE ALL ON FUNCTION public.get_responsible_visit_entries(uuid, date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_responsible_visit_entries(uuid, date, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_responsible_visit_entries(uuid, date, date) TO authenticated;

-- ============================================================
-- 9. RPC: get_responsible_service_orders()
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_responsible_service_orders(
  p_elevator_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  elevator_id uuid,
  subject text,
  order_type text,
  status text,
  completion_summary text,
  reviewed_at timestamptz,
  service_case_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    so.id, so.elevator_id, so.subject, so.order_type,
    so.status, so.completion_summary, so.reviewed_at, so.service_case_id
  FROM service_orders so
  JOIN elevators e ON e.id = so.elevator_id
  WHERE public.is_active_responsible()
    AND so.status = 'approved'
    AND e.responsible_user_id = auth.uid()
    AND e.active = true
    AND (p_elevator_id IS NULL OR so.elevator_id = p_elevator_id)
  ORDER BY so.reviewed_at DESC NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.get_responsible_service_orders(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_responsible_service_orders(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_responsible_service_orders(uuid) TO authenticated;

-- ============================================================
-- 10. RPC: get_responsible_monthly_reports()
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_responsible_monthly_reports(
  p_elevator_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  elevator_id uuid,
  period text,
  title text,
  status text,
  general_status text,
  services_count integer,
  report_month integer,
  report_year integer,
  pdf_generated_at timestamptz,
  has_pdf boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    mr.id, mr.elevator_id, mr.period, mr.title,
    mr.status, mr.general_status, mr.services_count,
    mr.report_month, mr.report_year, mr.pdf_generated_at,
    (mr.pdf_generated_at IS NOT NULL) AS has_pdf
  FROM monthly_reports mr
  JOIN elevators e ON e.id = mr.elevator_id
  WHERE public.is_active_responsible()
    AND mr.status IN ('approved', 'sent')
    AND e.responsible_user_id = auth.uid()
    AND e.active = true
    AND (p_elevator_id IS NULL OR mr.elevator_id = p_elevator_id)
  ORDER BY mr.report_year DESC, mr.report_month DESC;
$$;

REVOKE ALL ON FUNCTION public.get_responsible_monthly_reports(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_responsible_monthly_reports(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_responsible_monthly_reports(uuid) TO authenticated;

-- ============================================================
-- 11. RPC: get_responsible_technicians()
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_responsible_technicians()
RETURNS TABLE (id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT p.id, p.full_name
  FROM profiles p
  JOIN service_records sr ON sr.technician_id = p.id
  JOIN elevators e ON e.id = sr.elevator_id
  WHERE public.is_active_responsible()
    AND e.responsible_user_id = auth.uid()
    AND e.active = true
    AND sr.status = 'approved'
    AND p.role = 'technician'
    AND p.active = true
  ORDER BY p.full_name;
$$;

REVOKE ALL ON FUNCTION public.get_responsible_technicians() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_responsible_technicians() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_responsible_technicians() TO authenticated;

-- ============================================================
-- 12. STORAGE — Signed URLs via Edge Function (no direct policies)
-- ============================================================

-- ============================================================
-- 13. VALIDATION: No unauthorized SELECT on elevators for responsible
-- ============================================================

DO $$
DECLARE
  v_bad_policy RECORD;
BEGIN
  FOR v_bad_policy IN
    SELECT policyname, qual
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'elevators'
      AND cmd = 'SELECT'
      AND (
        roles @> ARRAY['responsible']::text[]
        OR roles @> ARRAY['authenticated']::text[]
      )
      AND policyname NOT LIKE 'Admin%'
      AND policyname NOT LIKE 'Supervisor%'
      AND policyname NOT LIKE 'Technician%'
  LOOP
    RAISE EXCEPTION 'Unauthorized SELECT policy on elevators for responsible: % (qual: %)',
      v_bad_policy.policyname, v_bad_policy.qual;
  END LOOP;
  RAISE NOTICE 'Validation passed: no unauthorized SELECT policies on elevators';
END $$;

-- ============================================================
-- DONE
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '=== Migration 059 Complete ===';
  RAISE NOTICE 'Functions created (8):';
  RAISE NOTICE '  - is_active_responsible() → boolean';
  RAISE NOTICE '  - get_responsible_elevators(uuid) → 15 columns';
  RAISE NOTICE '  - get_responsible_clients() → 3 columns';
  RAISE NOTICE '  - get_responsible_service_records(uuid) → 14 columns';
  RAISE NOTICE '  - get_responsible_visit_entries(uuid,date,date) → 22 columns';
  RAISE NOTICE '  - get_responsible_service_orders(uuid) → 8 columns';
  RAISE NOTICE '  - get_responsible_monthly_reports(uuid) → 10 columns';
  RAISE NOTICE '  - get_responsible_technicians() → 2 columns';
  RAISE NOTICE 'Direct SELECT policies (2):';
  RAISE NOTICE '  - buildings: responsible_select_assigned_buildings';
  RAISE NOTICE '  - service_checklist_items: responsible_select_approved_checklist';
  RAISE NOTICE 'Tables with NO direct SELECT for responsible:';
  RAISE NOTICE '  - elevators, clients, service_records, service_orders';
  RAISE NOTICE '  - elevator_visit_entries, monthly_reports, profiles';
  RAISE NOTICE 'No new tables. No recipient tables. Storage via Edge Function.';
END $$;
