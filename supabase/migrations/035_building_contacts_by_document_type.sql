-- 035: Building contacts by document type
-- Migrates data from building_report_recipients to building_contacts.

-- ============================================================
-- 1. TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS building_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  position TEXT,
  organization TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  receives_reports BOOLEAN NOT NULL DEFAULT false,
  receives_budgets BOOLEAN NOT NULL DEFAULT false,
  receives_invoices BOOLEAN NOT NULL DEFAULT false,
  receives_service_orders BOOLEAN NOT NULL DEFAULT false,
  receives_claim_updates BOOLEAN NOT NULL DEFAULT false,
  receives_general_notices BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_building_contacts_building ON building_contacts(building_id);
CREATE INDEX IF NOT EXISTS idx_building_contacts_email ON building_contacts(email);
CREATE INDEX IF NOT EXISTS idx_building_contacts_active ON building_contacts(building_id, is_active);

-- Unique: one active contact per email per building
CREATE UNIQUE INDEX IF NOT EXISTS idx_building_contacts_unique_active
  ON building_contacts(building_id, lower(email))
  WHERE is_active = true;

-- ============================================================
-- 3. MIGRATE DATA FROM building_report_recipients
-- ============================================================

DO $$
DECLARE
  v_rec record;
  v_count integer := 0;
BEGIN
  FOR v_rec IN
    SELECT br.id, br.building_id, br.name, br.email, br.active,
           p.id as created_by_id
    FROM building_report_recipients br
    LEFT JOIN profiles p ON p.role = 'admin'
    WHERE NOT EXISTS (
      SELECT 1 FROM building_contacts bc
      WHERE bc.building_id = br.building_id
        AND lower(bc.email) = lower(br.email)
        AND bc.is_active = true
    )
  LOOP
    INSERT INTO building_contacts (
      building_id, name, email, is_active,
      receives_reports, created_by
    ) VALUES (
      v_rec.building_id, v_rec.name, v_rec.email, v_rec.active,
      true, COALESCE(v_rec.created_by_id, (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1))
    );
    v_count := v_count + 1;
  END LOOP;
  RAISE NOTICE 'Migrated % contacts from building_report_recipients', v_count;
END $$;

-- ============================================================
-- 4. RLS
-- ============================================================

ALTER TABLE building_contacts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "bc_admin_all" ON building_contacts;
  DROP POLICY IF EXISTS "bc_supervisor_select" ON building_contacts;

  CREATE POLICY "bc_admin_all" ON building_contacts
    FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

  CREATE POLICY "bc_supervisor_select" ON building_contacts
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'supervisor')
    );
END $$;

-- ============================================================
-- 5. TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_building_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_building_contacts_updated_at ON building_contacts;
CREATE TRIGGER trigger_building_contacts_updated_at
  BEFORE UPDATE ON building_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_building_contacts_updated_at();

-- ============================================================
-- DONE
-- ============================================================
