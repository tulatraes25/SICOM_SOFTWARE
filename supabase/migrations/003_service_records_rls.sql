-- =====================================================
-- SICOM QR Ascensores - RLS para service_records
-- Versión: 1.0.2
-- Fecha: 2026-07-04
-- =====================================================

-- Habilitar RLS en service_records si no está habilitado
ALTER TABLE service_records ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si las hay
DROP POLICY IF EXISTS "Technician can insert own service records" ON service_records;
DROP POLICY IF EXISTS "Technician can view own service records" ON service_records;
DROP POLICY IF EXISTS "Supervisor can view all service records" ON service_records;
DROP POLICY IF EXISTS "Supervisor can update service records" ON service_records;
DROP POLICY IF EXISTS "Admin can manage service records" ON service_records;
DROP POLICY IF EXISTS "Responsible can view service records for assigned elevators" ON service_records;

-- Technician puede crear registros con su propio technician_id
CREATE POLICY "Technician can insert own service records"
  ON service_records FOR INSERT
  WITH CHECK (
    technician_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'technician'
    )
  );

-- Technician puede ver sus propios registros
CREATE POLICY "Technician can view own service records"
  ON service_records FOR SELECT
  USING (
    technician_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'supervisor')
    )
  );

-- Technician puede actualizar solo sus registros en draft o rejected
CREATE POLICY "Technician can update own draft records"
  ON service_records FOR UPDATE
  USING (
    technician_id = auth.uid()
    AND status IN ('draft', 'rejected')
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'technician'
    )
  );

-- Supervisor puede ver y actualizar todos los registros
CREATE POLICY "Supervisor can view all service records"
  ON service_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'supervisor'
    )
  );

CREATE POLICY "Supervisor can update service records"
  ON service_records FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'supervisor'
    )
  );

-- Admin puede todo
CREATE POLICY "Admin can manage service records"
  ON service_records FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Responsible puede ver registros aprobados de sus ascensores
CREATE POLICY "Responsible can view approved records for assigned elevators"
  ON service_records FOR SELECT
  USING (
    status = 'approved'
    AND EXISTS (
      SELECT 1 FROM elevators e
      WHERE e.id = service_records.elevator_id
      AND e.responsible_user_id = auth.uid()
    )
  );

-- =====================================================
-- POLÍTICAS PARA service_checklist_items
-- =====================================================

ALTER TABLE service_checklist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Technician can manage own checklist items" ON service_checklist_items;
DROP POLICY IF EXISTS "Supervisor can view all checklist items" ON service_checklist_items;

CREATE POLICY "Technician can manage own checklist items"
  ON service_checklist_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM service_records sr
      WHERE sr.id = service_record_id
      AND sr.technician_id = auth.uid()
    )
  );

CREATE POLICY "Supervisor can view all checklist items"
  ON service_checklist_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('supervisor', 'admin')
    )
  );

-- =====================================================
-- POLÍTICAS PARA service_photos
-- =====================================================

ALTER TABLE service_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Technician can manage own photos" ON service_photos;
DROP POLICY IF EXISTS "Supervisor can view all photos" ON service_photos;

CREATE POLICY "Technician can manage own photos"
  ON service_photos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM service_records sr
      WHERE sr.id = service_record_id
      AND sr.technician_id = auth.uid()
    )
  );

CREATE POLICY "Supervisor can view all photos"
  ON service_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('supervisor', 'admin')
    )
  );
