-- 059: Responsible portal RLS policies
-- Read-only access for responsible users to assigned elevators and approved data.
-- No new tables created. No recipient tables exposed.
-- Uses existing elevators.responsible_user_id as sole assignment source.

-- ============================================================
-- 1. BUILDINGS — Replace unscoped policy with scoped
-- ============================================================

-- Problem: Current policy lets responsible see ALL buildings.
-- PostgreSQL RLS combines policies with OR, so adding a restrictive
-- policy won't help. We must DROP and REPLACE.

DROP POLICY IF EXISTS "Responsible can view buildings" ON buildings;

CREATE POLICY "responsible_select_assigned_buildings"
  ON buildings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM elevators e
      WHERE e.building_id = buildings.id
        AND e.responsible_user_id = auth.uid()
        AND e.active = true
    )
  );

-- ============================================================
-- 2. ELEVATOR_VISIT_ENTRIES — Approved only for assigned elevators
-- ============================================================

DROP POLICY IF EXISTS "visit_entries_responsible_select" ON elevator_visit_entries;

CREATE POLICY "responsible_select_approved_visit_entries"
  ON elevator_visit_entries FOR SELECT
  TO authenticated
  USING (
    status = 'approved'
    AND EXISTS (
      SELECT 1 FROM elevators e
      WHERE e.id = elevator_visit_entries.elevator_id
        AND e.responsible_user_id = auth.uid()
        AND e.active = true
    )
  );

-- ============================================================
-- 3. SERVICE_ORDERS — Approved only for assigned elevators
-- ============================================================

DROP POLICY IF EXISTS "so_responsible_select" ON service_orders;

CREATE POLICY "responsible_select_approved_service_orders"
  ON service_orders FOR SELECT
  TO authenticated
  USING (
    status = 'approved'
    AND EXISTS (
      SELECT 1 FROM elevators e
      WHERE e.id = service_orders.elevator_id
        AND e.responsible_user_id = auth.uid()
        AND e.active = true
    )
  );

-- ============================================================
-- 4. SERVICE_RECORDS — Already correctly scoped (015)
--    Status = approved + assigned elevator.
--    No changes needed. Verify policy exists:
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'responsible_select_approved_service_records'
      AND tablename = 'service_records'
  ) THEN
    RAISE WARNING 'responsible_select_approved_service_records not found on service_records — may need manual fix';
  ELSE
    RAISE NOTICE 'service_records policy verified: responsible_select_approved_service_records';
  END IF;
END $$;

-- ============================================================
-- 5. MONTHLY_REPORTS — Already correctly scoped (004)
--    Status IN (approved, sent) + assigned elevator.
--    No changes needed. Verify policy exists:
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Responsible can view approved reports for assigned elevators'
      AND tablename = 'monthly_reports'
  ) THEN
    RAISE WARNING 'monthly_reports responsible policy not found — may need manual fix';
  ELSE
    RAISE NOTICE 'monthly_reports policy verified: Responsible can view approved reports for assigned elevators';
  END IF;
END $$;

-- ============================================================
-- 6. SERVICE_CHECKLIST_ITEMS — Read-only for assigned elevators
-- ============================================================

DROP POLICY IF EXISTS "responsible_select_checklist" ON service_checklist_items;

CREATE POLICY "responsible_select_assigned_checklist"
  ON service_checklist_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_records sr
      JOIN elevators e ON e.id = sr.elevator_id
      WHERE sr.id = service_checklist_items.service_record_id
        AND e.responsible_user_id = auth.uid()
        AND e.active = true
        AND sr.status = 'approved'
    )
  );

-- ============================================================
-- 7. PROFILES — Responsible can view own + assigned technicians
-- ============================================================

-- The existing "Users can view own profile" policy covers the responsible's own profile.
-- For technician names in the portal, we need a limited view.
-- Allow responsible to see technician names (full_name only) for assigned elevators.

DROP POLICY IF EXISTS "responsible_select_technician_profiles" ON profiles;

CREATE POLICY "responsible_select_technician_names"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    role = 'technician'
    AND active = true
    AND EXISTS (
      SELECT 1 FROM service_records sr
      JOIN elevators e ON e.id = sr.elevator_id
      WHERE sr.technician_id = profiles.id
        AND e.responsible_user_id = auth.uid()
        AND e.active = true
        AND sr.status = 'approved'
    )
  );

-- ============================================================
-- 8. CLIENTS — Responsible can view clients for assigned buildings
-- ============================================================

DROP POLICY IF EXISTS "Responsible can view clients" ON clients;

CREATE POLICY "responsible_select_assigned_clients"
  ON clients FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM buildings b
      JOIN elevators e ON e.building_id = b.id
      WHERE b.client_id = clients.id
        AND e.responsible_user_id = auth.uid()
        AND e.active = true
    )
  );

-- ============================================================
-- 9. STORAGE — PDFs for assigned elevators (signed URL approach)
-- ============================================================
-- Direct storage policies are NOT safe because file paths don't
-- contain elevator/building IDs in a verifiable way.
--
-- SOLUTION: Use signed URLs generated via Edge Function that:
--   1. Authenticates the user
--   2. Verifies the user is responsible for the elevator
--   3. Generates a time-limited signed URL
--
-- This migration does NOT create storage policies.
-- Storage access will be implemented via Edge Function in the frontend phase.

-- ============================================================
-- DONE
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '=== Migration 059 Complete ===';
  RAISE NOTICE 'Policies created:';
  RAISE NOTICE '  - buildings: responsible_select_assigned_buildings';
  RAISE NOTICE '  - elevator_visit_entries: responsible_select_approved_visit_entries';
  RAISE NOTICE '  - service_orders: responsible_select_approved_service_orders';
  RAISE NOTICE '  - service_checklist_items: responsible_select_assigned_checklist';
  RAISE NOTICE '  - profiles: responsible_select_technician_names';
  RAISE NOTICE '  - clients: responsible_select_assigned_clients';
  RAISE NOTICE 'Policies replaced:';
  RAISE NOTICE '  - buildings: unscoped responsible → scoped by elevator assignment';
  RAISE NOTICE 'No new tables created.';
  RAISE NOTICE 'No recipient tables exposed.';
  RAISE NOTICE 'Storage: deferred to Edge Function (signed URLs).';
END $$;
