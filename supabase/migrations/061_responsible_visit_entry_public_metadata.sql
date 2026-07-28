-- 061: Expose safe visit case metadata for responsible portal
-- Adds case_number and numbering_mode to get_responsible_visit_entries().
-- No new tables. No new policies. Only modifies the existing RPC.

-- ============================================================
-- 1. DROP AND RECREATE get_responsible_visit_entries()
-- ============================================================

DROP FUNCTION IF EXISTS public.get_responsible_visit_entries(uuid, date, date);

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
  duration_seconds integer,
  case_number integer,
  numbering_mode text
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
    eve.duration_minutes, eve.duration_seconds,
    sc.case_number,
    sc.numbering_mode
  FROM elevator_visit_entries eve
  JOIN elevators e ON e.id = eve.elevator_id
  LEFT JOIN service_cases sc ON sc.id = eve.service_case_id
  WHERE public.is_active_responsible()
    AND eve.status = 'approved'
    AND e.responsible_user_id = auth.uid()
    AND e.active = true
    AND (p_elevator_id IS NULL OR eve.elevator_id = p_elevator_id)
    AND (p_date_from IS NULL OR eve.visit_date >= p_date_from)
    AND (p_date_to IS NULL OR eve.visit_date <= p_date_to)
  ORDER BY eve.visit_date DESC, eve.entry_number DESC;
$$;

-- ============================================================
-- 2. PERMISSIONS
-- ============================================================

REVOKE ALL ON FUNCTION public.get_responsible_visit_entries(uuid, date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_responsible_visit_entries(uuid, date, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_responsible_visit_entries(uuid, date, date) TO authenticated;

-- ============================================================
-- DONE
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '=== Migration 061 Complete ===';
  RAISE NOTICE 'get_responsible_visit_entries() now returns 24 columns:';
  RAISE NOTICE '  + case_number (integer)';
  RAISE NOTICE '  + numbering_mode (text: test or production)';
  RAISE NOTICE 'LEFT JOIN to service_cases for safe metadata.';
END $$;
