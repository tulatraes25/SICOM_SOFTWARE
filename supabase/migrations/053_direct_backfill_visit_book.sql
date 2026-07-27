-- 053: Direct backfill with diagnostics
-- Runs AFTER 052 — adds service_order_id if missing, backfills directly

-- ============================================================
-- 1. Add service_order_id if missing
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'elevator_visit_entries' AND column_name = 'service_order_id'
  ) THEN
    ALTER TABLE elevator_visit_entries ADD COLUMN service_order_id UUID REFERENCES service_orders(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_eve_service_order ON elevator_visit_entries(service_order_id);
    RAISE NOTICE 'Added service_order_id column';
  ELSE
    RAISE NOTICE 'service_order_id already exists';
  END IF;
END $$;

-- ============================================================
-- 2. Count existing data
-- ============================================================
DO $$
DECLARE
  v_existing INTEGER;
  v_orders INTEGER;
  v_records INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_existing FROM elevator_visit_entries;
  SELECT COUNT(*) INTO v_orders FROM service_orders WHERE status IN ('approved', 'completed') AND elevator_id IS NOT NULL;
  SELECT COUNT(*) INTO v_records FROM service_records WHERE status = 'approved' AND elevator_id IS NOT NULL;

  RAISE NOTICE '=== DIAGNOSTICS ===';
  RAISE NOTICE 'Existing visit entries: %', v_existing;
  RAISE NOTICE 'Approved/completed service orders: %', v_orders;
  RAISE NOTICE 'Approved maintenance records: %', v_records;
END $$;

-- ============================================================
-- 3. Backfill from service orders (direct insert, no RPC)
-- ============================================================
DO $$
DECLARE
  v_count INTEGER := 0;
  v_skipped INTEGER := 0;
  v_errors INTEGER := 0;
  v_rec RECORD;
  v_admin_id UUID;
  v_next_number INTEGER;
BEGIN
  SELECT id INTO v_admin_id FROM profiles WHERE role = 'admin' AND active = true ORDER BY created_at LIMIT 1;
  IF v_admin_id IS NULL THEN
    RAISE NOTICE 'No admin found';
    RETURN;
  END IF;

  -- Get next entry number
  SELECT COALESCE(MAX(entry_number), 1899) + 1 INTO v_next_number FROM elevator_visit_entries;

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
    BEGIN
      INSERT INTO elevator_visit_entries (
        elevator_id, service_order_id, service_case_id,
        entry_number, visit_date, entry_type, origin_type,
        title, description, work_performed,
        technician_id, registered_by, status, operational_status, conservation_status
      ) VALUES (
        v_rec.elevator_id, v_rec.id, v_rec.service_case_id,
        v_next_number, v_rec.order_date, 'other', 'service_order',
        'Orden de servicio', 'Migración automática - orden aprobada',
        'Trabajo completado y aprobado',
        v_rec.technician_id, v_admin_id, 'approved', 'operational', 'good'
      );
      v_next_number := v_next_number + 1;
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      RAISE NOTICE 'Error inserting visit for order %: %', v_rec.id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '=== SERVICE ORDERS BACKFILL ===';
  RAISE NOTICE 'Visits created: %', v_count;
  RAISE NOTICE 'Errors: %', v_errors;
END $$;

-- ============================================================
-- 4. Backfill from maintenance records (direct insert, no RPC)
-- ============================================================
DO $$
DECLARE
  v_count INTEGER := 0;
  v_errors INTEGER := 0;
  v_rec RECORD;
  v_admin_id UUID;
  v_next_number INTEGER;
BEGIN
  SELECT id INTO v_admin_id FROM profiles WHERE role = 'admin' AND active = true ORDER BY created_at LIMIT 1;
  IF v_admin_id IS NULL THEN RETURN; END IF;

  SELECT COALESCE(MAX(entry_number), 1899) + 1 INTO v_next_number FROM elevator_visit_entries;

  FOR v_rec IN
    SELECT sr.id, sr.elevator_id, sr.service_date, sr.service_type, sr.technician_id
    FROM service_records sr
    WHERE sr.status = 'approved'
      AND sr.elevator_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM elevator_visit_entries eve WHERE eve.service_record_id = sr.id
      )
  LOOP
    BEGIN
      INSERT INTO elevator_visit_entries (
        elevator_id, service_record_id,
        entry_number, visit_date, entry_type, origin_type,
        title, description, work_performed,
        technician_id, registered_by, status, operational_status, conservation_status
      ) VALUES (
        v_rec.elevator_id, v_rec.id,
        v_next_number, v_rec.service_date,
        CASE v_rec.service_type
          WHEN 'preventivo' THEN 'preventive_maintenance'
          WHEN 'correctivo' THEN 'corrective_maintenance'
          ELSE 'scheduled_service'
        END,
        'service_record',
        'Mantenimiento ' || COALESCE(v_rec.service_type, 'programado'),
        'Migración automática - mantenimiento aprobado',
        'Trabajo completado y aprobado',
        v_rec.technician_id, v_admin_id, 'approved', 'operational', 'good'
      );
      v_next_number := v_next_number + 1;
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      RAISE NOTICE 'Error inserting visit for record %: %', v_rec.id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '=== MAINTENANCE RECORDS BACKFILL ===';
  RAISE NOTICE 'Visits created: %', v_count;
  RAISE NOTICE 'Errors: %', v_errors;
END $$;

-- ============================================================
-- 5. Final count
-- ============================================================
DO $$
DECLARE
  v_total INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total FROM elevator_visit_entries;
  RAISE NOTICE '=== FINAL COUNT ===';
  RAISE NOTICE 'Total visit entries: %', v_total;
END $$;
