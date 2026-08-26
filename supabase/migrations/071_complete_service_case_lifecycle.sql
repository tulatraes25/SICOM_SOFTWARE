-- 071: Complete service case lifecycle
-- Adds preliminary_report origin, edit/update RPCs, status transitions,
-- reopen, reactivate, and expanded event types.
-- Does NOT modify existing data. Does NOT delete anything.

-- ============================================================
-- 1. UPDATE ORIGIN_TYPE CHECK CONSTRAINT
-- ============================================================

ALTER TABLE public.service_cases
  DROP CONSTRAINT IF EXISTS service_cases_origin_type_check;

ALTER TABLE public.service_cases
  ADD CONSTRAINT service_cases_origin_type_check
  CHECK (
    origin_type IN (
      'budget',
      'claim',
      'direct_report',
      'preliminary_report',
      'scheduled_service',
      'service_order',
      'other'
    )
  );

-- ============================================================
-- 2. EXPAND EVENT_TYPE CHECK CONSTRAINT
-- ============================================================

ALTER TABLE public.service_case_events
  DROP CONSTRAINT IF EXISTS service_case_events_event_type_check;

ALTER TABLE public.service_case_events
  ADD CONSTRAINT service_case_events_event_type_check
  CHECK (
    event_type IN (
      'case_created',
      'case_updated',
      'status_changed',
      'assigned',
      'case_unassigned',
      'closed',
      'cancelled',
      'case_reopened',
      'case_reactivated',
      'production_numbering_activated'
    )
  );

