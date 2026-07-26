-- 049: Fix building_recipients RLS for INSERT
-- Adds explicit WITH CHECK policies for INSERT operations.

-- ============================================================
-- 1. FIX RLS POLICIES
-- ============================================================

DO $$
BEGIN
  -- Drop existing policies
  DROP POLICY IF EXISTS "br_admin_all" ON building_recipients;
  DROP POLICY IF EXISTS "br_supervisor_all" ON building_recipients;

  -- Admin: full access (SELECT, INSERT, UPDATE, DELETE)
  CREATE POLICY "br_admin_select" ON building_recipients
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

  CREATE POLICY "br_admin_insert" ON building_recipients
    FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

  CREATE POLICY "br_admin_update" ON building_recipients
    FOR UPDATE USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

  CREATE POLICY "br_admin_delete" ON building_recipients
    FOR DELETE USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

  -- Supervisor: read + insert + update
  CREATE POLICY "br_supervisor_select" ON building_recipients
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'supervisor')
    );

  CREATE POLICY "br_supervisor_insert" ON building_recipients
    FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'supervisor')
    );

  CREATE POLICY "br_supervisor_update" ON building_recipients
    FOR UPDATE USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'supervisor')
    );
END $$;

-- ============================================================
-- DONE
-- ============================================================
