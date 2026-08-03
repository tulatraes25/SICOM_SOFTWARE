-- 066: Harden service order technician assignment
-- Validates all inputs before any mutations. Replaces the original from 039.

-- ============================================================
-- 1. DROP OLD SIGNATURE (BOOLEAN variant from 039)
-- ============================================================
DROP FUNCTION IF EXISTS assign_service_order_technicians(UUID, UUID[], BOOLEAN);

-- ============================================================
-- 2. HARDENED assign_service_order_technicians
-- ============================================================
CREATE OR REPLACE FUNCTION public.assign_service_order_technicians(
  p_order_id UUID,
  p_technician_ids UUID[],
  p_is_lead UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_order RECORD;
  v_tid UUID;
  v_seen UUID[];
  v_elevator_active BOOLEAN;
BEGIN
  v_user_id := auth.uid();

  -- 1. Authenticated profile
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = v_user_id AND active = true;

  IF v_role IS NULL THEN
    RETURN jsonb_build_object('error', 'No autenticado');
  END IF;

  -- 2. Only admin or supervisor
  IF v_role NOT IN ('admin', 'supervisor') THEN
    RETURN jsonb_build_object('error', 'Sin permisos para asignar técnicos');
  END IF;

  -- 3. Load order with FOR UPDATE
  SELECT so.* INTO v_order
  FROM public.service_orders so
  WHERE so.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Orden no encontrada');
  END IF;

  -- 4. Status must be ready or assigned
  IF v_order.status NOT IN ('ready', 'assigned') THEN
    RETURN jsonb_build_object('error', 'La orden debe estar lista antes de asignar técnicos.');
  END IF;

  -- 5. Elevator must exist and be active
  IF v_order.elevator_id IS NULL THEN
    RETURN jsonb_build_object('error', 'La orden debe tener un ascensor activo.');
  END IF;

  SELECT active INTO v_elevator_active
  FROM public.elevators
  WHERE id = v_order.elevator_id;

  IF v_elevator_active IS DISTINCT FROM TRUE THEN
    RETURN jsonb_build_object('error', 'La orden debe tener un ascensor activo.');
  END IF;

  -- 6. At least one technician
  IF array_length(p_technician_ids, 1) IS NULL OR array_length(p_technician_ids, 1) < 1 THEN
    RETURN jsonb_build_object('error', 'Debe seleccionar al menos un técnico.');
  END IF;

  -- 7. Reject duplicates
  v_seen := ARRAY[]::UUID[];
  FOREACH v_tid IN ARRAY p_technician_ids LOOP
    IF v_tid = ANY(v_seen) THEN
      RETURN jsonb_build_object('error', 'No se permiten técnicos duplicados.');
    END IF;
    v_seen := array_append(v_seen, v_tid);
  END LOOP;

  -- 8. Validate lead
  IF p_is_lead IS NULL THEN
    RETURN jsonb_build_object('error', 'Debe seleccionar un técnico principal.');
  END IF;

  IF NOT (p_is_lead = ANY(p_technician_ids)) THEN
    RETURN jsonb_build_object('error', 'El técnico principal debe formar parte de la asignación.');
  END IF;

  -- 9. Validate all technicians are active technicians
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = ANY(p_technician_ids)
      AND role = 'technician'
      AND active = true
  ) THEN
    RETURN jsonb_build_object('error', 'Uno o más técnicos no están activos o no tienen el rol Técnico.');
  END IF;

  -- Count valid technicians
  IF (SELECT count(*) FROM public.profiles WHERE id = ANY(p_technician_ids) AND role = 'technician' AND active = true)
     != array_length(p_technician_ids, 1) THEN
    RETURN jsonb_build_object('error', 'Uno o más técnicos no están activos o no tienen el rol Técnico.');
  END IF;

  -- 10. Everything valid — replace atomically
  DELETE FROM public.service_order_technicians WHERE service_order_id = p_order_id;

  FOREACH v_tid IN ARRAY p_technician_ids LOOP
    INSERT INTO public.service_order_technicians (service_order_id, technician_id, assigned_by, is_lead)
    VALUES (p_order_id, v_tid, v_user_id, v_tid = p_is_lead);
  END LOOP;

  -- 11. Update order status
  UPDATE public.service_orders
  SET status = 'assigned',
      assigned_at = COALESCE(assigned_at, NOW()),
      updated_at = NOW()
  WHERE id = p_order_id;

  -- 12. Event
  INSERT INTO public.service_order_events (service_order_id, event_type, performed_by, details)
  VALUES (p_order_id, 'technician_assigned', v_user_id, jsonb_build_object(
    'technician_ids', p_technician_ids,
    'lead_technician_id', p_is_lead,
    'assignment_count', array_length(p_technician_ids, 1)
  ));

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ============================================================
-- 3. PERMISSIONS
-- ============================================================
REVOKE ALL ON FUNCTION public.assign_service_order_technicians(UUID, UUID[], UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_service_order_technicians(UUID, UUID[], UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.assign_service_order_technicians(UUID, UUID[], UUID) TO authenticated;
