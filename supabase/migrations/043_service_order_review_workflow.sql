-- 043: Add approved/changes_requested status and review RPCs for service orders

-- ============================================================
-- 1. UPDATE CHECK CONSTRAINT
-- ============================================================

ALTER TABLE public.service_orders
  DROP CONSTRAINT IF EXISTS service_orders_status_check;

ALTER TABLE public.service_orders
  ADD CONSTRAINT service_orders_status_check
  CHECK (status IN (
    'draft','ready','assigned','in_progress','visited',
    'completed','approved','changes_requested','cancelled'
  ));

-- ============================================================
-- 2. ADD REVIEW COLUMNS
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_orders' AND column_name='reviewed_by') THEN
    ALTER TABLE service_orders ADD COLUMN reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_orders' AND column_name='reviewed_at') THEN
    ALTER TABLE service_orders ADD COLUMN reviewed_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_orders' AND column_name='reviewer_notes') THEN
    ALTER TABLE service_orders ADD COLUMN reviewer_notes TEXT;
  END IF;
END $$;

-- ============================================================
-- 3. RPC: approve_service_order
-- ============================================================

DROP FUNCTION IF EXISTS approve_service_order(UUID, TEXT);

CREATE OR REPLACE FUNCTION approve_service_order(
  p_service_order_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_role TEXT; v_order RECORD;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid() AND active = true;
  IF v_role NOT IN ('admin','supervisor') THEN RETURN jsonb_build_object('error','Sin permisos'); END IF;

  SELECT * INTO v_order FROM service_orders WHERE id = p_service_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Orden no encontrada'); END IF;
  IF v_order.status != 'completed' THEN RETURN jsonb_build_object('error','Solo órdenes completadas pueden aprobarse'); END IF;

  UPDATE service_orders SET
    status = 'approved', reviewed_by = auth.uid(), reviewed_at = NOW(),
    reviewer_notes = p_notes, updated_at = NOW()
  WHERE id = p_service_order_id;

  INSERT INTO service_order_events (service_order_id, event_type, performed_by, details)
  VALUES (p_service_order_id, 'order_approved', auth.uid(), jsonb_build_object('notes', p_notes));

  RETURN jsonb_build_object('success', true, 'status', 'approved');
END;
$$;

REVOKE ALL ON FUNCTION approve_service_order(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION approve_service_order(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION approve_service_order(UUID, TEXT) TO authenticated;

-- ============================================================
-- 4. RPC: request_service_order_corrections
-- ============================================================

DROP FUNCTION IF EXISTS request_service_order_corrections(UUID, TEXT);

CREATE OR REPLACE FUNCTION request_service_order_corrections(
  p_service_order_id UUID,
  p_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_role TEXT; v_order RECORD;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid() AND active = true;
  IF v_role NOT IN ('admin','supervisor') THEN RETURN jsonb_build_object('error','Sin permisos'); END IF;

  IF p_notes IS NULL OR TRIM(p_notes) = '' THEN
    RETURN jsonb_build_object('error','Las observaciones son obligatorias');
  END IF;

  SELECT * INTO v_order FROM service_orders WHERE id = p_service_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Orden no encontrada'); END IF;
  IF v_order.status != 'completed' THEN RETURN jsonb_build_object('error','Solo órdenes completadas pueden recibirse observaciones'); END IF;

  UPDATE service_orders SET
    status = 'changes_requested', reviewer_notes = p_notes, updated_at = NOW()
  WHERE id = p_service_order_id;

  INSERT INTO service_order_events (service_order_id, event_type, performed_by, details)
  VALUES (p_service_order_id, 'corrections_requested', auth.uid(), jsonb_build_object('notes', p_notes));

  RETURN jsonb_build_object('success', true, 'status', 'changes_requested');
END;
$$;

REVOKE ALL ON FUNCTION request_service_order_corrections(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION request_service_order_corrections(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION request_service_order_corrections(UUID, TEXT) TO authenticated;

-- ============================================================
-- 5. UPDATE complete_service_order to allow changes_requested → in_progress
-- ============================================================

DROP FUNCTION IF EXISTS start_service_order(UUID);

CREATE OR REPLACE FUNCTION start_service_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_role TEXT; v_order RECORD;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid() AND active = true;
  IF v_role IS NULL THEN RETURN jsonb_build_object('error','No autenticado'); END IF;

  SELECT * INTO v_order FROM service_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Orden no encontrada'); END IF;

  IF v_role = 'technician' AND NOT EXISTS (
    SELECT 1 FROM service_order_technicians WHERE service_order_id = p_order_id AND technician_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('error','No estás asignado a esta orden');
  END IF;

  IF v_order.status NOT IN ('assigned', 'changes_requested') THEN
    RETURN jsonb_build_object('error','Solo órdenes asignadas o con correcciones pueden iniciarse');
  END IF;

  UPDATE service_orders SET status = 'in_progress', started_at = NOW(), updated_at = NOW() WHERE id = p_order_id;
  UPDATE service_order_technicians SET started_at = NOW() WHERE service_order_id = p_order_id AND technician_id = auth.uid();
  INSERT INTO service_order_events (service_order_id, event_type, performed_by) VALUES (p_order_id, 'order_started', auth.uid());
  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION start_service_order(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION start_service_order(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION start_service_order(UUID) TO authenticated;

-- ============================================================
-- DONE
-- ============================================================
