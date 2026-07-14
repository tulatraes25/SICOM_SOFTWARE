-- =====================================================
-- SICOM Patagonia SRL - Photos include_in_report
-- Versión: 1.0.25
-- Fecha: 2026-07-14
-- =====================================================

-- Agregar campo para decidir inclusión en PDF
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_photos' AND column_name = 'include_in_report') THEN
    ALTER TABLE service_photos ADD COLUMN include_in_report BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_photos' AND column_name = 'report_order') THEN
    ALTER TABLE service_photos ADD COLUMN report_order INTEGER DEFAULT 0;
  END IF;
END $$;