-- ============================================================
-- 3. RPC: update_service_case
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_service_case(
  p_case_id UUID,
  p_origin_type TEXT,
  p_client_id UUID DEFAULT NULL,
  p_building_id UUID DEFAULT NULL,
  p_elevator_id UUID DEFAULT NULL,
  p_title TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_case service_cases;
  v_old_origin TEXT;
  v_old_client UUID;
  v_old_building UUID;
  v_old_elevator UUID;
  v_old_title TEXT;
  v_old_description TEXT;
  v_changes JSONB := '{}'::jsonb;
  v_has_changes BOOLEAN := false;
BEGIN
  -- Auth check
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No autenticado');
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_user_id AND active = true;
  IF v_role IS NULL THEN
    RETURN jsonb_build_object('error', 'Perfil no encontrado o inactivo');
  END IF;

  IF v_role NOT IN ('admin', 'supervisor') THEN
    RETURN jsonb_build_object('error', 'Sin permisos para editar expedientes');
  END IF;

  -- Lock and fetch case
  SELECT * INTO v_case FROM service_cases WHERE id = p_case_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'El expediente no fue encontrado');
  END IF;

  -- Validate editable status
  IF v_case.status IN ('closed', 'cancelled') THEN
    RETURN jsonb_build_object('error', 'Los expedientes cerrados o anulados deben reabrirse o reactivarse antes de ser editados');
  END IF;

  IF v_case.status = 'completed' THEN
    -- Only title and description allowed
    IF p_origin_type IS DISTINCT FROM v_case.origin_type
       OR p_client_id IS DISTINCT FROM v_case.client_id
       OR p_building_id IS DISTINCT FROM v_case.building_id
       OR p_elevator_id IS DISTINCT FROM v_case.elevator_id THEN
      RETURN jsonb_build_object('error', 'Para corregir un expediente completado, primero debe volverlo a En curso');
    END IF;
  END IF;

  -- Validate origin
  IF p_origin_type NOT IN ('budget', 'claim', 'direct_report', 'preliminary_report', 'scheduled_service', 'service_order', 'other') THEN
    RETURN jsonb_build_object('error', 'El origen seleccionado no está habilitado');
  END IF;

  -- Validate building belongs to client
  IF p_client_id IS NOT NULL AND p_building_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM buildings WHERE id = p_building_id AND client_id = p_client_id AND active = true
    ) THEN
      RETURN jsonb_build_object('error', 'El edificio no pertenece al cliente seleccionado');
    END IF;
  END IF;

  -- Validate elevator belongs to building
  IF p_building_id IS NOT NULL AND p_elevator_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM elevators WHERE id = p_elevator_id AND building_id = p_building_id AND active = true
    ) THEN
      RETURN jsonb_build_object('error', 'El ascensor no pertenece al edificio seleccionado');
    END IF;
  END IF;

  -- Validate no incompatible linked records when changing elevator
  IF p_elevator_id IS DISTINCT FROM v_case.elevator_id AND p_elevator_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM service_orders
      WHERE service_case_id = p_case_id AND elevator_id IS NOT NULL AND elevator_id != p_elevator_id
    ) THEN
      RETURN jsonb_build_object('error', 'El expediente posee una orden vinculada a otro equipo');
    END IF;
  END IF;

  -- Track changes
  v_old_origin := v_case.origin_type;
  v_old_client := v_case.client_id;
  v_old_building := v_case.building_id;
  v_old_elevator := v_case.elevator_id;
  v_old_title := v_case.title;
  v_old_description := v_case.description;

  IF p_origin_type IS DISTINCT FROM v_case.origin_type THEN
    v_changes := v_changes || jsonb_build_object('origin_type', jsonb_build_object('old', v_case.origin_type, 'new', p_origin_type));
    v_has_changes := true;
  END IF;

  IF p_client_id IS DISTINCT FROM v_case.client_id THEN
    v_changes := v_changes || jsonb_build_object('client_id', jsonb_build_object('old', v_case.client_id, 'new', p_client_id));
    v_has_changes := true;
  END IF;

  IF p_building_id IS DISTINCT FROM v_case.building_id THEN
    v_changes := v_changes || jsonb_build_object('building_id', jsonb_build_object('old', v_case.building_id, 'new', p_building_id));
    v_has_changes := true;
  END IF;

  IF p_elevator_id IS DISTINCT FROM v_case.elevator_id THEN
    v_changes := v_changes || jsonb_build_object('elevator_id', jsonb_build_object('old', v_case.elevator_id, 'new', p_elevator_id));
    v_has_changes := true;
  END IF;

  IF COALESCE(p_title, '') IS DISTINCT FROM COALESCE(v_case.title, '') THEN
    v_changes := v_changes || jsonb_build_object('title', jsonb_build_object('old', v_case.title, 'new', p_title));
    v_has_changes := true;
  END IF;

  IF COALESCE(p_description, '') IS DISTINCT FROM COALESCE(v_case.description, '') THEN
    v_changes := v_changes || jsonb_build_object('description', jsonb_build_object('old', v_case.description, 'new', p_description));
    v_has_changes := true;
  END IF;

  IF NOT v_has_changes THEN
    RETURN jsonb_build_object('success', true, 'message', 'No hubo cambios');
  END IF;

  -- Apply update
  UPDATE service_cases
  SET
    origin_type = p_origin_type,
    client_id = p_client_id,
    building_id = p_building_id,
    elevator_id = p_elevator_id,
    title = p_title,
    description = p_description,
    updated_at = NOW()
  WHERE id = p_case_id
  RETURNING * INTO v_case;

  -- Log event
  INSERT INTO service_case_events (service_case_id, event_type, performed_by, details)
  VALUES (p_case_id, 'case_updated', v_user_id, jsonb_build_object('changes', v_changes));

  -- Audit log
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data)
  VALUES (v_user_id, 'update', 'service_cases', p_case_id, to_jsonb(v_case));

  RETURN jsonb_build_object(
    'success', true,
    'case_number', v_case.case_number,
    'changes', v_changes
  );
END;
$$;

