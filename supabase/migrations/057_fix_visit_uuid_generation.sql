-- 057: Fix uuid generation in start_service_order_with_visit
-- The SECURITY DEFINER + SET search_path = public, pg_temp prevents
-- access to uuid-ossp's uuid_generate_v4(). Use core gen_random_uuid() instead.

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

  -- 12. Create visit entry (using gen_random_uuid instead of uuid_generate_v4)
  v_entry_id := gen_random_uuid();
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

-- Permissions
REVOKE ALL ON FUNCTION public.start_service_order_with_visit(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_service_order_with_visit(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.start_service_order_with_visit(UUID) TO authenticated;
