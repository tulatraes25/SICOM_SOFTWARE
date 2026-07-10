-- =====================================================
-- SICOM Patagonia SRL - Fix RLS report_recipients
-- Versión: 1.0.11
-- Fecha: 2026-07-09
-- =====================================================

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Admin can manage recipients" ON report_recipients;
DROP POLICY IF EXISTS "Supervisor can view recipients" ON report_recipients;
DROP POLICY IF EXISTS "Public read access" ON report_recipients;

-- Admin puede todo en report_recipients
CREATE POLICY "Admin can manage recipients"
ON report_recipients FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    AND active = true
  )
);

-- Supervisor puede ver
CREATE POLICY "Supervisor can view recipients"
ON report_recipients FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'supervisor'
    AND active = true
  )
);
