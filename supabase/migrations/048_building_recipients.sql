-- 048: Building recipients for orders and documents

-- ============================================================
-- 1. TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS building_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  elevator_id UUID REFERENCES elevators(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role_label TEXT,
  phone TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  receives_service_orders BOOLEAN NOT NULL DEFAULT true,
  receives_monthly_reports BOOLEAN NOT NULL DEFAULT true,
  receives_budgets BOOLEAN NOT NULL DEFAULT false,
  receives_invoices BOOLEAN NOT NULL DEFAULT false,
  receives_claim_updates BOOLEAN NOT NULL DEFAULT false,
  receives_general_notices BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_br_building ON building_recipients(building_id);
CREATE INDEX IF NOT EXISTS idx_br_elevator ON building_recipients(elevator_id);
CREATE INDEX IF NOT EXISTS idx_br_active ON building_recipients(building_id, active);

-- ============================================================
-- 3. RLS
-- ============================================================

ALTER TABLE building_recipients ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "br_admin_all" ON building_recipients;
  DROP POLICY IF EXISTS "br_supervisor_all" ON building_recipients;

  CREATE POLICY "br_admin_all" ON building_recipients FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

  CREATE POLICY "br_supervisor_all" ON building_recipients FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'supervisor')
  );
END $$;

-- ============================================================
-- 4. TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_building_recipients_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_br_updated_at ON building_recipients;
CREATE TRIGGER trigger_br_updated_at
  BEFORE UPDATE ON building_recipients
  FOR EACH ROW
  EXECUTE FUNCTION update_building_recipients_updated_at();

-- ============================================================
-- DONE
-- ============================================================
