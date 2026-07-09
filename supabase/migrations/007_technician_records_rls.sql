-- =====================================================
-- SICOM Patagonia SRL - RLS para técnico ver registros
-- Versión: 1.0.6
-- Fecha: 2026-07-09
-- =====================================================

-- Asegurar que existan las políticas para technician
-- Primero eliminar políticas existentes si las hay
DROP POLICY IF EXISTS "Technician can view own service records" ON service_records;
DROP POLICY IF EXISTS "Technician can insert own service records" ON service_records;
DROP POLICY IF EXISTS "Technician can update own draft records" ON service_records;

-- Technician puede ver sus propios registros (incluidos drafts)
CREATE POLICY "Technician can view own service records"
  ON service_records FOR SELECT
  TO authenticated
  USING (
    technician_id = auth.uid()
  );

-- Technician puede crear registros
CREATE POLICY "Technician can insert own service records"
  ON service_records FOR INSERT
  TO authenticated
  WITH CHECK (
    technician_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'technician'
      AND active = true
    )
  );

-- Technician puede actualizar solo drafts propios
CREATE POLICY "Technician can update own draft records"
  ON service_records FOR UPDATE
  TO authenticated
  USING (
    technician_id = auth.uid()
    AND status IN ('draft', 'rejected')
  );

-- =====================================================
-- Checklist del técnico
-- =====================================================
DROP POLICY IF EXISTS "Technician can view checklist from own records" ON service_checklist_items;
DROP POLICY IF EXISTS "Technician can insert checklist for own records" ON service_checklist_items;
DROP POLICY IF EXISTS "Technician can update checklist for own records" ON service_checklist_items;

CREATE POLICY "Technician can view checklist from own records"
  ON service_checklist_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_records sr
      WHERE sr.id = service_checklist_items.service_record_id
      AND sr.technician_id = auth.uid()
    )
  );

CREATE POLICY "Technician can insert checklist for own records"
  ON service_checklist_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM service_records sr
      WHERE sr.id = service_record_id
      AND sr.technician_id = auth.uid()
    )
  );

CREATE POLICY "Technician can update checklist for own records"
  ON service_checklist_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_records sr
      WHERE sr.id = service_record_id
      AND sr.technician_id = auth.uid()
    )
  );

-- =====================================================
-- Fotos del técnico
-- =====================================================
DROP POLICY IF EXISTS "Technician can view photos from own records" ON service_photos;
DROP POLICY IF EXISTS "Technician can insert photos for own records" ON service_photos;
DROP POLICY IF EXISTS "Technician can delete photos from own records" ON service_photos;

CREATE POLICY "Technician can view photos from own records"
  ON service_photos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_records sr
      WHERE sr.id = service_photos.service_record_id
      AND sr.technician_id = auth.uid()
    )
  );

CREATE POLICY "Technician can insert photos for own records"
  ON service_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM service_records sr
      WHERE sr.id = service_record_id
      AND sr.technician_id = auth.uid()
    )
  );

CREATE POLICY "Technician can delete photos from own records"
  ON service_photos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_records sr
      WHERE sr.id = service_record_id
      AND sr.technician_id = auth.uid()
    )
  );
