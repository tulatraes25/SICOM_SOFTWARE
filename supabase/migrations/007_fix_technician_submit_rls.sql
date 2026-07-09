-- =====================================================
-- SICOM Patagonia SRL - Fix RLS para envío a revisión
-- Versión: 1.0.7
-- Fecha: 2026-07-09
-- =====================================================

-- Eliminar políticas existentes que causan conflicto
DROP POLICY IF EXISTS "Technician can update own draft service records" ON service_records;
DROP POLICY IF EXISTS "Technician can submit own draft service records" ON service_records;
DROP POLICY IF EXISTS "Technician can update and submit own draft service records" ON service_records;

-- Política unificada que permite editar drafts Y enviar a revisión
CREATE POLICY "Technician can update and submit own draft service records"
ON service_records
FOR UPDATE
TO authenticated
USING (
  technician_id = auth.uid()
  AND status = 'draft'
  AND EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'technician'
    AND coalesce(p.is_active, p.active, true) = true
  )
)
WITH CHECK (
  technician_id = auth.uid()
  AND status IN ('draft', 'submitted', 'in_review')
  AND EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'technician'
    AND coalesce(p.is_active, p.active, true) = true
  )
);
