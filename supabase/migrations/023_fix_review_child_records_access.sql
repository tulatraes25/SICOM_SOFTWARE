-- =====================================================
-- SICOM Patagonia SRL - Fix RLS para revisión admin
-- Versión: 1.0.23
-- Fecha: 2026-07-13
-- =====================================================

-- Asegurar que admin y supervisor puedan ver checklist
DROP POLICY IF EXISTS "admin_supervisor_select_all_checklist" ON service_checklist_items;
CREATE POLICY "admin_supervisor_select_all_checklist"
ON service_checklist_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'supervisor') AND active = true
  )
);

-- Asegurar que admin y supervisor puedan ver fotos
DROP POLICY IF EXISTS "admin_supervisor_select_all_photos" ON service_photos;
CREATE POLICY "admin_supervisor_select_all_photos"
ON service_photos FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'supervisor') AND active = true
  )
);

-- Asegurar que admin y supervisor puedan ver building_report_recipients
DROP POLICY IF EXISTS "Admin can manage building recipients" ON building_report_recipients;
CREATE POLICY "Admin can manage building recipients"
ON building_report_recipients FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin' AND active = true
  )
);

DROP POLICY IF EXISTS "Supervisor can view building recipients" ON building_report_recipients;
CREATE POLICY "Supervisor can view building recipients"
ON building_report_recipients FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'supervisor' AND active = true
  )
);
