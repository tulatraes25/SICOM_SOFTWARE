-- 040: Backfill visit book entries from existing approved service orders
-- Creates visit entries for service orders that are already approved

-- ============================================================
-- 1. BACKFILL FROM SERVICE ORDERS
-- ============================================================

DO $$
DECLARE
  v_rec RECORD;
  v_count INTEGER := 0;
  v_fallback_admin_id UUID;
  v_entry_number INTEGER;
BEGIN
  -- Get a fallback admin for registered_by
  SELECT id INTO v_fallback_admin_id FROM profiles WHERE role = 'admin' AND active = true ORDER BY created_at LIMIT 1;
  IF v_fallback_admin_id IS NULL THEN
    RAISE NOTICE 'No admin found, skipping backfill';
    RETURN;
  END IF;

  FOR v_rec IN
    SELECT so.id, so.service_case_id, so.elevator_id, so.completed_at, so.started_at, so.order_date,
           so.client_id, so.building_id,
           sot.technician_id
    FROM service_orders so
    LEFT JOIN service_order_technicians sot ON sot.service_order_id = so.id AND sot.is_lead = true
    WHERE so.status IN ('approved', 'completed')
      AND so.elevator_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM elevator_visit_entries eve
        WHERE eve.service_order_id = so.id
      )
  LOOP
    -- Get next entry number
    INSERT INTO elevator_visit_numbering (elevator_id, next_entry_number)
    VALUES (v_rec.elevator_id, 2) ON CONFLICT (elevator_id) DO NOTHING;

    UPDATE elevator_visit_numbering
    SET next_entry_number = next_entry_number + 1, updated_at = NOW()
    WHERE elevator_id = v_rec.elevator_id
    RETURNING next_entry_number - 1 INTO v_entry_number;

    -- Create visit entry
    INSERT INTO elevator_visit_entries (
      elevator_id, service_case_id, service_order_id,
      entry_number, visit_date, entry_type,
      description, status,
      technician_id, registered_by,
      started_at, created_at
    ) VALUES (
      v_rec.elevator_id, v_rec.service_case_id, v_rec.id,
      v_entry_number, v_rec.order_date, 'service_order_visit',
      'Orden de servicio completada y aprobada',
      'approved',
      v_rec.technician_id, v_fallback_admin_id,
      v_rec.started_at, COALESCE(v_rec.completed_at, NOW())
    );

    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'Backfilled % visit entries from service orders', v_count;
END $$;

-- ============================================================
-- 2. BACKFILL FROM MAINTENANCE RECORDS
-- ============================================================

DO $$
DECLARE
  v_rec RECORD;
  v_count INTEGER := 0;
  v_fallback_admin_id UUID;
  v_entry_number INTEGER;
BEGIN
  SELECT id INTO v_fallback_admin_id FROM profiles WHERE role = 'admin' AND active = true ORDER BY created_at LIMIT 1;
  IF v_fallback_admin_id IS NULL THEN RETURN; END IF;

  FOR v_rec IN
    SELECT sr.id, sr.elevator_id, sr.service_date, sr.service_type, sr.status,
           sr.technician_id, sr.created_at
    FROM service_records sr
    WHERE sr.status = 'approved'
      AND sr.elevator_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM elevator_visit_entries eve
        WHERE eve.service_record_id = sr.id
      )
  LOOP
    INSERT INTO elevator_visit_numbering (elevator_id, next_entry_number)
    VALUES (v_rec.elevator_id, 2) ON CONFLICT (elevator_id) DO NOTHING;

    UPDATE elevator_visit_numbering
    SET next_entry_number = next_entry_number + 1, updated_at = NOW()
    WHERE elevator_id = v_rec.elevator_id
    RETURNING next_entry_number - 1 INTO v_entry_number;

    INSERT INTO elevator_visit_entries (
      elevator_id, entry_number, visit_date, entry_type,
      description, status,
      technician_id, registered_by,
      service_record_id, created_at
    ) VALUES (
      v_rec.elevator_id, v_entry_number, v_rec.service_date,
      CASE v_rec.service_type
        WHEN 'preventivo' THEN 'preventive_maintenance'
        WHEN 'correctivo' THEN 'corrective_maintenance'
        ELSE 'scheduled_service'
      END,
      'Mantenimiento aprobado',
      'approved',
      v_rec.technician_id, v_fallback_admin_id,
      v_rec.id, v_rec.created_at
    );

    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'Backfilled % visit entries from maintenance records', v_count;
END $$;

-- ============================================================
-- 3. BACKFILL FROM SERVICE ORDERS (approved)
-- ============================================================

DO $$
DECLARE
  v_rec RECORD;
  v_count INTEGER := 0;
  v_fallback_admin_id UUID;
  v_entry_number INTEGER;
BEGIN
  SELECT id INTO v_fallback_admin_id FROM profiles WHERE role = 'admin' AND active = true ORDER BY created_at LIMIT 1;
  IF v_fallback_admin_id IS NULL THEN RETURN; END IF;

  FOR v_rec IN
    SELECT so.id, so.elevator_id, so.completed_at, so.started_at, so.order_date,
           sot.technician_id
    FROM service_orders so
    LEFT JOIN service_order_technicians sot ON sot.service_order_id = so.id AND sot.is_lead = true
    WHERE so.status IN ('approved', 'completed')
      AND so.elevator_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM elevator_visit_entries eve WHERE eve.service_order_id = so.id
      )
  LOOP
    INSERT INTO elevator_visit_numbering (elevator_id, next_entry_number)
    VALUES (v_rec.elevator_id, 2) ON CONFLICT (elevator_id) DO NOTHING;

    UPDATE elevator_visit_numbering
    SET next_entry_number = next_entry_number + 1, updated_at = NOW()
    WHERE elevator_id = v_rec.elevator_id
    RETURNING next_entry_number - 1 INTO v_entry_number;

    INSERT INTO elevator_visit_entries (
      elevator_id, service_order_id, entry_number, visit_date, entry_type,
      description, status, technician_id, registered_by, started_at, created_at
    ) VALUES (
      v_rec.elevator_id, v_rec.id, v_entry_number, v_rec.order_date, 'service_order_visit',
      'Orden de servicio aprobada', 'approved',
      v_rec.technician_id, v_fallback_admin_id,
      v_rec.started_at, COALESCE(v_rec.completed_at, NOW())
    );
    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'Backfilled % visit entries from service orders', v_count;
END $$;

-- ============================================================
-- DONE
-- ============================================================
