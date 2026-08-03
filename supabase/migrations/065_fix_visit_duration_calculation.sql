-- 065: Fix visit duration calculation to use elapsed time instead of accumulated sessions
--
-- Root cause: close_visit RPCs accumulated active_session durations instead of
-- calculating total elapsed time from check_in_at to check_out_at.
-- A visit with check_in 10:42, session 3 min, check_out 15:03 stored 180s instead of 15660s.
--
-- This migration ONLY changes duration calculation.
-- All authorization, concurrency, status, and permission rules are preserved from 058.

-- ============================================================
-- 1. Backfill historical records (only where values differ)
-- ============================================================
WITH calculated AS (
  SELECT
    id,
    GREATEST(
      FLOOR(EXTRACT(EPOCH FROM (check_out_at - check_in_at)))::INTEGER,
      0
    ) AS expected_seconds,
    GREATEST(
      FLOOR(EXTRACT(EPOCH FROM (check_out_at - check_in_at)) / 60.0)::INTEGER,
      0
    ) AS expected_minutes
  FROM public.elevator_visit_entries
  WHERE check_in_at IS NOT NULL
    AND check_out_at IS NOT NULL
    AND check_out_at >= check_in_at
)
UPDATE public.elevator_visit_entries eve
SET duration_seconds = c.expected_seconds,
    duration_minutes = c.expected_minutes
FROM calculated c
WHERE eve.id = c.id
  AND (eve.duration_seconds IS DISTINCT FROM c.expected_seconds
       OR eve.duration_minutes IS DISTINCT FROM c.expected_minutes);

DO $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Migration 065: corrected duration for % rows', v_count;
END $$;

