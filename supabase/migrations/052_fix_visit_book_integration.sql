-- 052: Fix visit book integration with correct schema
-- Uses actual columns from elevator_visit_entries (no started_at, no completed_at)
-- Uses safe numbering via RPC

-- ============================================================
-- 1. BACKFILL FROM SERVICE ORDERS
-- ============================================================

DO $$
DECLARE
  v_rec RECORD;
  v_count INTEGER := 0;
  v_fallback_admin_id UUID;
  v_result JSONB;
BEGIN
  SELECT id INTO v_fallback_admin_id FROM profiles WHERE role = 'admin' AND active = true ORDER BY created_at LIMIT 1;
  IF v_fallback_admin_id IS NULL THEN
    RAISE NOTICE 'No admin found, skipping backfill';
    RETURN;
  END IF;

  FOR v_rec IN
    SELECT so.id, so.elevator_id, so.service_case_id, so.order_date,
           sot.technician_id
    FROM service_orders so
    LEFT JOIN service_order_technicians sot ON sot.service_order_id = so.id AND sot.is_lead = true
    WHERE so.status IN ('approved', 'completed')
      AND so.elevator_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM elevator_visit_entries eve WHERE eve.service_order_id = so.id
      )
  LOOP
    -- Use the RPC to create visit entry safely
    SELECT * INTO v_result FROM public.create_elevator_visit_entry(
      p_elevator_id => v_rec.elevator_id,
      p_visit_date => v_rec.order_date,
      p_entry_type => 'other',
      p_description => 'Orden de servicio aprobada - backfill',
      p_technician_id => v_rec.technician_id,
      p_service_case_id => v_rec.service_case_id
    );

    -- If RPC failed, log and continue
    IF v_result ? 'error' THEN
      RAISE NOTICE 'Failed to create visit for order %: %', v_rec.id, v_result->>'error';
    ELSE
      -- Update the service_order_id on the created entry
      UPDATE elevator_visit_entries
      SET service_order_id = v_rec.id,
          status = 'approved'
      WHERE id = (v_result->>'id')::UUID;
      v_count := v_count + 1;
    END IF;
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
  v_result JSONB;
BEGIN
  SELECT id INTO v_fallback_admin_id FROM profiles WHERE role = 'admin' AND active = true ORDER BY created_at LIMIT 1;
  IF v_fallback_admin_id IS NULL THEN RETURN; END IF;

  FOR v_rec IN
    SELECT sr.id, sr.elevator_id, sr.service_date, sr.service_type, sr.technician_id
    FROM service_records sr
    WHERE sr.status = 'approved'
      AND sr.elevator_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM elevator_visit_entries eve WHERE eve.service_record_id = sr.id
      )
  LOOP
    SELECT * INTO v_result FROM public.create_elevator_visit_entry(
      p_elevator_id => v_rec.elevator_id,
      p_visit_date => v_rec.service_date,
      p_entry_type => CASE v_rec.service_type
        WHEN 'preventivo' THEN 'preventive_maintenance'
        WHEN 'correctivo' THEN 'corrective_maintenance'
        ELSE 'scheduled_service'
      END,
      p_description => 'Mantenimiento aprobado - backfill',
      p_technician_id => v_rec.technician_id,
      p_service_case_id => NULL
    );

    IF v_result ? 'error' THEN
      RAISE NOTICE 'Failed to create visit for maintenance %: %', v_rec.id, v_result->>'error';
    ELSE
      UPDATE elevator_visit_entries
      SET service_record_id = v_rec.id, status = 'approved'
      WHERE id = (v_result->>'id')::UUID;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Backfilled % visit entries from maintenance records', v_count;
END $$;

-- ============================================================
-- 3. ADD service_order_id COLUMN IF NOT EXISTS
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'elevator_visit_entries' AND column_name = 'service_order_id'
  ) THEN
    ALTER TABLE elevator_visit_entries ADD COLUMN service_order_id UUID REFERENCES service_orders(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_eve_service_order ON elevator_visit_entries(service_order_id);
  END IF;
END $$;

-- ============================================================
-- DONE
-- ============================================================
