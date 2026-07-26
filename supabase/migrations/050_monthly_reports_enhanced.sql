-- 050: Enhance monthly reports with full feature set

-- ============================================================
-- 1. ADD COLUMNS TO monthly_reports
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='monthly_reports' AND column_name='client_id') THEN
    ALTER TABLE monthly_reports ADD COLUMN client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='monthly_reports' AND column_name='building_id') THEN
    ALTER TABLE monthly_reports ADD COLUMN building_id UUID REFERENCES buildings(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='monthly_reports' AND column_name='general_status') THEN
    ALTER TABLE monthly_reports ADD COLUMN general_status TEXT DEFAULT 'operativo' CHECK (general_status IN ('operativo','operativo_con_observaciones','requiere_seguimiento','fuera_de_servicio'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='monthly_reports' AND column_name='general_notes') THEN
    ALTER TABLE monthly_reports ADD COLUMN general_notes TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='monthly_reports' AND column_name='report_month') THEN
    ALTER TABLE monthly_reports ADD COLUMN report_month INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='monthly_reports' AND column_name='report_year') THEN
    ALTER TABLE monthly_reports ADD COLUMN report_year INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='monthly_reports' AND column_name='pdf_version') THEN
    ALTER TABLE monthly_reports ADD COLUMN pdf_version INTEGER DEFAULT 0;
  END IF;
END $$;

-- ============================================================
-- 2. TABLE: monthly_report_included_records
-- ============================================================

CREATE TABLE IF NOT EXISTS monthly_report_included_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  monthly_report_id UUID NOT NULL REFERENCES monthly_reports(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL CHECK (record_type IN ('maintenance','service_order','claim')),
  record_id UUID NOT NULL,
  included BOOLEAN NOT NULL DEFAULT true,
  exclusion_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mrir_report ON monthly_report_included_records(monthly_report_id);

-- ============================================================
-- 3. TABLE: monthly_report_events
-- ============================================================

CREATE TABLE IF NOT EXISTS monthly_report_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  monthly_report_id UUID NOT NULL REFERENCES monthly_reports(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mre_report ON monthly_report_events(monthly_report_id);

-- ============================================================
-- 4. RLS
-- ============================================================

ALTER TABLE monthly_report_included_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_report_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "mirr_admin_supervisor" ON monthly_report_included_records;
  DROP POLICY IF EXISTS "mre_admin_supervisor" ON monthly_report_events;

  CREATE POLICY "mirr_admin_supervisor" ON monthly_report_included_records FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','supervisor'))
  );
  CREATE POLICY "mre_admin_supervisor" ON monthly_report_events FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','supervisor'))
  );
END $$;

-- ============================================================
-- DONE
-- ============================================================