REVOKE ALL ON FUNCTION update_service_case(UUID, TEXT, UUID, UUID, UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION update_service_case(UUID, TEXT, UUID, UUID, UUID, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION update_service_case(UUID, TEXT, UUID, UUID, UUID, TEXT, TEXT) TO authenticated;

-- ============================================================
-- 4. RPC: transition_service_case_status
-- ============================================================

CREATE OR REPLACE FUNCTION public.transition_service_case_status(
  p_case_id UUID,
  p_target_status TEXT,
  p_reason TEXT DEFAULT NULL,
  p_assigned_to UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_case service_cases;
  v_old_status TEXT;
  v_event_type TEXT;
  v_event_details JSONB;
BEGIN
  -- Auth check
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No autenticado');
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_user_id AND active = true;
  IF v_role IS NULL THEN
    RETURN jsonb_build_object('error', 'Perfil no encontrado o inactivo');
  END IF;

  IF v_role NOT IN ('admin', 'supervisor') THEN
    RETURN jsonb_build_object('error', 'Sin permisos para cambiar estado del expediente');
  END IF;

  -- Lock and fetch case
  SELECT * INTO v_case FROM service_cases WHERE id = p_case_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'El expediente no fue encontrado');
  END IF;

  v_old_status := v_case.status;

  -- Validate transition
  CASE v_case.status
    WHEN 'open' THEN
      IF p_target_status NOT IN ('assigned', 'in_progress', 'closed', 'cancelled') THEN
        RETURN jsonb_build_object('error', 'Transición no permitida desde Abierto');
      END IF;
    WHEN 'assigned' THEN
      IF p_target_status NOT IN ('open', 'in_progress', 'closed', 'cancelled') THEN
        RETURN jsonb_build_object('error', 'Transición no permitida desde Asignado');
      END IF;
    WHEN 'in_progress' THEN
      IF p_target_status NOT IN ('assigned', 'completed', 'closed', 'cancelled') THEN
        RETURN jsonb_build_object('error', 'Transición no permitida desde En curso');
      END IF;
    WHEN 'completed' THEN
      IF p_target_status NOT IN ('in_progress', 'closed', 'cancelled') THEN
        RETURN jsonb_build_object('error', 'Transición no permitida desde Completado');
      END IF;
    WHEN 'closed' THEN
      IF p_target_status != 'open' THEN
        RETURN jsonb_build_object('error', 'Un expediente cerrado solo puede reabrirse');
      END IF;
      IF v_role != 'admin' THEN
        RETURN jsonb_build_object('error', 'Solo administradores pueden reabrir expedientes');
      END IF;
      IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
        RETURN jsonb_build_object('error', 'El motivo de reapertura es obligatorio');
      END IF;
    WHEN 'cancelled' THEN
      IF p_target_status != 'open' THEN
        RETURN jsonb_build_object('error', 'Un expediente anulado solo puede reactivarse');
      END IF;
      IF v_role != 'admin' THEN
        RETURN jsonb_build_object('error', 'Solo administradores pueden reactivar expedientes');
      END IF;
      IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
        RETURN jsonb_build_object('error', 'El motivo de reactivación es obligatorio');
      END IF;
    ELSE
      RETURN jsonb_build_object('error', 'Estado actual no reconocido');
  END CASE;

  -- Handle assignment
  IF p_target_status = 'assigned' THEN
    IF p_assigned_to IS NULL THEN
      RETURN jsonb_build_object('error', 'Para asignar se requiere seleccionar un técnico');
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM profiles WHERE id = p_assigned_to AND active = true AND role IN ('technician', 'supervisor')
    ) THEN
      RETURN jsonb_build_object('error', 'El técnico seleccionado no es válido o está inactivo');
    END IF;
  END IF;

  -- Build event details
  v_event_details := jsonb_build_object(
    'old_status', v_old_status,
    'new_status', p_target_status
  );

  IF p_reason IS NOT NULL AND TRIM(p_reason) != '' THEN
    v_event_details := v_event_details || jsonb_build_object('reason', TRIM(p_reason));
  END IF;

  -- Determine event type
  IF v_case.status = 'closed' AND p_target_status = 'open' THEN
    v_event_type := 'case_reopened';
    v_event_details := v_event_details || jsonb_build_object(
      'previous_closed_at', v_case.closed_at
    );
  ELSIF v_case.status = 'cancelled' AND p_target_status = 'open' THEN
    v_event_type := 'case_reactivated';
    v_event_details := v_event_details || jsonb_build_object(
      'previous_cancelled_at', v_case.cancelled_at,
      'previous_cancellation_reason', v_case.cancellation_reason
    );
  ELSE
    v_event_type := 'status_changed';
  END IF;

  -- Apply transition
  UPDATE service_cases
  SET
    status = p_target_status,
    closed_at = CASE WHEN p_target_status = 'closed' THEN NOW()
                     WHEN p_target_status = 'open' AND v_old_status = 'closed' THEN NULL
                     ELSE closed_at END,
    cancelled_at = CASE WHEN p_target_status = 'cancelled' THEN NOW()
                        WHEN p_target_status = 'open' AND v_old_status = 'cancelled' THEN NULL
                        ELSE cancelled_at END,
    cancellation_reason = CASE WHEN p_target_status = 'cancelled' THEN TRIM(p_reason)
                               WHEN p_target_status = 'open' AND v_old_status = 'cancelled' THEN NULL
                               ELSE cancellation_reason END,
    assigned_to = CASE WHEN p_target_status = 'assigned' THEN p_assigned_to
                       WHEN p_target_status = 'open' AND v_old_status = 'assigned' THEN NULL
                       ELSE assigned_to END,
    updated_at = NOW()
  WHERE id = p_case_id
  RETURNING * INTO v_case;

  -- Log event
  INSERT INTO service_case_events (service_case_id, event_type, performed_by, details)
  VALUES (p_case_id, v_event_type, v_user_id, v_event_details);

  -- If assigned, also log assignment event
  IF p_target_status = 'assigned' AND p_assigned_to IS NOT NULL THEN
    INSERT INTO service_case_events (service_case_id, event_type, performed_by, details)
    VALUES (p_case_id, 'assigned', v_user_id, jsonb_build_object(
      'assigned_to', p_assigned_to
    ));
  END IF;

  -- If unassigned (assigned -> open), log unassignment
  IF v_old_status = 'assigned' AND p_target_status = 'open' THEN
    INSERT INTO service_case_events (service_case_id, event_type, performed_by, details)
    VALUES (p_case_id, 'case_unassigned', v_user_id, '{}');
  END IF;

  -- Audit log
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data)
  VALUES (v_user_id, 'status_change', 'service_cases', p_case_id, to_jsonb(v_case));

  RETURN jsonb_build_object(
    'success', true,
    'case_number', v_case.case_number,
    'old_status', v_old_status,
    'new_status', v_case.status
  );
