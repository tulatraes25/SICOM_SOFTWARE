-- 056: Secure and fully atomic visit order workflow
-- Hardens all RPCs with proper security, validation, and event logging.
-- Does NOT modify previous migrations.

-- ============================================================
-- 1. EXTEND event_type CHECK IF NEEDED
-- ============================================================
DO $$
BEGIN
  -- Ensure all needed event types exist in the CHECK
  ALTER TABLE public.service_order_events
    DROP CONSTRAINT IF EXISTS service_order_events_event_type_check;

  ALTER TABLE public.service_order_events
    ADD CONSTRAINT service_order_events_event_type_check
    CHECK (
      event_type IN (
        'order_created', 'marked_ready', 'technician_assigned',
        'technician_removed', 'technician_notified',
        'order_started', 'order_reopened', 'visit_registered',
        'progress_added', 'order_completed', 'order_cancelled',
        'pdf_generated', 'email_sent',
        'corrections_requested', 'order_approved'
      )
    );
  RAISE NOTICE 'event_type CHECK validated';
END $$;

-- ============================================================
-- 2. ATOMIC RPC: start_service_order_with_visit (HARDENED)
-- Accepts: assigned, changes_requested, in_progress (idempotent)
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

  -- 1. Validate user
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = v_user_id AND active = true;

  IF v_role IS NULL THEN
    RETURN jsonb_build_object('error', 'No autenticado');
  END IF;

  -- 2. Load order with lock
  SELECT so.* INTO v_order
  FROM public.service_orders so
  WHERE so.id = p_order_id
  FOR UPDATE;

  IF v_order IS NULL THEN
    RETURN jsonb_build_object('error', 'Orden no encontrada');
  END IF;

  -- 3. Validate role permission
  IF v_role NOT IN ('admin', 'supervisor', 'technician') THEN
    RETURN jsonb_build_object('error', 'Sin permisos para iniciar órdenes');
  END IF;

  -- 4. Validate assignment (technicians must be assigned)
  IF v_role = 'technician' THEN
    SELECT is_lead INTO v_is_lead
    FROM public.service_order_technicians
    WHERE service_order_id = p_order_id AND technician_id = v_user_id
    LIMIT 1;

    IF v_is_lead IS NULL THEN
      RETURN jsonb_build_object('error', 'No está asignado a esta orden');
    END IF;
  END IF;

  -- 5. Validate elevator
  v_elevator_id := v_order.elevator_id;
  IF v_elevator_id IS NULL THEN
    RETURN jsonb_build_object('error', 'La orden no tiene ascensor asignado');
  END IF;

  -- 6. Get lead technician
  SELECT technician_id INTO v_lead_tech_id
  FROM public.service_order_technicians
  WHERE service_order_id = p_order_id AND is_lead = true
  LIMIT 1;

  -- 7. Case: in_progress with existing visit → idempotent return
  IF v_order.status = 'in_progress' THEN
    SELECT eve.id, eve.entry_number, eve.status INTO v_visit
    FROM public.elevator_visit_entries eve
    WHERE eve.service_order_id = p_order_id
    LIMIT 1;

    IF v_visit IS NOT NULL THEN
      RETURN jsonb_build_object(
        'id', v_visit.id,
        'entry_number', v_visit.entry_number,
        'status', v_visit.status,
        'already_existed', true
      );
    END IF;
    -- Fall through to create if no visit exists (shouldn't happen)
  END IF;

  -- 8. Validate status transition
  IF v_order.status NOT IN ('assigned', 'changes_requested', 'in_progress') THEN
    RETURN jsonb_build_object('error', 'Estado de orden no válido para iniciar: ' || v_order.status);
  END IF;

  -- 9. Map order_type to entry_type
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

  -- 10. Check if visit already exists (changes_requested case)
  SELECT eve.id, eve.entry_number, eve.status INTO v_visit
  FROM public.elevator_visit_entries eve
  WHERE eve.service_order_id = p_order_id
  LIMIT 1;

  IF v_visit IS NOT NULL THEN
    -- Resume: update existing visit
    UPDATE public.elevator_visit_entries
    SET status = 'in_progress', updated_at = NOW()
    WHERE id = v_visit.id;

    -- Update order
    UPDATE public.service_orders
    SET status = 'in_progress', started_at = COALESCE(started_at, NOW()), updated_at = NOW()
    WHERE id = p_order_id;

    -- Update technician timestamps
    UPDATE public.service_order_technicians
    SET started_at = COALESCE(started_at, NOW())
    WHERE service_order_id = p_order_id AND is_lead = true;

    -- Event
    INSERT INTO public.service_order_events (service_order_id, event_type, performed_by, details)
    VALUES (p_order_id, 'order_reopened', v_user_id, jsonb_build_object(
      'resume', true, 'visit_id', v_visit.id
    ));

    RETURN jsonb_build_object(
      'id', v_visit.id,
      'entry_number', v_visit.entry_number,
      'status', 'in_progress',
      'already_existed', true
    );
  END IF;

  -- 11. New visit: atomic numbering
  INSERT INTO public.elevator_visit_numbering (elevator_id, next_entry_number)
  VALUES (v_elevator_id, 1)
  ON CONFLICT (elevator_id) DO NOTHING;

  UPDATE public.elevator_visit_numbering
  SET next_entry_number = next_entry_number + 1, updated_at = NOW()
  WHERE elevator_id = v_elevator_id
  RETURNING next_entry_number - 1 INTO v_next_number;

  -- 12. Create visit entry
  v_entry_id := uuid_generate_v4();
  INSERT INTO public.elevator_visit_entries (
    id, elevator_id, service_order_id, service_case_id,
    entry_number, visit_date, registered_at,
    entry_type, origin_type, title, description,
    technician_id, registered_by, status, check_in_at
  ) VALUES (
    v_entry_id, v_elevator_id, p_order_id, v_order.service_case_id,
    v_next_number, CURRENT_DATE, NOW(),
    v_entry_type, 'service_order',
    COALESCE(v_order.subject, 'Orden de servicio'),
    COALESCE(v_order.work_requested, 'Trabajo solicitado'),
    v_lead_tech_id,
    v_user_id,
    'in_progress',
    NOW()
  );

  -- 13. Update order status
  UPDATE public.service_orders
  SET status = 'in_progress', started_at = NOW(), updated_at = NOW()
  WHERE id = p_order_id;

  UPDATE public.service_order_technicians
  SET started_at = NOW()
  WHERE service_order_id = p_order_id AND is_lead = true;

  -- 14. Events
  INSERT INTO public.service_order_events (service_order_id, event_type, performed_by, details)
  VALUES (p_order_id, 'order_started', v_user_id, jsonb_build_object(
    'visit_id', v_entry_id, 'entry_number', v_next_number
  ));

  INSERT INTO public.service_order_events (service_order_id, event_type, performed_by, details)
  VALUES (p_order_id, 'visit_registered', v_user_id, jsonb_build_object(
    'visit_id', v_entry_id, 'entry_number', v_next_number
  ));

  RETURN jsonb_build_object(
    'id', v_entry_id,
    'entry_number', v_next_number,
    'status', 'in_progress',
    'already_existed', false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ============================================================
-- 3. ATOMIC RPC: complete_service_order_with_visit (HARDENED)
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
BEGIN
  v_user_id := auth.uid();

  -- 1. Validate user
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = v_user_id AND active = true;

  IF v_role IS NULL THEN
    RETURN jsonb_build_object('error', 'No autenticado');
  END IF;

  -- 2. Load order with lock
  SELECT so.* INTO v_order
  FROM public.service_orders so
  WHERE so.id = p_order_id
  FOR UPDATE;

  IF v_order IS NULL THEN
    RETURN jsonb_build_object('error', 'Orden no encontrada');
  END IF;

  -- 3. Validate role
  IF v_role NOT IN ('admin', 'supervisor', 'technician') THEN
    RETURN jsonb_build_object('error', 'Sin permisos para completar órdenes');
  END IF;

  -- 4. Validate assignment (technicians must be lead)
  IF v_role = 'technician' THEN
    SELECT is_lead INTO v_is_lead
    FROM public.service_order_technicians
    WHERE service_order_id = p_order_id AND technician_id = v_user_id
    LIMIT 1;

    IF v_is_lead IS NOT TRUE THEN
      RETURN jsonb_build_object('error', 'Solo el técnico principal puede completar');
    END IF;
  END IF;

  -- 5. Validate status
  IF v_order.status NOT IN ('in_progress', 'visited') THEN
    RETURN jsonb_build_object('error', 'La orden debe estar en progreso para completar');
  END IF;

  -- 6. Load visit
  SELECT eve.id, eve.status, eve.check_in_at INTO v_visit
  FROM public.elevator_visit_entries eve
  WHERE eve.service_order_id = p_order_id
  LIMIT 1;

  IF v_visit IS NULL THEN
    RAISE EXCEPTION 'No se encontró asiento para la orden %. No se puede completar sin asiento.', p_order_id;
  END IF;

  -- 7. Update order
  UPDATE public.service_orders
  SET status = 'completed',
      completed_at = NOW(),
      completion_summary = COALESCE(p_summary, completion_summary),
      completed_by = v_user_id,
      updated_at = NOW()
  WHERE id = p_order_id;

  UPDATE public.service_order_technicians
  SET completed_at = NOW()
  WHERE service_order_id = p_order_id;

  -- 8. Update visit
  UPDATE public.elevator_visit_entries
  SET
    status = 'submitted',
    check_out_at = NOW(),
    work_performed = COALESCE(p_summary, 'Trabajo completado'),
    duration_minutes = CASE
      WHEN v_visit.check_in_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (NOW() - v_visit.check_in_at))::INTEGER / 60
      ELSE NULL
    END,
    updated_at = NOW()
  WHERE id = v_visit.id;

  -- 9. Event
  INSERT INTO public.service_order_events (service_order_id, event_type, performed_by, details)
  VALUES (p_order_id, 'order_completed', v_user_id, jsonb_build_object(
    'summary', p_summary, 'visit_id', v_visit.id
  ));

  RETURN jsonb_build_object('id', v_visit.id, 'status', 'submitted');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ============================================================
-- 4. ATOMIC RPC: approve_service_order_with_visit (HARDENED)
-- ============================================================
CREATE OR REPLACE FUNCTION public.approve_service_order_with_visit(
  p_service_order_id UUID,
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_order RECORD;
  v_visit RECORD;
BEGIN
  v_user_id := auth.uid();

  -- 1. Validate user
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = v_user_id AND active = true;

  IF v_role IS NULL THEN
    RETURN jsonb_build_object('error', 'No autenticado');
  END IF;

  -- 2. Validate role
  IF v_role NOT IN ('admin', 'supervisor') THEN
    RETURN jsonb_build_object('error', 'Solo admin o supervisor pueden aprobar');
  END IF;

  -- 3. Load order with lock
  SELECT so.* INTO v_order
  FROM public.service_orders so
  WHERE so.id = p_service_order_id
  FOR UPDATE;

  IF v_order IS NULL THEN
    RETURN jsonb_build_object('error', 'Orden no encontrada');
  END IF;

  -- 4. Validate status
  IF v_order.status != 'completed' THEN
    RETURN jsonb_build_object('error', 'La orden debe estar completada para aprobar');
  END IF;

  -- 5. Load visit
  SELECT eve.id, eve.status INTO v_visit
  FROM public.elevator_visit_entries eve
  WHERE eve.service_order_id = p_service_order_id
  LIMIT 1;

  IF v_visit IS NULL THEN
    RAISE EXCEPTION 'No se encontró asiento para la orden %. No se puede aprobar sin asiento.', p_service_order_id;
  END IF;

  IF v_visit.status != 'submitted' THEN
    RETURN jsonb_build_object('error', 'El asiento debe estar en estado Pendiente de revisión');
  END IF;

  -- 6. Update order
  UPDATE public.service_orders
  SET status = 'approved',
      reviewed_by = v_user_id,
      reviewed_at = NOW(),
      reviewer_notes = p_notes,
      updated_at = NOW()
  WHERE id = p_service_order_id;

  -- 7. Update visit
  UPDATE public.elevator_visit_entries
  SET status = 'approved',
      reviewed_by = v_user_id,
      reviewed_at = NOW(),
      updated_at = NOW()
  WHERE id = v_visit.id;

  -- 8. Event
  INSERT INTO public.service_order_events (service_order_id, event_type, performed_by, details)
  VALUES (p_service_order_id, 'order_approved', v_user_id, jsonb_build_object(
    'notes', p_notes, 'visit_id', v_visit.id
  ));

  RETURN jsonb_build_object('id', v_visit.id, 'status', 'approved');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ============================================================
-- 5. ATOMIC RPC: request_order_corrections_with_visit (HARDENED)
-- ============================================================
CREATE OR REPLACE FUNCTION public.request_order_corrections_with_visit(
  p_service_order_id UUID,
  p_notes TEXT
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_order RECORD;
  v_visit RECORD;
BEGIN
  v_user_id := auth.uid();

  -- 1. Validate user
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = v_user_id AND active = true;

  IF v_role IS NULL THEN
    RETURN jsonb_build_object('error', 'No autenticado');
  END IF;

  -- 2. Validate role
  IF v_role NOT IN ('admin', 'supervisor') THEN
    RETURN jsonb_build_object('error', 'Solo admin o supervisor pueden solicitar correcciones');
  END IF;

  -- 3. Validate notes
  IF p_notes IS NULL OR trim(p_notes) = '' THEN
    RETURN jsonb_build_object('error', 'Las notas son obligatorias');
  END IF;

  -- 4. Load order with lock
  SELECT so.* INTO v_order
  FROM public.service_orders so
  WHERE so.id = p_service_order_id
  FOR UPDATE;

  IF v_order IS NULL THEN
    RETURN jsonb_build_object('error', 'Orden no encontrada');
  END IF;

  -- 5. Validate status
  IF v_order.status != 'completed' THEN
    RETURN jsonb_build_object('error', 'La orden debe estar completada para solicitar correcciones');
  END IF;

  -- 6. Load visit
  SELECT eve.id, eve.status INTO v_visit
  FROM public.elevator_visit_entries eve
  WHERE eve.service_order_id = p_service_order_id
  LIMIT 1;

  IF v_visit IS NULL THEN
    RAISE EXCEPTION 'No se encontró asiento para la orden %. No se pueden solicitar correcciones sin asiento.', p_service_order_id;
  END IF;

  -- 7. Update order
  UPDATE public.service_orders
  SET status = 'changes_requested',
      reviewer_notes = p_notes,
      reviewed_by = v_user_id,
      reviewed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_service_order_id;

  -- 8. Update visit
  UPDATE public.elevator_visit_entries
  SET status = 'changes_requested',
      observations = COALESCE(observations, '') || E'\n--- Correcciones solicitadas ---\n' || p_notes,
      updated_at = NOW()
  WHERE id = v_visit.id;

  -- 9. Event
  INSERT INTO public.service_order_events (service_order_id, event_type, performed_by, details)
  VALUES (p_service_order_id, 'corrections_requested', v_user_id, jsonb_build_object(
    'notes', p_notes, 'visit_id', v_visit.id
  ));

  RETURN jsonb_build_object('id', v_visit.id, 'status', 'changes_requested');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ============================================================
-- 6. ATOMIC RPC: cancel_service_order_with_visit (HARDENED)
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
BEGIN
  v_user_id := auth.uid();

  -- 1. Validate user
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = v_user_id AND active = true;

  IF v_role IS NULL THEN
    RETURN jsonb_build_object('error', 'No autenticado');
  END IF;

  -- 2. Validate role
  IF v_role NOT IN ('admin', 'supervisor') THEN
    RETURN jsonb_build_object('error', 'Solo admin o supervisor pueden cancelar');
  END IF;

  -- 3. Validate reason
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RETURN jsonb_build_object('error', 'El motivo de cancelación es obligatorio');
  END IF;

  -- 4. Load order with lock
  SELECT so.* INTO v_order
  FROM public.service_orders so
  WHERE so.id = p_order_id
  FOR UPDATE;

  IF v_order IS NULL THEN
    RETURN jsonb_build_object('error', 'Orden no encontrada');
  END IF;

  -- 5. Validate status
  IF v_order.status IN ('approved', 'cancelled') THEN
    RETURN jsonb_build_object('error', 'No se puede cancelar una orden ' || v_order.status);
  END IF;

  -- 6. Update order
  UPDATE public.service_orders
  SET status = 'cancelled',
      cancellation_reason = p_reason,
      updated_at = NOW()
  WHERE id = p_order_id;

  -- 7. Update visit if exists
  SELECT eve.id INTO v_visit
  FROM public.elevator_visit_entries eve
  WHERE eve.service_order_id = p_order_id
  LIMIT 1;

  IF v_visit IS NOT NULL THEN
    UPDATE public.elevator_visit_entries
    SET status = 'cancelled',
        cancellation_reason = p_reason,
        updated_at = NOW()
    WHERE id = v_visit.id;
  END IF;

  -- 8. Event
  INSERT INTO public.service_order_events (service_order_id, event_type, performed_by, details)
  VALUES (p_order_id, 'order_cancelled', v_user_id, jsonb_build_object(
    'reason', p_reason, 'visit_id', v_visit.id
  ));

  RETURN jsonb_build_object('id', COALESCE(v_visit.id, p_order_id), 'status', 'cancelled');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ============================================================
-- 7. REVOKE AND GRANTS (exact signatures)
-- ============================================================

-- start_service_order_with_visit(UUID)
REVOKE ALL ON FUNCTION public.start_service_order_with_visit(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_service_order_with_visit(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.start_service_order_with_visit(UUID) TO authenticated;

-- complete_service_order_with_visit(UUID, TEXT)
REVOKE ALL ON FUNCTION public.complete_service_order_with_visit(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_service_order_with_visit(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.complete_service_order_with_visit(UUID, TEXT) TO authenticated;

-- approve_service_order_with_visit(UUID, TEXT)
REVOKE ALL ON FUNCTION public.approve_service_order_with_visit(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_service_order_with_visit(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.approve_service_order_with_visit(UUID, TEXT) TO authenticated;

-- request_order_corrections_with_visit(UUID, TEXT)
REVOKE ALL ON FUNCTION public.request_order_corrections_with_visit(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_order_corrections_with_visit(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_order_corrections_with_visit(UUID, TEXT) TO authenticated;

-- cancel_service_order_with_visit(UUID, TEXT)
REVOKE ALL ON FUNCTION public.cancel_service_order_with_visit(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_service_order_with_visit(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_service_order_with_visit(UUID, TEXT) TO authenticated;

DO $$
BEGIN
  RAISE NOTICE 'REVOKE/GRANT applied to all hardened RPCs';
END $$;

-- ============================================================
-- DONE
-- ============================================================
