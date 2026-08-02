-- 065: Fix visit duration calculation to use elapsed time instead of accumulated sessions
--
-- Root cause: close_visit RPCs accumulated active_session durations instead of
-- calculating total elapsed time from check_in_at to check_out_at.
-- A visit with check_in 10:42, session 3 min, check_out 15:03 stored 180s instead of 15660s.

-- ============================================================
-- 1. Backfill historical records
-- ============================================================
UPDATE public.elevator_visit_entries
SET duration_seconds = GREATEST(
  FLOOR(EXTRACT(EPOCH FROM (check_out_at - check_in_at)))::INTEGER,
  0
),
    duration_minutes = GREATEST(
  FLOOR(EXTRACT(EPOCH FROM (check_out_at - check_in_at)) / 60.0)::INTEGER,
  0
)
WHERE check_in_at IS NOT NULL
  AND check_out_at IS NOT NULL
  AND check_out_at >= check_in_at;

-- ============================================================
-- 2. Fix complete_service_order_with_visit RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.complete_service_order_with_visit(
  p_order_id UUID,
  p_summary TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_visit RECORD;
  v_total_seconds INTEGER;
BEGIN
  v_user_id := auth.uid();

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_user_id AND role IN ('technician', 'admin') AND active = true
  ) THEN
    RETURN jsonb_build_object('error', 'Acceso no autorizado');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.service_orders so
    WHERE so.id = p_order_id AND so.assigned_technician_id = v_user_id AND so.status = 'in_progress'
  ) THEN
    RETURN jsonb_build_object('error', 'La orden debe estar en progreso para completar');
  END IF;

  SELECT eve.id, eve.status, eve.check_in_at INTO v_visit
  FROM public.elevator_visit_entries eve
  WHERE eve.service_order_id = p_order_id
  LIMIT 1;

  IF v_visit IS NULL THEN
    RAISE EXCEPTION 'No se encontró asiento para la orden %. No se puede completar sin asiento.', p_order_id;
  END IF;

  -- Calculate elapsed time from check_in_at to now (not accumulated sessions)
  v_total_seconds := GREATEST(
    FLOOR(EXTRACT(EPOCH FROM (NOW() - v_visit.check_in_at)))::INTEGER, 0
  );

  UPDATE public.service_orders
  SET status = 'completed', completed_at = NOW(),
      completion_summary = COALESCE(p_summary, completion_summary),
      completed_by = v_user_id, updated_at = NOW()
  WHERE id = p_order_id;

  UPDATE public.service_order_technicians
  SET completed_at = NOW()
  WHERE service_order_id = p_order_id;

  UPDATE public.elevator_visit_entries
  SET status = 'submitted',
      check_out_at = NOW(),
      active_session_started_at = NULL,
      duration_seconds = v_total_seconds,
      duration_minutes = FLOOR(v_total_seconds / 60.0),
      work_performed = COALESCE(p_summary, 'Trabajo completado'),
      updated_at = NOW()
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
-- 3. Fix cancel_service_order_with_visit RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_service_order_with_visit(
  p_order_id UUID,
  p_reason TEXT
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_visit RECORD;
  v_total_seconds INTEGER;
BEGIN
  v_user_id := auth.uid();

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_user_id AND role IN ('technician', 'admin') AND active = true
  ) THEN
    RETURN jsonb_build_object('error', 'Acceso no autorizado');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.service_orders so
    WHERE so.id = p_order_id AND so.assigned_technician_id = v_user_id AND so.status IN ('in_progress', 'submitted')
  ) THEN
    RETURN jsonb_build_object('error', 'La orden no está en un estado cancelable');
  END IF;

  SELECT eve.id, eve.status, eve.check_in_at INTO v_visit
  FROM public.elevator_visit_entries eve
  WHERE eve.service_order_id = p_order_id
  LIMIT 1;

  IF v_visit IS NULL THEN
    RETURN jsonb_build_object('error', 'No se encontró asiento para la orden');
  END IF;

  -- Calculate elapsed time from check_in_at to now
  v_total_seconds := GREATEST(
    FLOOR(EXTRACT(EPOCH FROM (NOW() - v_visit.check_in_at)))::INTEGER, 0
  );

  UPDATE public.service_orders
  SET status = 'cancelled', updated_at = NOW()
  WHERE id = p_order_id;

  UPDATE public.elevator_visit_entries
  SET status = 'cancelled',
      check_out_at = NOW(),
      active_session_started_at = NULL,
      duration_seconds = v_total_seconds,
      duration_minutes = FLOOR(v_total_seconds / 60.0),
      updated_at = NOW()
  WHERE id = v_visit.id;

  INSERT INTO public.service_order_events (service_order_id, event_type, performed_by, details)
  VALUES (p_order_id, 'order_cancelled', v_user_id, jsonb_build_object(
    'reason', p_reason, 'visit_id', v_visit.id
  ));

  RETURN jsonb_build_object('id', v_visit.id, 'status', 'cancelled');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