END;
$$;

REVOKE ALL ON FUNCTION transition_service_case_status(UUID, TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION transition_service_case_status(UUID, TEXT, TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION transition_service_case_status(UUID, TEXT, TEXT, UUID) TO authenticated;

-- ============================================================
-- 5. VERIFICATION CHECKS
-- ============================================================

DO $$
BEGIN
  -- Verify constraint admits 'other'
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'service_cases_origin_type_check'
    AND pg_get_constraintdef(oid) LIKE '%other%'
  ) THEN
    RAISE EXCEPTION 'Constraint service_cases_origin_type_check does not admit other';
  END IF;

  -- Verify constraint admits 'preliminary_report'
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'service_cases_origin_type_check'
    AND pg_get_constraintdef(oid) LIKE '%preliminary_report%'
  ) THEN
    RAISE EXCEPTION 'Constraint service_cases_origin_type_check does not admit preliminary_report';
  END IF;

  -- Verify event_type constraint admits new values
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'service_case_events_event_type_check'
    AND pg_get_constraintdef(oid) LIKE '%case_reopened%'
  ) THEN
    RAISE EXCEPTION 'Constraint service_case_events_event_type_check does not admit case_reopened';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'service_case_events_event_type_check'
    AND pg_get_constraintdef(oid) LIKE '%case_reactivated%'
  ) THEN
    RAISE EXCEPTION 'Constraint service_case_events_event_type_check does not admit case_reactivated';
  END IF;

  -- Verify update_service_case exists and has correct security
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'update_service_case'
    AND prosecdef = true
  ) THEN
    RAISE EXCEPTION 'RPC update_service_case missing or not SECURITY DEFINER';
  END IF;

  -- Verify transition_service_case_status exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'transition_service_case_status'
    AND prosecdef = true
  ) THEN
    RAISE EXCEPTION 'RPC transition_service_case_status missing or not SECURITY DEFINER';
  END IF;

  -- Verify anon cannot execute
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_language l ON p.prolang = l.oid
    WHERE p.proname = 'update_service_case'
    AND has_function_privilege('anon', p.oid, 'EXECUTE')
  ) THEN
    RAISE WARNING 'anon can execute update_service_case';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.proname = 'transition_service_case_status'
    AND has_function_privilege('anon', p.oid, 'EXECUTE')
  ) THEN
    RAISE WARNING 'anon can execute transition_service_case_status';
  END IF;

  RAISE NOTICE 'Migration 071 verification passed';
END $$;

-- ============================================================
-- DONE
-- ============================================================
