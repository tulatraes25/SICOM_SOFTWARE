-- 058: Track active visit sessions and fix date display
-- Adds session tracking for accumulated work time and proper date handling.

-- ============================================================
-- 1. ADD SESSION TRACKING COLUMNS (idempotent)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'elevator_visit_entries' AND column_name = 'active_session_started_at'
  ) THEN
    ALTER TABLE public.elevator_visit_entries ADD COLUMN active_session_started_at TIMESTAMPTZ;
    RAISE NOTICE 'Added active_session_started_at';
  ELSE
    RAISE NOTICE 'active_session_started_at already exists';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'elevator_visit_entries' AND column_name = 'duration_seconds'
  ) THEN
    ALTER TABLE public.elevator_visit_entries ADD COLUMN duration_seconds INTEGER NOT NULL DEFAULT 0;
    RAISE NOTICE 'Added duration_seconds';
  ELSE
    RAISE NOTICE 'duration_seconds already exists';
  END IF;
END $$;

-- ============================================================
-- 2. BACKFILL EXISTING CLOSED VISITS
-- ============================================================
DO $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  UPDATE public.elevator_visit_entries
  SET duration_seconds = GREATEST(
    FLOOR(EXTRACT(EPOCH FROM (check_out_at - check_in_at)))::INTEGER,
    0
  )
  WHERE check_in_at IS NOT NULL
    AND check_out_at IS NOT NULL
    AND duration_seconds = 0;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled duration_seconds for % closed visits', v_count;
END $$;

