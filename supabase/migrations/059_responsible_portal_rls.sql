-- 059: Responsible portal RLS policies (hardened)
-- Read-only access for responsible users to assigned elevators and approved data.
-- No new tables created. No recipient tables exposed.
-- Uses existing elevators.responsible_user_id as sole assignment source.
-- All policies validate role via is_active_responsible() function.

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
-- 1. BUILDINGS — Replace unscoped policy with scoped
-- ============================================================

DROP POLICY IF EXISTS "responsible_select_assigned_buildings" ON buildings;
DROP POLICY IF EXISTS "Responsible can view buildings" ON buildings;

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
-- 2. ELEVATOR_VISIT_ENTRIES — Approved only for assigned elevators
-- ============================================================

DROP POLICY IF EXISTS "responsible_select_approved_visit_entries" ON elevator_visit_entries;

CREATE POLICY "responsible_select_approved_visit_entries"
  ON elevator_visit_entries FOR SELECT
  TO authenticated
  USING (
    public.is_active_responsible()
    AND status = 'approved'
    AND EXISTS (
      SELECT 1 FROM elevators e
      WHERE e.id = elevator_visit_entries.elevator_id
        AND e.responsible_user_id = auth.uid()
        AND e.active = true
    )
  );

-- ============================================================
-- 3. SERVICE_ORDERS — Removed direct SELECT policy.
--    Use get_responsible_service_orders() RPC instead.
--    This avoids exposing internal_notes, reviewer_notes, etc.
-- ============================================================

DROP POLICY IF EXISTS "responsible_select_approved_service_orders" ON service_orders;
DROP POLICY IF EXISTS "so_responsible_select" ON service_orders;

-- ============================================================
-- 4. SERVICE_RECORDS — Approved only for assigned elevators
--    Drops and recreates to ensure correct definition.
-- ============================================================

DROP POLICY IF EXISTS "responsible_select_approved_service_records" ON service_records;
DROP POLICY IF EXISTS "Responsible can view service records for assigned elevators" ON service_records;
DROP POLICY IF EXISTS "Responsible can view approved records for assigned elevators" ON service_records;

CREATE POLICY "responsible_select_approved_service_records"
  ON service_records FOR SELECT
  TO authenticated
  USING (
    public.is_active_responsible()
    AND status = 'approved'
    AND EXISTS (
      SELECT 1 FROM elevators e
      WHERE e.id = service_records.elevator_id
        AND e.responsible_user_id = auth.uid()
        AND e.active = true
    )
  );

-- ============================================================
-- 5. MONTHLY_REPORTS — Approved/sent only for assigned elevators
--    Drops and recreates to ensure correct definition.
-- ============================================================

DROP POLICY IF EXISTS "Responsible can view approved reports for assigned elevators" ON monthly_reports;
DROP POLICY IF EXISTS "mr_responsible_select" ON monthly_reports;

CREATE POLICY "responsible_select_approved_monthly_reports"
  ON monthly_reports FOR SELECT
  TO authenticated
  USING (
    public.is_active_responsible()
    AND status IN ('approved', 'sent')
    AND EXISTS (
      SELECT 1 FROM elevators e
      WHERE e.id = monthly_reports.elevator_id
        AND e.responsible_user_id = auth.uid()
        AND e.active = true
    )
  );

-- ============================================================
-- 6. SERVICE_CHECKLIST_ITEMS — Read-only for approved records
-- ============================================================

DROP POLICY IF EXISTS "responsible_select_assigned_checklist" ON service_checklist_items;

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
-- 7. CLIENTS — Clients of assigned buildings
-- ============================================================

DROP POLICY IF EXISTS "responsible_select_assigned_clients" ON clients;
DROP POLICY IF EXISTS "Responsible can view clients" ON clients;

CREATE POLICY "responsible_select_assigned_clients"
  ON clients FOR SELECT
  TO authenticated
  USING (
    public.is_active_responsible()
    AND EXISTS (
      SELECT 1 FROM buildings b
      JOIN elevators e ON e.building_id = b.id
      WHERE b.client_id = clients.id
        AND e.responsible_user_id = auth.uid()
        AND e.active = true
    )
  );

-- ============================================================
-- 8. PROFILES — Only own profile (existing policy handles this)
--    No direct SELECT policy for technician names.
--    Use get_responsible_technicians() RPC instead.
-- ============================================================

DROP POLICY IF EXISTS "responsible_select_technician_names" ON profiles;

-- ============================================================
-- 9. RPC: get_responsible_technicians()
--    Returns only id and full_name for technicians who worked
--    on approved records for assigned elevators.
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
-- 10. RPC: get_responsible_service_orders()
--     Returns only public fields for approved orders of assigned elevators.
--     Avoids exposing internal_notes, reviewer_notes, etc.
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
    so.id,
    so.elevator_id,
    so.subject,
    so.order_type,
    so.status,
    so.completion_summary,
    so.reviewed_at,
    so.service_case_id
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
-- 11. RPC: get_responsible_monthly_reports()
--     Returns only public fields for approved/sent reports.
--     Avoids exposing content, summary, general_notes, etc.
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
  pdf_url text,
  pdf_storage_path text,
  pdf_generated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    mr.id,
    mr.elevator_id,
    mr.period,
    mr.title,
    mr.status,
    mr.general_status,
    mr.services_count,
    mr.report_month,
    mr.report_year,
    mr.pdf_url,
    mr.pdf_storage_path,
    mr.pdf_generated_at
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
-- 12. STORAGE — Signed URLs via Edge Function (no direct policies)
-- ============================================================
-- Storage access deferred to Edge Function that validates
-- responsible assignment before generating signed URLs.
-- No storage policies created.

-- ============================================================
-- DONE
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '=== Migration 059 Complete ===';
  RAISE NOTICE 'Functions created:';
  RAISE NOTICE '  - is_active_responsible() → boolean';
  RAISE NOTICE '  - get_responsible_technicians() → TABLE(id, full_name)';
  RAISE NOTICE '  - get_responsible_service_orders(uuid) → TABLE(8 public columns)';
  RAISE NOTICE '  - get_responsible_monthly_reports(uuid) → TABLE(12 public columns)';
  RAISE NOTICE 'Policies created:';
  RAISE NOTICE '  - buildings: responsible_select_assigned_buildings';
  RAISE NOTICE '  - elevator_visit_entries: responsible_select_approved_visit_entries';
  RAISE NOTICE '  - service_records: responsible_select_approved_service_records';
  RAISE NOTICE '  - monthly_reports: responsible_select_approved_monthly_reports';
  RAISE NOTICE '  - service_checklist_items: responsible_select_approved_checklist';
  RAISE NOTICE '  - clients: responsible_select_assigned_clients';
  RAISE NOTICE 'Direct SELECT removed:';
  RAISE NOTICE '  - service_orders (use RPC instead)';
  RAISE NOTICE '  - profiles technician names (use RPC instead)';
  RAISE NOTICE 'No new tables created.';
  RAISE NOTICE 'No recipient tables exposed.';
  RAISE NOTICE 'Storage: deferred to Edge Function (signed URLs).';
END $$;
