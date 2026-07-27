-- 054: Finalize visit book workflow
-- 1. Add time tracking columns
-- 2. Fix historical entries with real data
-- 3. Create auto-creation RPCs for service orders
-- 4. Fix per-elevator numbering

-- ============================================================
-- 1. ADD TIME TRACKING COLUMNS
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'elevator_visit_entries' AND column_name = 'check_in_at'
  ) THEN
    ALTER TABLE elevator_visit_entries ADD COLUMN check_in_at TIMESTAMPTZ;
    ALTER TABLE elevator_visit_entries ADD COLUMN check_out_at TIMESTAMPTZ;
    ALTER TABLE elevator_visit_entries ADD COLUMN duration_minutes INTEGER;
    RAISE NOTICE 'Added time tracking columns';
  ELSE
    RAISE NOTICE 'Time tracking columns already exist';
  END IF;
END $$;

-- ============================================================
-- 2. FIX HISTORICAL ENTRIES — REAL DATA FROM SERVICE ORDERS
-- ============================================================
DO $$
DECLARE
  v_count INTEGER := 0;
  v_rec RECORD;
BEGIN
  FOR v_rec IN
    SELECT eve.id, so.id AS order_id, so.subject, so.work_requested,
           so.completion_summary, so.started_at, so.completed_at,
           so.order_type, so.priority, so.elevator_id
    FROM elevator_visit_entries eve
    JOIN service_orders so ON so.id = eve.service_order_id
  LOOP
    UPDATE elevator_visit_entries
    SET
      title = COALESCE(v_rec.subject, 'Orden de servicio'),
      description = COALESCE(v_rec.work_requested, 'Sin descripción'),
      work_performed = COALESCE(v_rec.completion_summary, 'Trabajo completado'),
      entry_type = CASE v_rec.order_type
        WHEN 'preventive' THEN 'preventive_maintenance'::text
        WHEN 'corrective' THEN 'corrective_maintenance'::text
        WHEN 'emergency' THEN 'emergency'::text
        WHEN 'inspection' THEN 'inspection'::text
        WHEN 'claim_response' THEN 'claim_visit'::text
        WHEN 'budgeted_work' THEN 'scheduled_service'::text
        WHEN 'modernization' THEN 'other'::text
        ELSE 'other'::text
      END,
      origin_type = 'service_order',
      check_in_at = v_rec.started_at,
      check_out_at = v_rec.completed_at,
      duration_minutes = CASE
        WHEN v_rec.started_at IS NOT NULL AND v_rec.completed_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (v_rec.completed_at - v_rec.started_at))::INTEGER / 60
        ELSE NULL
      END,
      operational_status = NULL,
      conservation_status = NULL
    WHERE id = v_rec.id;
    v_count := v_count + 1;
  END LOOP;
  RAISE NOTICE 'Updated % entries from service_orders', v_count;
END $$;

-- ============================================================
-- 3. FIX HISTORICAL ENTRIES — REAL DATA FROM MAINTENANCE
-- ============================================================
DO $$
DECLARE
  v_count INTEGER := 0;
  v_rec RECORD;
BEGIN
  FOR v_rec IN
    SELECT eve.id, sr.service_type, sr.observations, sr.result,
           sr.technician_id, sr.service_date
    FROM elevator_visit_entries eve
    JOIN service_records sr ON sr.id = eve.service_record_id
  LOOP
    UPDATE elevator_visit_entries
    SET
      title = CASE v_rec.service_type
        WHEN 'preventivo' THEN 'Mantenimiento preventivo'
        WHEN 'correctivo' THEN 'Mantenimiento correctivo'
        ELSE 'Mantenimiento programado'
      END,
      description = COALESCE(v_rec.observations, 'Sin observaciones'),
      work_performed = COALESCE(v_rec.result, 'Trabajo completado'),
      entry_type = CASE v_rec.service_type
        WHEN 'preventivo' THEN 'preventive_maintenance'::text
        WHEN 'correctivo' THEN 'corrective_maintenance'::text
        ELSE 'scheduled_service'::text
      END,
      origin_type = 'maintenance',
      operational_status = NULL,
      conservation_status = NULL
    WHERE id = v_rec.id;
    v_count := v_count + 1;
  END LOOP;
  RAISE NOTICE 'Updated % entries from maintenance records', v_count;
