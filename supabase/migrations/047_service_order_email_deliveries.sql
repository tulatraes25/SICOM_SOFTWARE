-- 047: Service order email deliveries

-- ============================================================
-- 1. TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS service_order_email_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  service_case_id UUID NOT NULL REFERENCES service_cases(id) ON DELETE CASCADE,
  pdf_version INTEGER NOT NULL,
  recipients JSONB NOT NULL,
  subject TEXT NOT NULL,
  sent_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  provider_message_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_soed_order ON service_order_email_deliveries(service_order_id);
CREATE INDEX IF NOT EXISTS idx_soed_case ON service_order_email_deliveries(service_case_id);

-- ============================================================
-- 3. RLS
-- ============================================================

ALTER TABLE service_order_email_deliveries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "soed_admin_all" ON service_order_email_deliveries;
  DROP POLICY IF EXISTS "soed_supervisor_all" ON service_order_email_deliveries;

  CREATE POLICY "soed_admin_all" ON service_order_email_deliveries FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','supervisor'))
  );
END $$;

-- ============================================================
-- DONE
-- ============================================================
