-- 055: Make visit book workflow atomic and user-readable
-- 1. Extend status CHECK to include in_progress, changes_requested
-- 2. Fix historical statuses based on real order/maintenance status
-- 3. Make existing RPCs atomic (embed visit book operations)
-- 4. Safe numbering with RETURNING
-- 5. Idempotent create_visit_from_service_order

-- ============================================================
-- 1. EXTEND STATUS CHECK CONSTRAINT
-- ============================================================
DO $$
DECLARE
  v_def TEXT;
BEGIN
  -- Get current constraint definition
  SELECT pg_get_constraintdef(oid) INTO v_def
  FROM pg_constraint
  WHERE conrelid = 'public.elevator_visit_entries'::regclass
    AND conname LIKE '%status%'
  LIMIT 1;

  -- Drop old constraint if it exists
  IF v_def IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.elevator_visit_entries DROP CONSTRAINT IF EXISTS elevator_visit_entries_status_check';
  END IF;

  -- Create new constraint with extended statuses
  ALTER TABLE public.elevator_visit_entries
    ADD CONSTRAINT elevator_visit_entries_status_check
    CHECK (status IN (
      'draft', 'in_progress', 'submitted', 'changes_requested',
      'approved', 'rectified', 'cancelled'
    ));

  RAISE NOTICE 'Status CHECK constraint updated with in_progress and changes_requested';
END $$;

-- ============================================================
-- 2. FIX HISTORICAL STATUSES
-- ============================================================
DO $$
DECLARE
  v_count INTEGER := 0;
  v_rec RECORD;
BEGIN
  -- Orders: approved → approved, completed → submitted, in_progress → in_progress
  FOR v_rec IN
    SELECT eve.id, so.status AS order_status, eve.status AS visit_status
    FROM elevator_visit_entries eve
    JOIN service_orders so ON so.id = eve.service_order_id
    WHERE eve.status != CASE so.status
      WHEN 'approved' THEN 'approved'
      WHEN 'completed' THEN 'submitted'
      WHEN 'in_progress' THEN 'in_progress'
      WHEN 'changes_requested' THEN 'changes_requested'
      ELSE eve.status
    END
  LOOP
    UPDATE elevator_visit_entries
    SET status = CASE v_rec.order_status
      WHEN 'approved' THEN 'approved'
      WHEN 'completed' THEN 'submitted'
      WHEN 'in_progress' THEN 'in_progress'
      WHEN 'changes_requested' THEN 'changes_requested'
      ELSE status
    END,
    reviewed_by = CASE WHEN v_rec.order_status = 'approved' THEN reviewed_by ELSE NULL END,
    reviewed_at = CASE WHEN v_rec.order_status = 'approved' THEN reviewed_at ELSE NULL END,
    updated_at = NOW()
    WHERE id = v_rec.id;
    v_count := v_count + 1;
  END LOOP;

  -- Maintenance: approved → approved
  FOR v_rec IN
    SELECT eve.id, sr.status AS record_status, eve.status AS visit_status
    FROM elevator_visit_entries eve
    JOIN service_records sr ON sr.id = eve.service_record_id
    WHERE sr.status = 'approved' AND eve.status != 'approved'
  LOOP
    UPDATE elevator_visit_entries
    SET status = 'approved', updated_at = NOW()
    WHERE id = v_rec.id;
    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'Fixed % historical statuses', v_count;
END $$;

-- ============================================================
-- 3. UNIQUE INDEX ON service_record_id
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uq_visit_entry_per_service_record'
  ) THEN
    CREATE UNIQUE INDEX uq_visit_entry_per_service_record
      ON elevator_visit_entries(service_record_id)
      WHERE service_record_id IS NOT NULL;
    RAISE NOTICE 'Created unique index on service_record_id';
  ELSE
    RAISE NOTICE 'Unique index on service_record_id already exists';
  END IF;
END $$;