-- ============================================================
-- 3. RECREATE start_service_order_with_visit (session tracking)
-- ============================================================
CREATE OR REPLACE FUNCTION public.start_service_order_with_visit(
  p_order_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_order RECORD;
  v_visit RECORD;
  v_lead_tech_id UUID;
  v_next_number INTEGER;
  v_entry_id UUID;
  v_entry_type TEXT;
  v_elevator_id UUID;
  v_is_lead BOOLEAN;
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
    RETURN jsonb_build_object('error', 'Sin permisos para iniciar órdenes');
  END IF;

  IF v_role = 'technician' THEN
    SELECT is_lead INTO v_is_lead
    FROM public.service_order_technicians
    WHERE service_order_id = p_order_id AND technician_id = v_user_id
    LIMIT 1;
    IF v_is_lead IS NULL THEN
      RETURN jsonb_build_object('error', 'No está asignado a esta orden');
    END IF;
  END IF;

  v_elevator_id := v_order.elevator_id;
  IF v_elevator_id IS NULL THEN
    RETURN jsonb_build_object('error', 'La orden no tiene ascensor asignado');
  END IF;

  SELECT technician_id INTO v_lead_tech_id
  FROM public.service_order_technicians
  WHERE service_order_id = p_order_id AND is_lead = true
  LIMIT 1;

  -- Idempotent: in_progress with existing visit
  IF v_order.status = 'in_progress' THEN
    SELECT eve.id, eve.entry_number, eve.status INTO v_visit
    FROM public.elevator_visit_entries eve
    WHERE eve.service_order_id = p_order_id
    LIMIT 1;
    IF v_visit IS NOT NULL THEN
      RETURN jsonb_build_object(
        'id', v_visit.id, 'entry_number', v_visit.entry_number,
        'status', v_visit.status, 'already_existed', true
      );
    END IF;
  END IF;

  IF v_order.status NOT IN ('assigned', 'changes_requested', 'in_progress') THEN
    RETURN jsonb_build_object('error', 'Estado de orden no válido para iniciar: ' || v_order.status);
  END IF;

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

  -- Resume: existing visit (changes_requested)
  SELECT eve.id, eve.entry_number, eve.status INTO v_visit
  FROM public.elevator_visit_entries eve
  WHERE eve.service_order_id = p_order_id
  LIMIT 1;

  IF v_visit IS NOT NULL THEN
    UPDATE public.elevator_visit_entries
    SET status = 'in_progress',
        active_session_started_at = NOW(),
        check_out_at = NULL,
        updated_at = NOW()
    WHERE id = v_visit.id;

    UPDATE public.service_orders
    SET status = 'in_progress', started_at = COALESCE(started_at, NOW()), updated_at = NOW()
    WHERE id = p_order_id;

    UPDATE public.service_order_technicians
    SET started_at = COALESCE(started_at, NOW())
    WHERE service_order_id = p_order_id AND is_lead = true;

    INSERT INTO public.service_order_events (service_order_id, event_type, performed_by, details)
    VALUES (p_order_id, 'order_reopened', v_user_id, jsonb_build_object(
      'resume', true, 'visit_id', v_visit.id
    ));

    RETURN jsonb_build_object(
      'id', v_visit.id, 'entry_number', v_visit.entry_number,
      'status', 'in_progress', 'already_existed', true
    );
  END IF;

  -- New visit: atomic numbering
  INSERT INTO public.elevator_visit_numbering (elevator_id, next_entry_number)
  VALUES (v_elevator_id, 1)
  ON CONFLICT (elevator_id) DO NOTHING;

  UPDATE public.elevator_visit_numbering
  SET next_entry_number = next_entry_number + 1, updated_at = NOW()
  WHERE elevator_id = v_elevator_id
  RETURNING next_entry_number - 1 INTO v_next_number;

  v_entry_id := gen_random_uuid();
  INSERT INTO public.elevator_visit_entries (
    id, elevator_id, service_order_id, service_case_id,
    entry_number, visit_date, registered_at,
    entry_type, origin_type, title, description,
    technician_id, registered_by, status,
    check_in_at, active_session_started_at,
    duration_seconds, duration_minutes
  ) VALUES (
    v_entry_id, v_elevator_id, p_order_id, v_order.service_case_id,
    v_next_number, CURRENT_DATE, NOW(),
    v_entry_type, 'service_order',
    COALESCE(v_order.subject, 'Orden de servicio'),
    COALESCE(v_order.work_requested, 'Trabajo solicitado'),
    v_lead_tech_id, v_user_id, 'in_progress',
    NOW(), NOW(), 0, 0
  );

  UPDATE public.service_orders
  SET status = 'in_progress', started_at = NOW(), updated_at = NOW()
  WHERE id = p_order_id;

  UPDATE public.service_order_technicians
  SET started_at = NOW()
  WHERE service_order_id = p_order_id AND is_lead = true;

  INSERT INTO public.service_order_events (service_order_id, event_type, performed_by, details)
  VALUES (p_order_id, 'order_started', v_user_id, jsonb_build_object(
    'visit_id', v_entry_id, 'entry_number', v_next_number
  ));

  INSERT INTO public.service_order_events (service_order_id, event_type, performed_by, details)
  VALUES (p_order_id, 'visit_registered', v_user_id, jsonb_build_object(
    'visit_id', v_entry_id, 'entry_number', v_next_number
  ));

  RETURN jsonb_build_object(
    'id', v_entry_id, 'entry_number', v_next_number,
    'status', 'in_progress', 'already_existed', false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ============================================================
-- 4. RECREATE complete_service_order_with_visit (session duration)
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
  v_session_start TIMESTAMPTZ;
  v_session_seconds INTEGER;
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

  SELECT eve.id, eve.status, eve.check_in_at,
         eve.duration_seconds, eve.active_session_started_at
  INTO v_visit
  FROM public.elevator_visit_entries eve
  WHERE eve.service_order_id = p_order_id
  LIMIT 1;

  IF v_visit IS NULL THEN
    RAISE EXCEPTION 'No se encontró asiento para la orden %. No se puede completar sin asiento.', p_order_id;
  END IF;

  -- Calculate session duration
  v_session_start := COALESCE(v_visit.active_session_started_at, v_visit.check_in_at);
  v_session_seconds := GREATEST(
    FLOOR(EXTRACT(EPOCH FROM (NOW() - v_session_start)))::INTEGER, 0
  );
  v_total_seconds := COALESCE(v_visit.duration_seconds, 0) + v_session_seconds;

  -- Update order
  UPDATE public.service_orders
  SET status = 'completed', completed_at = NOW(),
      completion_summary = COALESCE(p_summary, completion_summary),
      completed_by = v_user_id, updated_at = NOW()
  WHERE id = p_order_id;

  UPDATE public.service_order_technicians
  SET completed_at = NOW()
  WHERE service_order_id = p_order_id;

  -- Update visit with accumulated duration
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
-- 5. RECREATE cancel_service_order_with_visit (close active session)
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
  v_session_start TIMESTAMPTZ;
  v_session_seconds INTEGER;
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

  -- Close active session if visit exists
  SELECT eve.id, eve.check_in_at, eve.duration_seconds, eve.active_session_started_at
  INTO v_visit
  FROM public.elevator_visit_entries eve
  WHERE eve.service_order_id = p_order_id
  LIMIT 1;

  IF v_visit IS NOT NULL THEN
    v_session_start := COALESCE(v_visit.active_session_started_at, v_visit.check_in_at);
    v_session_seconds := GREATEST(
      FLOOR(EXTRACT(EPOCH FROM (NOW() - v_session_start)))::INTEGER, 0
    );
    v_total_seconds := COALESCE(v_visit.duration_seconds, 0) + v_session_seconds;

    UPDATE public.elevator_visit_entries
    SET status = 'cancelled',
        cancellation_reason = p_reason,
        check_out_at = COALESCE(check_out_at, NOW()),
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
-- 6. PERMISSIONS
-- ============================================================
REVOKE ALL ON FUNCTION public.start_service_order_with_visit(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_service_order_with_visit(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.start_service_order_with_visit(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.complete_service_order_with_visit(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_service_order_with_visit(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.complete_service_order_with_visit(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_service_order_with_visit(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_service_order_with_visit(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_service_order_with_visit(UUID, TEXT) TO authenticated;

DO $$
BEGIN
  RAISE NOTICE 'Migration 058 complete: session tracking enabled';
END $$;
