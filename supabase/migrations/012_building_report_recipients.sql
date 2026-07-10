-- =====================================================
-- SICOM Patagonia SRL - Destinatarios por Edificio
-- Versión: 1.0.12
-- Fecha: 2026-07-10
-- =====================================================

-- Nueva tabla: destinatarios de informes por edificio
CREATE TABLE IF NOT EXISTS building_report_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_building_recipients_building ON building_report_recipients(building_id);
CREATE INDEX IF NOT EXISTS idx_building_recipients_email ON building_report_recipients(email);

-- RLS
ALTER TABLE building_report_recipients ENABLE ROW LEVEL SECURITY;

-- Admin puede todo
CREATE POLICY "Admin can manage building recipients"
ON building_report_recipients FOR ALL
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
CREATE POLICY "Supervisor can view building recipients"
ON building_report_recipients FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'supervisor'
    AND active = true
  )
);