-- ============================================================
-- 4. ATOMIC RPC: start_service_order_with_visit
-- ============================================================
CREATE OR REPLACE FUNCTION public.start_service_order_with_visit(
  p_order_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_lead_tech_id UUID;
  v_next_number INTEGER;
  v_entry_id UUID;
  v_entry_type TEXT;
  v_elevator_id UUID;
BEGIN
  -- 1. Validate and get order
  SELECT so.id, so.elevator_id, so.order_type, so.service_case_id,
         so.subject, so.work_requested, so.status
  INTO v_order
  FROM service_orders so WHERE so.id = p_order_id;

  IF v_order IS NULL THEN
    RETURN jsonb_build_object('error', 'Orden no encontrada');
  END IF;

  IF v_order.status != 'assigned' THEN
    RETURN jsonb_build_object('error', 'La orden debe estar asignada para iniciar');
  END IF;

  v_elevator_id := v_order.elevator_id;

  -- 2. Update service order
  UPDATE service_orders
  SET status = 'in_progress', started_at = NOW(), updated_at = NOW()
  WHERE id = p_order_id;

  UPDATE service_order_technicians
  SET started_at = NOW()
  WHERE service_order_id = p_order_id AND is_lead = true;

  -- 3. Create visit entry (idempotent)
  IF EXISTS (SELECT 1 FROM elevator_visit_entries WHERE service_order_id = p_order_id) THEN
    -- Already exists, return it
    SELECT eve.id INTO v_entry_id
    FROM elevator_visit_entries eve WHERE eve.service_order_id = p_order_id LIMIT 1;

    RETURN jsonb_build_object(
      'id', v_entry_id,
      'entry_number', (SELECT entry_number FROM elevator_visit_entries WHERE id = v_entry_id),
      'status', (SELECT status FROM elevator_visit_entries WHERE id = v_entry_id),
      'already_existed', true
    );
  END IF;

  IF v_elevator_id IS NULL THEN
    RETURN jsonb_build_object('error', 'La orden no tiene ascensor asignado');
  END IF;

  -- Get lead technician
  SELECT technician_id INTO v_lead_tech_id
  FROM service_order_technicians
  WHERE service_order_id = p_order_id AND is_lead = true
  LIMIT 1;

  -- Map order_type to entry_type
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

  -- Atomic numbering
  INSERT INTO elevator_visit_numbering (elevator_id, next_entry_number)
  VALUES (v_elevator_id, 2)
  ON CONFLICT (elevator_id) DO NOTHING;

  UPDATE elevator_visit_numbering
  SET next_entry_number = next_entry_number + 1, updated_at = NOW()
  WHERE elevator_id = v_elevator_id
  RETURNING next_entry_number - 1 INTO v_next_number;

  -- Create visit entry
  v_entry_id := uuid_generate_v4();
  INSERT INTO elevator_visit_entries (
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
    COALESCE(v_lead_tech_id, (SELECT id FROM profiles WHERE role = 'admin' AND active = true LIMIT 1)),
    'in_progress',
    (SELECT started_at FROM service_orders WHERE id = p_order_id)
  );

  RETURN jsonb_build_object(
    'id', v_entry_id,
    'entry_number', v_next_number,
    'status', 'in_progress',
    'already_existed', false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 5. ATOMIC RPC: complete_service_order_with_visit
-- ============================================================
CREATE OR REPLACE FUNCTION public.complete_service_order_with_visit(
  p_order_id UUID,
  p_summary TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_visit RECORD;
  v_order RECORD;
BEGIN
  -- 1. Update service order
  UPDATE service_orders
  SET status = 'completed', completed_at = NOW(),
      completion_summary = COALESCE(p_summary, completion_summary),
      completed_by = auth.uid(), updated_at = NOW()
  WHERE id = p_order_id
  RETURNING completed_at INTO v_order;

  UPDATE service_order_technicians
  SET completed_at = NOW()
  WHERE service_order_id = p_order_id;

  -- 2. Update visit entry
  SELECT eve.id, eve.status, eve.check_in_at INTO v_visit
  FROM elevator_visit_entries eve
  WHERE eve.service_order_id = p_order_id
  LIMIT 1;

  IF v_visit IS NULL THEN
    RETURN jsonb_build_object('error', 'No se encontró asiento para esta orden');
  END IF;

  UPDATE elevator_visit_entries
  SET
    status = 'submitted',
    check_out_at = COALESCE(v_order.completed_at, NOW()),
    work_performed = COALESCE(p_summary, 'Trabajo completado'),
    duration_minutes = CASE
      WHEN v_visit.check_in_at IS NOT NULL AND v_order.completed_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (v_order.completed_at - v_visit.check_in_at))::INTEGER / 60
      WHEN v_visit.check_in_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (NOW() - v_visit.check_in_at))::INTEGER / 60
      ELSE NULL
    END,
    updated_at = NOW()
  WHERE id = v_visit.id;

  RETURN jsonb_build_object('id', v_visit.id, 'status', 'submitted');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 6. ATOMIC RPC: approve_service_order_with_visit
-- ============================================================
CREATE OR REPLACE FUNCTION public.approve_service_order_with_visit(
  p_service_order_id UUID,
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_visit RECORD;
BEGIN
  -- 1. Update service order
  UPDATE service_orders
  SET status = 'approved', reviewed_by = auth.uid(),
      reviewed_at = NOW(), reviewer_notes = p_notes, updated_at = NOW()
  WHERE id = p_service_order_id;

  -- 2. Update visit entry
  SELECT eve.id INTO v_visit
  FROM elevator_visit_entries eve
  WHERE eve.service_order_id = p_service_order_id
  LIMIT 1;

  IF v_visit IS NULL THEN
    RETURN jsonb_build_object('error', 'No se encontró asiento para esta orden');
  END IF;

  UPDATE elevator_visit_entries
  SET status = 'approved', reviewed_by = auth.uid(),
      reviewed_at = NOW(), updated_at = NOW()
  WHERE id = v_visit.id;

  RETURN jsonb_build_object('id', v_visit.id, 'status', 'approved');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 7. ATOMIC RPC: request_order_corrections_with_visit
-- ============================================================
CREATE OR REPLACE FUNCTION public.request_order_corrections_with_visit(
  p_service_order_id UUID,
  p_notes TEXT
) RETURNS JSONB AS $$
DECLARE
  v_visit RECORD;
BEGIN
  -- 1. Update service order
  UPDATE service_orders
  SET status = 'changes_requested', reviewer_notes = p_notes, updated_at = NOW()
  WHERE id = p_service_order_id;

  -- 2. Update visit entry
  SELECT eve.id INTO v_visit
  FROM elevator_visit_entries eve
  WHERE eve.service_order_id = p_service_order_id
  LIMIT 1;

  IF v_visit IS NULL THEN
    RETURN jsonb_build_object('error', 'No se encontró asiento para esta orden');
  END IF;

  UPDATE elevator_visit_entries
  SET status = 'changes_requested',
      observations = COALESCE(observations, '') || E'\n--- Correcciones solicitadas ---\n' || p_notes,
      updated_at = NOW()
  WHERE id = v_visit.id;

  RETURN jsonb_build_object('id', v_visit.id, 'status', 'changes_requested');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 8. ATOMIC RPC: cancel_service_order_with_visit
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_service_order_with_visit(
  p_order_id UUID,
  p_reason TEXT
) RETURNS JSONB AS $$
DECLARE
  v_visit RECORD;
BEGIN
  -- 1. Update service order
  UPDATE service_orders
  SET status = 'cancelled', cancellation_reason = p_reason, updated_at = NOW()
  WHERE id = p_order_id;

  -- 2. Update visit entry
  SELECT eve.id INTO v_visit
  FROM elevator_visit_entries eve
  WHERE eve.service_order_id = p_order_id
  LIMIT 1;

  IF v_visit IS NOT NULL THEN
    UPDATE elevator_visit_entries
    SET status = 'cancelled', cancellation_reason = p_reason, updated_at = NOW()
    WHERE id = v_visit.id;
  END IF;

  RETURN jsonb_build_object('id', COALESCE(v_visit.id, p_order_id), 'status', 'cancelled');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 9. GRANTS
-- ============================================================
GRANT EXECUTE ON FUNCTION public.start_service_order_with_visit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_service_order_with_visit(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_service_order_with_visit(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_order_corrections_with_visit(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_service_order_with_visit(UUID, TEXT) TO authenticated;

-- ============================================================
-- DONE
-- ============================================================
