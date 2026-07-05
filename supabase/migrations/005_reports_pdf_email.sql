-- =====================================================
-- SICOM QR Ascensores - Campos para PDF y envío
-- Versión: 1.0.4
-- Fecha: 2026-07-04
-- =====================================================

-- Agregar campos adicionales a monthly_reports si no existen
DO $$ 
BEGIN
  -- Campo para URL del PDF
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monthly_reports' AND column_name = 'pdf_url') THEN
    ALTER TABLE monthly_reports ADD COLUMN pdf_url TEXT;
  END IF;

  -- Campo para fecha de generación del PDF
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monthly_reports' AND column_name = 'pdf_generated_at') THEN
    ALTER TABLE monthly_reports ADD COLUMN pdf_generated_at TIMESTAMPTZ;
  END IF;

  -- Campo para fecha de envío
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monthly_reports' AND column_name = 'sent_at') THEN
    ALTER TABLE monthly_reports ADD COLUMN sent_at TIMESTAMPTZ;
  END IF;

  -- Campo para cantidad de servicios
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monthly_reports' AND column_name = 'services_count') THEN
    ALTER TABLE monthly_reports ADD COLUMN services_count INTEGER DEFAULT 0;
  END IF;

  -- Campo para content (HTML del informe)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monthly_reports' AND column_name = 'content') THEN
    ALTER TABLE monthly_reports ADD COLUMN content TEXT;
  END IF;

  -- Campo para summary
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monthly_reports' AND column_name = 'summary') THEN
    ALTER TABLE monthly_reports ADD COLUMN summary TEXT;
  END IF;

  -- Campo para title
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monthly_reports' AND column_name = 'title') THEN
    ALTER TABLE monthly_reports ADD COLUMN title TEXT;
  END IF;
END $$;

-- Habilitar RLS en report_sends si no está habilitado
ALTER TABLE report_sends ENABLE ROW LEVEL SECURITY;

-- Políticas para report_sends
DROP POLICY IF EXISTS "Supervisor can manage report sends" ON report_sends;
DROP POLICY IF EXISTS "Admin can view report sends" ON report_sends;

CREATE POLICY "Supervisor can manage report sends"
  ON report_sends FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('supervisor', 'admin')
    )
  );

CREATE POLICY "Admin can view report sends"
  ON report_sends FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Función para incrementar services_count
CREATE OR REPLACE FUNCTION increment_services_count(report_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE monthly_reports 
  SET services_count = COALESCE(services_count, 0) + 1
  WHERE id = report_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
