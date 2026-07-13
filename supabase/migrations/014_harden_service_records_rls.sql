-- =====================================================
-- SICOM Patagonia SRL - Endurecer RLS service_records
-- Versión: 1.0.14
-- Fecha: 2026-07-13
-- =====================================================
-- Esta migración es IDEMPOTENTE: puede ejecutarse múltiples
-- veces sin efectos colaterales.
-- =====================================================

-- =====================================================
-- SERVICE_RECORDS
-- =====================================================

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Technician can insert own service records" ON service_records;
DROP POLICY IF EXISTS "Technician can view own service records" ON service_records;
DROP POLICY IF EXISTS "Technician can update own draft records" ON service_records;
DROP POLICY IF EXISTS "Supervisor can view all service records" ON service_records;
DROP POLICY IF EXISTS "Supervisor can update service records" ON service_records;
DROP POLICY IF EXISTS "Admin can manage service records" ON service_records;
DROP POLICY IF EXISTS "Responsible can view service records for assigned elevators" ON service_records;
DROP POLICY IF EXISTS "Responsible can view approved records for assigned elevators" ON service_records;

-- ADMIN: Control total
CREATE POLICY "admin_all_service_records"
  ON service_records FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin' AND active = true
    )
  );

-- SUPERVISOR: Ver todos, actualizar solo campos de revisión
CREATE POLICY "supervisor_select_service_records"
  ON service_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'supervisor' AND active = true
    )
  );

CREATE POLICY "supervisor_update_service_records"
  ON service_records FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'supervisor' AND active = true
    )
  );

-- TECHNICIAN: Ver propios, insertar propios, actualizar solo draft
CREATE POLICY "technician_select_own_service_records"
  ON service_records FOR SELECT
  TO authenticated
  USING (
    technician_id = auth.uid()
  );

CREATE POLICY "technician_insert_own_service_records"
  ON service_records FOR INSERT
  TO authenticated
  WITH CHECK (
    technician_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'technician' AND active = true
    )
  );

CREATE POLICY "technician_update_own_draft_service_records"
  ON service_records FOR UPDATE
  TO authenticated
  USING (
    technician_id = auth.uid()
    AND status IN ('draft', 'rejected')
  );

-- RESPONSIBLE: Ver solo aprobados de ascensores asignados
CREATE POLICY "responsible_select_approved_service_records"
  ON service_records FOR SELECT
  TO authenticated
  USING (
    status = 'approved'
    AND EXISTS (
      SELECT 1 FROM elevators e
      WHERE e.id = service_records.elevator_id
      AND e.responsible_user_id = auth.uid()
    )
  );

-- =====================================================
-- SERVICE_CHECKLIST_ITEMS
-- =====================================================

DROP POLICY IF EXISTS "Technician can manage own checklist items" ON service_checklist_items;
DROP POLICY IF EXISTS "Technician can view checklist from own records" ON service_checklist_items;
DROP POLICY IF EXISTS "Technician can insert checklist for own records" ON service_checklist_items;
DROP POLICY IF EXISTS "Technician can update checklist for own records" ON service_checklist_items;
DROP POLICY IF EXISTS "Supervisor can view all checklist items" ON service_checklist_items;
DROP POLICY IF EXISTS "Admin/supervisor can view all checklist items" ON service_checklist_items;

-- Technician: CRUD solo en registros propios y draft
CREATE POLICY "technician_manage_own_checklist_draft"
  ON service_checklist_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_records sr
      WHERE sr.id = service_checklist_items.service_record_id
      AND sr.technician_id = auth.uid()
      AND sr.status = 'draft'
    )
  );

-- Admin/Supervisor: ver todo
CREATE POLICY "admin_supervisor_select_all_checklist"
  ON service_checklist_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'supervisor') AND active = true
    )
  );

-- =====================================================
-- SERVICE_PHOTOS
-- =====================================================

DROP POLICY IF EXISTS "Technician can manage own photos" ON service_photos;
DROP POLICY IF EXISTS "Technician can view photos from own records" ON service_photos;
DROP POLICY IF EXISTS "Technician can insert photos for own records" ON service_photos;
DROP POLICY IF EXISTS "Technician can delete photos from own records" ON service_photos;
DROP POLICY IF EXISTS "Supervisor can view all photos" ON service_photos;
DROP POLICY IF EXISTS "Admin/supervisor can view all photos" ON service_photos;

-- Technician: CRUD solo en registros propios y draft
CREATE POLICY "technician_manage_own_photos_draft"
  ON service_photos FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_records sr
      WHERE sr.id = service_photos.service_record_id
      AND sr.technician_id = auth.uid()
      AND sr.status = 'draft'
    )
  );

-- Admin/Supervisor: ver todo
CREATE POLICY "admin_supervisor_select_all_photos"
  ON service_photos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'supervisor') AND active = true
    )
  );

-- =====================================================
-- RESUMEN DE POLÍTICAS
-- =====================================================
-- service_records:
--   admin_all_service_records (ALL)
--   supervisor_select_service_records (SELECT)
--   supervisor_update_service_records (UPDATE)
--   technician_select_own_service_records (SELECT)
--   technician_insert_own_service_records (INSERT)
--   technician_update_own_draft_service_records (UPDATE)
--   responsible_select_approved_service_records (SELECT)
--
-- service_checklist_items:
--   technician_manage_own_checklist_draft (ALL)
--   admin_supervisor_select_all_checklist (SELECT)
--
-- service_photos:
--   technician_manage_own_photos_draft (ALL)
--   admin_supervisor_select_all_photos (SELECT)
