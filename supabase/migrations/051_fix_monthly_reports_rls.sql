-- 051: Fix monthly_reports RLS for INSERT

DO $$
BEGIN
  -- Drop existing policies
  DROP POLICY IF EXISTS "mr_admin_all" ON monthly_reports;
  DROP POLICY IF EXISTS "mr_supervisor_all" ON monthly_reports;
  DROP POLICY IF EXISTS "monthly_reports_admin" ON monthly_reports;
  DROP POLICY IF EXISTS "monthly_reports_supervisor" ON monthly_reports;

  -- Admin: full access
  CREATE POLICY "mr_admin_select" ON monthly_reports
    FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

  CREATE POLICY "mr_admin_insert" ON monthly_reports
    FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

  CREATE POLICY "mr_admin_update" ON monthly_reports
    FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

  -- Supervisor: read + insert + update
  CREATE POLICY "mr_supervisor_select" ON monthly_reports
    FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'supervisor'));

  CREATE POLICY "mr_supervisor_insert" ON monthly_reports
    FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'supervisor'));

  CREATE POLICY "mr_supervisor_update" ON monthly_reports
    FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'supervisor'));
END $$;
