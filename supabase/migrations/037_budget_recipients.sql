-- 037: Separate budget recipients table
-- Independent from building_report_recipients.

-- ============================================================
-- 1. TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS building_budget_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  position TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_bbr_building ON building_budget_recipients(building_id);
CREATE INDEX IF NOT EXISTS idx_bbr_active ON building_budget_recipients(building_id, active);

-- Unique: one active recipient per email per building
CREATE UNIQUE INDEX IF NOT EXISTS idx_bbr_unique_active
  ON building_budget_recipients(building_id, lower(email))
  WHERE active = true;

-- ============================================================
-- 3. RLS
-- ============================================================

ALTER TABLE building_budget_recipients ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "bbr_admin_all" ON building_budget_recipients;
  DROP POLICY IF EXISTS "bbr_supervisor_select" ON building_budget_recipients;

  CREATE POLICY "bbr_admin_all" ON building_budget_recipients
    FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

  CREATE POLICY "bbr_supervisor_select" ON building_budget_recipients
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'supervisor')
    );
END $$;

-- ============================================================
-- 4. TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_building_budget_recipients_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_bbr_updated_at ON building_budget_recipients;
CREATE TRIGGER trigger_bbr_updated_at
  BEFORE UPDATE ON building_budget_recipients
  FOR EACH ROW
  EXECUTE FUNCTION update_building_budget_recipients_updated_at();

-- ============================================================
-- DONE
-- ============================================================
