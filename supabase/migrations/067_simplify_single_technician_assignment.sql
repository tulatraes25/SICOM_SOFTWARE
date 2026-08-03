-- 067: Simplify service order assignment to single technician
-- Each order gets exactly one technician. Lead/secondary distinction removed.
-- Signature preserved for compatibility.

-- ============================================================
-- 1. SIMPLIFIED assign_service_order_technicians
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
  v_tech_id UUID;
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

  -- 4. Status must be draft, ready or assigned
  IF v_order.status NOT IN ('draft', 'ready', 'assigned') THEN
    RETURN jsonb_build_object('error', 'La orden no se encuentra disponible para asignación.');
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

  -- 6. Exactly one technician
  IF array_length(p_technician_ids, 1) IS NULL OR array_length(p_technician_ids, 1) = 0 THEN
    RETURN jsonb_build_object('error', 'Debe seleccionar un técnico.');
  END IF;

  IF array_length(p_technician_ids, 1) > 1 THEN
    RETURN jsonb_build_object('error', 'Solo puede asignar un técnico por orden.');
  END IF;

  v_tech_id := p_technician_ids[1];

  -- 7. Validate technician is active and has role technician
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_tech_id
      AND role = 'technician'
      AND active = true
  ) THEN
    RETURN jsonb_build_object('error', 'El usuario seleccionado no es un técnico activo.');
  END IF;

  -- 8. Validate p_is_lead compatibility (accept null or matching)
  IF p_is_lead IS NOT NULL AND p_is_lead != v_tech_id THEN
    RETURN jsonb_build_object('error', 'El usuario seleccionado no es un técnico activo.');
  END IF;

  -- 9. Replace atomically
  DELETE FROM public.service_order_technicians WHERE service_order_id = p_order_id;

  INSERT INTO public.service_order_technicians (service_order_id, technician_id, assigned_by, is_lead)
  VALUES (p_order_id, v_tech_id, v_user_id, true);

  -- 10. Update order status
  UPDATE public.service_orders
  SET status = 'assigned',
      assigned_at = COALESCE(assigned_at, NOW()),
      updated_at = NOW()
  WHERE id = p_order_id;

  -- 11. Event
  INSERT INTO public.service_order_events (service_order_id, event_type, performed_by, details)
  VALUES (p_order_id, 'technician_assigned', v_user_id, jsonb_build_object(
    'technician_id', v_tech_id,
    'assigned_by', v_user_id
  ));

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ============================================================
-- 2. PERMISSIONS
-- ============================================================
REVOKE ALL ON FUNCTION public.assign_service_order_technicians(UUID, UUID[], UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_service_order_technicians(UUID, UUID[], UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.assign_service_order_technicians(UUID, UUID[], UUID) TO authenticated;
