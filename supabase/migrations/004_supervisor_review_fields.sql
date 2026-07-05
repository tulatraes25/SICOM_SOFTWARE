-- =====================================================
-- SICOM QR Ascensores - Campos para revisión supervisor
-- Versión: 1.0.3
-- Fecha: 2026-07-04
-- =====================================================

-- Agregar campos adicionales a service_records si no existen
DO $$ 
BEGIN
  -- Campo para motivo de rechazo
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_records' AND column_name = 'rejection_reason') THEN
    ALTER TABLE service_records ADD COLUMN rejection_reason TEXT;
  END IF;

  -- Campo para quién revisó
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_records' AND column_name = 'reviewed_by') THEN
    ALTER TABLE service_records ADD COLUMN reviewed_by UUID REFERENCES profiles(id);
  END IF;

  -- Campo para cuándo se revisó
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_records' AND column_name = 'reviewed_at') THEN
    ALTER TABLE service_records ADD COLUMN reviewed_at TIMESTAMPTZ;
  END IF;

  -- Campo para informe final aprobado
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_records' AND column_name = 'final_report') THEN
    ALTER TABLE service_records ADD COLUMN final_report TEXT;
  END IF;
END $$;

-- Habilitar RLS en monthly_reports si no está habilitado
ALTER TABLE monthly_reports ENABLE ROW LEVEL SECURITY;

-- Políticas para monthly_reports
DROP POLICY IF EXISTS "Supervisor can manage monthly reports" ON monthly_reports;
DROP POLICY IF EXISTS "Admin can view monthly reports" ON monthly_reports;
DROP POLICY IF EXISTS "Technician can view monthly reports" ON monthly_reports;
DROP POLICY IF EXISTS "Responsible can view reports for assigned elevators" ON monthly_reports;

CREATE POLICY "Supervisor can manage monthly reports"
  ON monthly_reports FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'supervisor'
    )
  );

CREATE POLICY "Admin can view monthly reports"
  ON monthly_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Technician can view monthly reports"
  ON monthly_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'technician'
    )
  );

CREATE POLICY "Responsible can view approved reports for assigned elevators"
  ON monthly_reports FOR SELECT
  USING (
    status IN ('approved', 'sent')
    AND EXISTS (
      SELECT 1 FROM elevators e
      WHERE e.id = monthly_reports.elevator_id
      AND e.responsible_user_id = auth.uid()
    )
  );
