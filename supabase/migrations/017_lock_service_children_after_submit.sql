-- =====================================================
-- SICOM Patagonia SRL - Bloquear checklist/fotos post-envío
-- Versión: 1.0.17
-- Fecha: 2026-07-13
-- =====================================================

-- =====================================================
-- SERVICE_CHECKLIST_ITEMS
-- =====================================================

DROP POLICY IF EXISTS "technician_select_own_checklist" ON service_checklist_items;
DROP POLICY IF EXISTS "technician_manage_own_checklist_draft" ON service_checklist_items;
DROP POLICY IF EXISTS "admin_supervisor_select_all_checklist" ON service_checklist_items;
DROP POLICY IF EXISTS "technician_select_own_checklist_any_status" ON service_checklist_items;
DROP POLICY IF EXISTS "technician_insert_own_checklist_draft" ON service_checklist_items;
DROP POLICY IF EXISTS "technician_update_own_checklist_draft" ON service_checklist_items;
DROP POLICY IF EXISTS "technician_delete_own_checklist_draft" ON service_checklist_items;
DROP POLICY IF EXISTS "admin_all_checklist" ON service_checklist_items;
DROP POLICY IF EXISTS "supervisor_select_checklist" ON service_checklist_items;

-- TECHNICIAN SELECT: Ver checklist de todos sus registros (cualquier estado)
CREATE POLICY "technician_select_own_checklist_any_status"
  ON service_checklist_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_records sr
      WHERE sr.id = service_checklist_items.service_record_id
      AND sr.technician_id = auth.uid()
    )
  );

-- TECHNICIAN INSERT: Solo en draft o rejected
CREATE POLICY "technician_insert_own_checklist_draft"
  ON service_checklist_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM service_records sr
      WHERE sr.id = service_record_id
      AND sr.technician_id = auth.uid()
      AND sr.status IN ('draft', 'rejected')
    )
  );

-- TECHNICIAN UPDATE: Solo en draft o rejected
CREATE POLICY "technician_update_own_checklist_draft"
  ON service_checklist_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_records sr
      WHERE sr.id = service_record_id
      AND sr.technician_id = auth.uid()
      AND sr.status IN ('draft', 'rejected')
    )
  );

-- TECHNICIAN DELETE: Solo en draft o rejected
CREATE POLICY "technician_delete_own_checklist_draft"
  ON service_checklist_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_records sr
      WHERE sr.id = service_record_id
      AND sr.technician_id = auth.uid()
      AND sr.status IN ('draft', 'rejected')
    )
  );

-- ADMIN: Gestión total
CREATE POLICY "admin_all_checklist"
  ON service_checklist_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin' AND active = true
    )
  );

-- SUPERVISOR: Solo SELECT
CREATE POLICY "supervisor_select_checklist"
  ON service_checklist_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'supervisor' AND active = true
    )
  );

-- =====================================================
-- SERVICE_PHOTOS
-- =====================================================

DROP POLICY IF EXISTS "technician_select_own_photos" ON service_photos;
DROP POLICY IF EXISTS "technician_manage_own_photos_draft" ON service_photos;
DROP POLICY IF EXISTS "admin_supervisor_select_all_photos" ON service_photos;
DROP POLICY IF EXISTS "technician_insert_own_photos_draft" ON service_photos;
DROP POLICY IF EXISTS "technician_update_own_photos_draft" ON service_photos;
DROP POLICY IF EXISTS "technician_delete_own_photos_draft" ON service_photos;
DROP POLICY IF EXISTS "admin_all_photos" ON service_photos;
DROP POLICY IF EXISTS "supervisor_select_photos" ON service_photos;

-- TECHNICIAN SELECT: Ver fotos de todos sus registros (cualquier estado)
CREATE POLICY "technician_select_own_photos"
  ON service_photos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_records sr
      WHERE sr.id = service_photos.service_record_id
      AND sr.technician_id = auth.uid()
    )
  );

-- TECHNICIAN INSERT: Solo en draft o rejected
CREATE POLICY "technician_insert_own_photos_draft"
  ON service_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM service_records sr
      WHERE sr.id = service_record_id
      AND sr.technician_id = auth.uid()
      AND sr.status IN ('draft', 'rejected')
    )
  );

-- TECHNICIAN UPDATE: Solo en draft o rejected
CREATE POLICY "technician_update_own_photos_draft"
  ON service_photos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_records sr
      WHERE sr.id = service_record_id
      AND sr.technician_id = auth.uid()
      AND sr.status IN ('draft', 'rejected')
    )
  );

-- TECHNICIAN DELETE: Solo en draft o rejected
CREATE POLICY "technician_delete_own_photos_draft"
  ON service_photos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_records sr
      WHERE sr.id = service_record_id
      AND sr.technician_id = auth.uid()
      AND sr.status IN ('draft', 'rejected')
    )
  );

-- ADMIN: Gestión total
CREATE POLICY "admin_all_photos"
  ON service_photos FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin' AND active = true
    )
  );

-- SUPERVISOR: Solo SELECT
CREATE POLICY "supervisor_select_photos"
  ON service_photos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'supervisor' AND active = true
    )
  );

-- =====================================================
-- RESUMEN
-- =====================================================
-- checklist:
--   technician_select_own_checklist_any_status (SELECT)
--   technician_insert_own_checklist_draft (INSERT)
--   technician_update_own_checklist_draft (UPDATE)
--   technician_delete_own_checklist_draft (DELETE)
--   admin_all_checklist (ALL)
--   supervisor_select_checklist (SELECT)
--
-- photos:
--   technician_select_own_photos (SELECT)
--   technician_insert_own_photos_draft (INSERT)
--   technician_update_own_photos_draft (UPDATE)
--   technician_delete_own_photos_draft (DELETE)
--   admin_all_photos (ALL)
--   supervisor_select_photos (SELECT)
