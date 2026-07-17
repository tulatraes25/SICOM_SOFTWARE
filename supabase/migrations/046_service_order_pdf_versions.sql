-- 046: Service order PDF versions and case documents

-- ============================================================
-- 1. TABLE: service_order_pdf_versions
-- ============================================================

CREATE TABLE IF NOT EXISTS service_order_pdf_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  service_case_id UUID NOT NULL REFERENCES service_cases(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  generated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  file_size BIGINT,
  is_current BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(service_order_id, version)
);

-- ============================================================
-- 2. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_sopv_order ON service_order_pdf_versions(service_order_id);
CREATE INDEX IF NOT EXISTS idx_sopv_case ON service_order_pdf_versions(service_case_id);
CREATE INDEX IF NOT EXISTS idx_sopv_current ON service_order_pdf_versions(service_order_id, is_current) WHERE is_current = true;

-- ============================================================
-- 3. RLS
-- ============================================================

ALTER TABLE service_order_pdf_versions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "sopv_admin_all" ON service_order_pdf_versions;
  DROP POLICY IF EXISTS "sopv_supervisor_all" ON service_order_pdf_versions;
  DROP POLICY IF EXISTS "sopv_technician_select" ON service_order_pdf_versions;

  CREATE POLICY "sopv_admin_all" ON service_order_pdf_versions FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','supervisor'))
  );

  CREATE POLICY "sopv_technician_select" ON service_order_pdf_versions FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'technician')
    AND service_order_id IN (
      SELECT service_order_id FROM service_order_technicians WHERE technician_id = auth.uid()
    )
  );
END $$;

-- ============================================================
-- 4. MIGRATE EXISTING PDFS
-- ============================================================

DO $$
DECLARE
  v_rec RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_rec IN
    SELECT so.id as order_id, so.service_case_id, so.final_pdf_path, so.final_pdf_version,
           so.final_pdf_generated_at, so.final_pdf_generated_by
    FROM service_orders so
    WHERE so.final_pdf_path IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM service_order_pdf_versions sopv
        WHERE sopv.service_order_id = so.id
      )
  LOOP
    INSERT INTO service_order_pdf_versions (
      service_order_id, service_case_id, version, storage_path,
      generated_by, generated_at, is_current
    ) VALUES (
      v_rec.order_id, v_rec.service_case_id, v_rec.final_pdf_version,
      v_rec.final_pdf_path, v_rec.final_pdf_generated_by,
      v_rec.final_pdf_generated_at, true
    );
    v_count := v_count + 1;
  END LOOP;
  RAISE NOTICE 'Migrated % PDF versions', v_count;
END $$;

-- ============================================================
-- 5. TRIGGER: auto-create version on PDF generation
-- ============================================================

CREATE OR REPLACE FUNCTION auto_create_pdf_version()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.final_pdf_path IS NOT NULL
     AND (OLD.final_pdf_path IS DISTINCT FROM NEW.final_pdf_path OR OLD.final_pdf_version IS DISTINCT FROM NEW.final_pdf_version) THEN
    -- Mark old versions as not current
    UPDATE service_order_pdf_versions
    SET is_current = false
    WHERE service_order_id = NEW.id AND is_current = true;

    -- Insert new version
    INSERT INTO service_order_pdf_versions (
      service_order_id, service_case_id, version, storage_path,
      generated_by, generated_at, is_current
    ) VALUES (
      NEW.id, NEW.service_case_id, NEW.final_pdf_version, NEW.final_pdf_path,
      NEW.final_pdf_generated_by, NEW.final_pdf_generated_at, true
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_pdf_version ON service_orders;
CREATE TRIGGER trigger_auto_pdf_version
  AFTER UPDATE ON service_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_pdf_version();

-- ============================================================
-- DONE
-- ============================================================
