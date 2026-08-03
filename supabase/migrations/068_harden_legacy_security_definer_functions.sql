-- 068: Harden legacy SECURITY DEFINER functions
-- Adds search_path, tightens REVOKE/GRANT, preserves functional logic.
-- 13 functions treated. No data changes. No table changes. No trigger changes.

-- ============================================================
-- 1. FIVE FUNCTIONS FOR FRONTEND (keep authenticated)
-- ============================================================

-- 1a. approve_service_record(UUID)
ALTER FUNCTION public.approve_service_record(UUID)
  SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.approve_service_record(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_service_record(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.approve_service_record(UUID) TO authenticated;

-- 1b. reject_service_record(UUID, TEXT)
ALTER FUNCTION public.reject_service_record(UUID, TEXT)
  SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.reject_service_record(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_service_record(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.reject_service_record(UUID, TEXT) TO authenticated;

-- 1c. save_review_report(UUID, TEXT, TEXT)
ALTER FUNCTION public.save_review_report(UUID, TEXT, TEXT)
  SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.save_review_report(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_review_report(UUID, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_review_report(UUID, TEXT, TEXT) TO authenticated;

-- 1d. start_service_review(UUID)
ALTER FUNCTION public.start_service_review(UUID)
  SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.start_service_review(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_service_review(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.start_service_review(UUID) TO authenticated;

-- 1e. set_service_photo_report_selection(UUID, BOOLEAN)
-- Already has search_path. Only fix permissions.
REVOKE ALL ON FUNCTION public.set_service_photo_report_selection(UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_service_photo_report_selection(UUID, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_service_photo_report_selection(UUID, BOOLEAN) TO authenticated;

-- ============================================================
-- 2. EIGHT INTERNAL / LEGACY FUNCTIONS (restrict to service_role)
-- ============================================================

-- 2a. create_visit_from_service_order(UUID)
-- Replace uuid_generate_v4() with gen_random_uuid() to avoid search_path issues.
CREATE OR REPLACE FUNCTION public.create_visit_from_service_order(
  p_order_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_lead_tech_id UUID;
  v_next_number INTEGER;
  v_entry_id UUID;
  v_entry_type TEXT;
BEGIN
  SELECT so.*, so.id AS order_id
  INTO v_order
  FROM service_orders so
  WHERE so.id = p_order_id;

  IF v_order IS NULL THEN
    RETURN jsonb_build_object('error', 'Orden no encontrada');
  END IF;

  IF v_order.elevator_id IS NULL THEN
    RETURN jsonb_build_object('error', 'La orden no tiene ascensor asignado');
  END IF;

  IF EXISTS (SELECT 1 FROM elevator_visit_entries WHERE service_order_id = p_order_id) THEN
    RETURN jsonb_build_object('error', 'Ya existe un asiento para esta orden');
  END IF;

  SELECT technician_id INTO v_lead_tech_id
  FROM service_order_technicians
  WHERE service_order_id = p_order_id AND is_lead = true
  LIMIT 1;

  v_entry_type := CASE v_order.order_type
    WHEN 'preventive' THEN 'preventive_maintenance'
    WHEN 'corrective' THEN 'corrective_maintenance'
    WHEN 'emergency' THEN 'emergency'
    WHEN 'inspection' THEN 'inspection'
    WHEN 'claim_response' THEN 'claim_visit'
    WHEN 'budgeted_work' THEN 'scheduled_service'
    WHEN 'modernization' THEN 'other'
    ELSE 'other'
  END;

  SELECT COALESCE(next_entry_number, 1) INTO v_next_number
  FROM elevator_visit_numbering
  WHERE elevator_id = v_order.elevator_id;

  IF v_next_number IS NULL THEN
    v_next_number := 1;
    INSERT INTO elevator_visit_numbering (elevator_id, next_entry_number)
    VALUES (v_order.elevator_id, 2);
  ELSE
    UPDATE elevator_visit_numbering
    SET next_entry_number = next_entry_number + 1, updated_at = NOW()
    WHERE elevator_id = v_order.elevator_id;
  END IF;

  v_entry_id := gen_random_uuid();
  INSERT INTO elevator_visit_entries (
    id, elevator_id, service_order_id, service_case_id,
    entry_number, visit_date, registered_at,
    entry_type, origin_type, title, description,
    technician_id, registered_by, status,
    check_in_at
  ) VALUES (
    v_entry_id, v_order.elevator_id, p_order_id, v_order.service_case_id,
    v_next_number, CURRENT_DATE, NOW(),
    v_entry_type, 'service_order',
    COALESCE(v_order.subject, 'Orden de servicio'),
    COALESCE(v_order.work_requested, 'Trabajo solicitado'),
    v_lead_tech_id,
    COALESCE(v_lead_tech_id, (SELECT id FROM profiles WHERE role = 'admin' AND active = true LIMIT 1)),
    'submitted',
    v_order.started_at
  );

  RETURN jsonb_build_object(
    'id', v_entry_id,
    'entry_number', v_next_number,
    'status', 'submitted'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.create_visit_from_service_order(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_visit_from_service_order(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.create_visit_from_service_order(UUID) FROM authenticated;

-- 2b. get_public_service_history(UUID)
ALTER FUNCTION public.get_public_service_history(UUID)
  SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.get_public_service_history(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_service_history(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.get_public_service_history(UUID) FROM authenticated;

-- 2c. handle_new_user()
-- Trigger function. Only restrict non-service_role access.
ALTER FUNCTION public.handle_new_user()
  SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM authenticated;

-- 2d. increment_services_count(UUID)
ALTER FUNCTION public.increment_services_count(UUID)
  SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.increment_services_count(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_services_count(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.increment_services_count(UUID) FROM authenticated;

-- 2e. is_valid_service_record_id(TEXT)
ALTER FUNCTION public.is_valid_service_record_id(TEXT)
  SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.is_valid_service_record_id(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_valid_service_record_id(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.is_valid_service_record_id(TEXT) FROM authenticated;

-- 2f. update_visit_on_order_approve(UUID)
ALTER FUNCTION public.update_visit_on_order_approve(UUID)
  SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.update_visit_on_order_approve(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_visit_on_order_approve(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.update_visit_on_order_approve(UUID) FROM authenticated;

-- 2g. update_visit_on_order_complete(UUID, TEXT)
ALTER FUNCTION public.update_visit_on_order_complete(UUID, TEXT)
  SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.update_visit_on_order_complete(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_visit_on_order_complete(UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.update_visit_on_order_complete(UUID, TEXT) FROM authenticated;

-- 2h. update_visit_on_order_corrections(UUID, TEXT)
ALTER FUNCTION public.update_visit_on_order_corrections(UUID, TEXT)
  SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.update_visit_on_order_corrections(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_visit_on_order_corrections(UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.update_visit_on_order_corrections(UUID, TEXT) FROM authenticated;

-- ============================================================
-- 3. VERIFICATION BLOCK
-- ============================================================
DO $$
DECLARE
  v_fn TEXT;
  v_ok BOOLEAN := TRUE;
BEGIN
  -- Check all 13 functions exist
  FOR v_fn IN (
    SELECT unnest(ARRAY[
      'approve_service_record',
      'reject_service_record',
      'save_review_report',
      'start_service_review',
      'set_service_photo_report_selection',
      'create_visit_from_service_order',
      'get_public_service_history',
      'handle_new_user',
      'increment_services_count',
      'is_valid_service_record_id',
      'update_visit_on_order_approve',
      'update_visit_on_order_complete',
      'update_visit_on_order_corrections'
    ])
  ) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = v_fn
    ) THEN
      RAISE WARNING 'MISSING FUNCTION: %', v_fn;
      v_ok := FALSE;
    END IF;
  END LOOP;

  -- Check handle_new_user is still a trigger function
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'handle_new_user'
      AND p.prorettype = 'trigger'::regtype
  ) THEN
    RAISE WARNING 'handle_new_user is no longer a trigger function';
    v_ok := FALSE;
  END IF;

  IF v_ok THEN
    RAISE NOTICE 'Migration 068 verification passed: all 13 functions exist, handle_new_user is a trigger';
  ELSE
    RAISE WARNING 'Migration 068 verification found issues';
  END IF;
END $$;