END $$;

-- ============================================================
-- 4. FIX PER-ELEVATOR NUMBERING
-- ============================================================
DO $$
DECLARE
  v_rec RECORD;
  v_counter RECORD;
  v_new_number INTEGER;
BEGIN
  -- For each elevator that has entries, renumber them chronologically
  FOR v_rec IN
    SELECT DISTINCT elevator_id FROM elevator_visit_entries
  LOOP
    v_new_number := 1;
    FOR v_counter IN
      SELECT id FROM elevator_visit_entries
      WHERE elevator_id = v_rec.elevator_id
      ORDER BY visit_date ASC, created_at ASC, registered_at ASC
    LOOP
      UPDATE elevator_visit_entries
      SET entry_number = v_new_number
      WHERE id = v_counter.id;
      v_new_number := v_new_number + 1;
    END LOOP;

    -- Update the numbering table for this elevator
    INSERT INTO elevator_visit_numbering (elevator_id, next_entry_number, updated_at)
    VALUES (v_rec.elevator_id, v_new_number, NOW())
    ON CONFLICT (elevator_id) DO UPDATE
    SET next_entry_number = GREATEST(elevator_visit_numbering.next_entry_number, v_new_number),
        updated_at = NOW();
  END LOOP;
  RAISE NOTICE 'Fixed per-elevator numbering';
END $$;

-- ============================================================
-- 5. UNIQUE INDEX ON service_order_id (prevent duplicates)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'uq_visit_entry_per_service_order'
  ) THEN
    CREATE UNIQUE INDEX uq_visit_entry_per_service_order
      ON elevator_visit_entries(service_order_id)
      WHERE service_order_id IS NOT NULL;
    RAISE NOTICE 'Created unique index on service_order_id';
  ELSE
    RAISE NOTICE 'Unique index on service_order_id already exists';
  END IF;
END $$;