-- ============================================================
-- 2. RECREATE complete_service_order_with_visit
--    Copied from 058, only duration calculation changed.
-- ============================================================
CREATE OR REPLACE FUNCTION public.complete_service_order_with_visit(
  p_order_id UUID,
  p_summary TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_order RECORD;
  v_visit RECORD;
  v_is_lead BOOLEAN;
  v_closed_at TIMESTAMPTZ;
  v_total_seconds INTEGER;
BEGIN
  v_user_id := auth.uid();

  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = v_user_id AND active = true;

  IF v_role IS NULL THEN
    RETURN jsonb_build_object('error', 'No autenticado');
  END IF;

  SELECT so.* INTO v_order
  FROM public.service_orders so
  WHERE so.id = p_order_id
  FOR UPDATE;

  IF v_order IS NULL THEN
    RETURN jsonb_build_object('error', 'Orden no encontrada');
  END IF;

  IF v_role NOT IN ('admin', 'supervisor', 'technician') THEN
    RETURN jsonb_build_object('error', 'Sin permisos para completar órdenes');
  END IF;

  IF v_role = 'technician' THEN
    SELECT is_lead INTO v_is_lead
    FROM public.service_order_technicians
    WHERE service_order_id = p_order_id AND technician_id = v_user_id
    LIMIT 1;
    IF v_is_lead IS NOT TRUE THEN
      RETURN jsonb_build_object('error', 'Solo el técnico principal puede completar');
    END IF;
  END IF;

  IF v_order.status NOT IN ('in_progress', 'visited') THEN
    RETURN jsonb_build_object('error', 'La orden debe estar en progreso para completar');
  END IF;

  SELECT eve.id, eve.status, eve.check_in_at INTO v_visit
  FROM public.elevator_visit_entries eve
  WHERE eve.service_order_id = p_order_id
  LIMIT 1;

  IF v_visit IS NULL THEN
    RAISE EXCEPTION 'No se encontró asiento para la orden %. No se puede completar sin asiento.', p_order_id;
  END IF;

  -- Calculate total elapsed time from check_in_at to close instant
  v_closed_at := NOW();
  v_total_seconds := GREATEST(
    FLOOR(EXTRACT(EPOCH FROM (v_closed_at - v_visit.check_in_at)))::INTEGER, 0
  );

  -- Update order
  UPDATE public.service_orders
  SET status = 'completed', completed_at = v_closed_at,
      completion_summary = COALESCE(p_summary, completion_summary),
      completed_by = v_user_id, updated_at = v_closed_at
  WHERE id = p_order_id;

  UPDATE public.service_order_technicians
  SET completed_at = v_closed_at
  WHERE service_order_id = p_order_id;

  -- Update visit
  UPDATE public.elevator_visit_entries
  SET status = 'submitted',
      check_out_at = v_closed_at,
      active_session_started_at = NULL,
      duration_seconds = v_total_seconds,
      duration_minutes = FLOOR(v_total_seconds / 60.0),
      work_performed = COALESCE(p_summary, 'Trabajo completado'),
      updated_at = v_closed_at
  WHERE id = v_visit.id;

  INSERT INTO public.service_order_events (service_order_id, event_type, performed_by, details)
  VALUES (p_order_id, 'order_completed', v_user_id, jsonb_build_object(
    'summary', p_summary, 'visit_id', v_visit.id,
    'duration_seconds', v_total_seconds
  ));

  RETURN jsonb_build_object('id', v_visit.id, 'status', 'submitted');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ============================================================
-- 3. RECREATE cancel_service_order_with_visit
--    Copied from 058, only duration calculation changed.
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_service_order_with_visit(
  p_order_id UUID,
  p_reason TEXT
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_order RECORD;
  v_visit RECORD;
  v_closed_at TIMESTAMPTZ;
  v_total_seconds INTEGER;
BEGIN
  v_user_id := auth.uid();

  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = v_user_id AND active = true;

  IF v_role IS NULL THEN
    RETURN jsonb_build_object('error', 'No autenticado');
  END IF;

  IF v_role NOT IN ('admin', 'supervisor') THEN
    RETURN jsonb_build_object('error', 'Solo admin o supervisor pueden cancelar');
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RETURN jsonb_build_object('error', 'El motivo de cancelación es obligatorio');
  END IF;

  SELECT so.* INTO v_order
  FROM public.service_orders so
  WHERE so.id = p_order_id
  FOR UPDATE;

  IF v_order IS NULL THEN
    RETURN jsonb_build_object('error', 'Orden no encontrada');
  END IF;

  IF v_order.status IN ('approved', 'cancelled') THEN
    RETURN jsonb_build_object('error', 'No se puede cancelar una orden ' || v_order.status);
  END IF;

  UPDATE public.service_orders
  SET status = 'cancelled', cancellation_reason = p_reason, updated_at = NOW()
  WHERE id = p_order_id;

  -- Close visit if exists
  SELECT eve.id, eve.check_in_at, eve.check_out_at INTO v_visit
  FROM public.elevator_visit_entries eve
  WHERE eve.service_order_id = p_order_id
  LIMIT 1;

  IF v_visit IS NOT NULL THEN
    -- Use existing check_out_at if present, otherwise NOW()
    v_closed_at := COALESCE(v_visit.check_out_at, NOW());
    v_total_seconds := GREATEST(
      FLOOR(EXTRACT(EPOCH FROM (v_closed_at - v_visit.check_in_at)))::INTEGER, 0
    );

    UPDATE public.elevator_visit_entries
    SET status = 'cancelled',
        cancellation_reason = p_reason,
        check_out_at = v_closed_at,
        active_session_started_at = NULL,
        duration_seconds = v_total_seconds,
        duration_minutes = FLOOR(v_total_seconds / 60.0),
        updated_at = NOW()
    WHERE id = v_visit.id;
  END IF;

  INSERT INTO public.service_order_events (service_order_id, event_type, performed_by, details)
  VALUES (p_order_id, 'order_cancelled', v_user_id, jsonb_build_object(
    'reason', p_reason, 'visit_id', v_visit.id
  ));

  RETURN jsonb_build_object('id', COALESCE(v_visit.id, p_order_id), 'status', 'cancelled');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ============================================================
-- 4. PERMISSIONS (preserved from 058)
-- ============================================================
REVOKE ALL ON FUNCTION public.complete_service_order_with_visit(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_service_order_with_visit(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.complete_service_order_with_visit(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_service_order_with_visit(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_service_order_with_visit(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_service_order_with_visit(UUID, TEXT) TO authenticated;
