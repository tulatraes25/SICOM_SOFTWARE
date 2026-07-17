-- 045: Add PDF storage for approved service orders

-- ============================================================
-- 1. ADD PDF COLUMNS TO service_orders
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_orders' AND column_name='final_pdf_path') THEN
    ALTER TABLE service_orders ADD COLUMN final_pdf_path TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_orders' AND column_name='final_pdf_generated_at') THEN
    ALTER TABLE service_orders ADD COLUMN final_pdf_generated_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_orders' AND column_name='final_pdf_generated_by') THEN
    ALTER TABLE service_orders ADD COLUMN final_pdf_generated_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='service_orders' AND column_name='final_pdf_version') THEN
    ALTER TABLE service_orders ADD COLUMN final_pdf_version INTEGER DEFAULT 1;
  END IF;
END $$;

-- ============================================================
-- 2. STORAGE BUCKET
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('service-order-reports', 'service-order-reports', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = false, file_size_limit = 10485760, allowed_mime_types = ARRAY['application/pdf'];

-- ============================================================
-- 3. STORAGE POLICIES
-- ============================================================

DO $$
BEGIN
  DROP POLICY IF EXISTS "sor_insert_admin" ON storage.objects;
  DROP POLICY IF EXISTS "sor_select_admin" ON storage.objects;
  DROP POLICY IF EXISTS "sor_select_technician" ON storage.objects;

  CREATE POLICY "sor_insert_admin" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'service-order-reports'
      AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','supervisor'))
    );

  CREATE POLICY "sor_select_admin" ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'service-order-reports'
      AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','supervisor'))
    );

  CREATE POLICY "sor_select_technician" ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'service-order-reports'
      AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'technician')
    );
END $$;

-- ============================================================
-- DONE
-- ============================================================