-- ============================================================
-- 6. RPC: create_visit_from_service_order
-- Called when a service order is started (in_progress)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_visit_from_service_order(
  p_order_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_lead_tech_id UUID;
  v_elevator_id UUID;
  v_next_number INTEGER;
  v_entry_id UUID;
  v_entry_type TEXT;
BEGIN
  -- Get order data
  SELECT so.*, so.id AS order_id
  INTO v_order
  FROM service_orders so
  WHERE so.id = p_order_id;

  IF v_order IS NULL THEN
    RETURN jsonb_build_object('error', 'Orden no encontrada');
  END IF;

  IF v_order.elevator_id IS NULL THEN
    RETURN jsonb_build_object('error', 'La orden no tiene ascensor asignado');
  END IF;

  -- Check if visit already exists
  IF EXISTS (SELECT 1 FROM elevator_visit_entries WHERE service_order_id = p_order_id) THEN
    RETURN jsonb_build_object('error', 'Ya existe un asiento para esta orden');
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

  -- Get next entry number for this elevator
  SELECT COALESCE(next_entry_number, 1) INTO v_next_number
  FROM elevator_visit_numbering
  WHERE elevator_id = v_order.elevator_id;

  IF v_next_number IS NULL THEN
    v_next_number := 1;
    INSERT INTO elevator_visit_numbering (elevator_id, next_entry_number)
    VALUES (v_order.elevator_id, 2);
  ELSE
    UPDATE elevator_visit_numbering
    SET next_entry_number = next_entry_number + 1, updated_at = NOW()
    WHERE elevator_id = v_order.elevator_id;
  END IF;

  -- Create visit entry
  v_entry_id := uuid_generate_v4();
  INSERT INTO elevator_visit_entries (
    id, elevator_id, service_order_id, service_case_id,
    entry_number, visit_date, registered_at,
    entry_type, origin_type, title, description,
    technician_id, registered_by, status,
    check_in_at
  ) VALUES (
    v_entry_id, v_order.elevator_id, p_order_id, v_order.service_case_id,
    v_next_number, CURRENT_DATE, NOW(),
    v_entry_type, 'service_order',
    COALESCE(v_order.subject, 'Orden de servicio'),
    COALESCE(v_order.work_requested, 'Trabajo solicitado'),
    v_lead_tech_id,
    COALESCE(v_lead_tech_id, (SELECT id FROM profiles WHERE role = 'admin' AND active = true LIMIT 1)),
    'submitted',
    v_order.started_at
  );

  -- Update service_order to link visit
  -- (visit is already linked via service_order_id)

  RETURN jsonb_build_object(
    'id', v_entry_id,
    'entry_number', v_next_number,
    'status', 'submitted'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 7. RPC: update_visit_on_order_complete
-- Called when a service order is completed
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_visit_on_order_complete(
  p_order_id UUID,
  p_summary TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_visit RECORD;
  v_order RECORD;
BEGIN
  -- Find the visit entry for this order
  SELECT eve.id, eve.status INTO v_visit
  FROM elevator_visit_entries eve
  WHERE eve.service_order_id = p_order_id
  LIMIT 1;

  IF v_visit IS NULL THEN
    RETURN jsonb_build_object('error', 'No se encontró asiento para esta orden');
  END IF;

  -- Get order data
  SELECT so.completed_at, so.completion_summary INTO v_order
  FROM service_orders so WHERE so.id = p_order_id;

  -- Update the visit entry
  UPDATE elevator_visit_entries
  SET
    check_out_at = COALESCE(v_order.completed_at, NOW()),
    work_performed = COALESCE(p_summary, v_order.completion_summary, 'Trabajo completado'),
    duration_minutes = CASE
      WHEN check_in_at IS NOT NULL AND v_order.completed_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (v_order.completed_at - check_in_at))::INTEGER / 60
      WHEN check_in_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (NOW() - check_in_at))::INTEGER / 60
      ELSE NULL
    END,
    updated_at = NOW()
  WHERE id = v_visit.id;

  RETURN jsonb_build_object(
    'id', v_visit.id,
    'status', v_visit.status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 8. RPC: update_visit_on_order_approve
-- Called when a service order is approved
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_visit_on_order_approve(
  p_order_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_visit RECORD;
BEGIN
  SELECT eve.id, eve.status INTO v_visit
  FROM elevator_visit_entries eve
  WHERE eve.service_order_id = p_order_id
  LIMIT 1;

  IF v_visit IS NULL THEN
    RETURN jsonb_build_object('error', 'No se encontró asiento para esta orden');
  END IF;

  -- Only approve if currently submitted
  IF v_visit.status != 'submitted' THEN
    RETURN jsonb_build_object('error', 'El asiento no está en estado enviado');
  END IF;

  UPDATE elevator_visit_entries
  SET
    status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    updated_at = NOW()
  WHERE id = v_visit.id;

  RETURN jsonb_build_object(
    'id', v_visit.id,
    'status', 'approved'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 9. RPC: update_visit_on_order_corrections
-- Called when corrections are requested on a service order
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_visit_on_order_corrections(
  p_order_id UUID,
  p_notes TEXT
) RETURNS JSONB AS $$
DECLARE
  v_visit RECORD;
BEGIN
  SELECT eve.id, eve.status INTO v_visit
  FROM elevator_visit_entries eve
  WHERE eve.service_order_id = p_order_id
  LIMIT 1;

  IF v_visit IS NULL THEN
    RETURN jsonb_build_object('error', 'No se encontró asiento para esta orden');
  END IF;

  UPDATE elevator_visit_entries
  SET
    observations = COALESCE(observations, '') || E'\n--- Correcciones solicitadas ---\n' || p_notes,
    updated_at = NOW()
  WHERE id = v_visit.id;

  RETURN jsonb_build_object(
    'id', v_visit.id,
    'status', v_visit.status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 10. GRANTS
-- ============================================================
GRANT EXECUTE ON FUNCTION public.create_visit_from_service_order(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_visit_on_order_complete(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_visit_on_order_approve(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_visit_on_order_corrections(UUID, TEXT) TO authenticated;

-- ============================================================
-- DONE
-- ============================================================
