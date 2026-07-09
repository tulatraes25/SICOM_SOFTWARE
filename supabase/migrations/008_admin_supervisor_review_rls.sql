-- =====================================================
-- SICOM Patagonia SRL - RLS para admin/supervisor review
-- Versión: 1.0.8
-- Fecha: 2026-07-09
-- =====================================================

-- Admin/supervisor pueden ver todos los service_records
DROP POLICY IF EXISTS "Admin can manage service records" ON service_records;
CREATE POLICY "Admin can manage service records"
  ON service_records FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'supervisor')
      AND active = true
    )
  );

-- Admin/supervisor pueden ver checklist items
DROP POLICY IF EXISTS "Supervisor can view all checklist items" ON service_checklist_items;
CREATE POLICY "Admin/supervisor can view all checklist items"
  ON service_checklist_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'supervisor')
      AND active = true
    )
  );

-- Admin/supervisor pueden ver fotos
DROP POLICY IF EXISTS "Supervisor can view all photos" ON service_photos;
CREATE POLICY "Admin/supervisor can view all photos"
  ON service_photos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'supervisor')
      AND active = true
    )
  );

-- Admin puede ver todos los profiles
DROP POLICY IF EXISTS "Admin can view all profiles" ON profiles;
CREATE POLICY "Admin can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
      AND active = true
    )
  );

-- Admin puede actualizar cualquier profile
DROP POLICY IF EXISTS "Admin can update any profile" ON profiles;
CREATE POLICY "Admin can update any profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
      AND active = true
    )
  );
