-- =====================================================
-- SICOM Patagonia SRL - Campos IA para informes
-- Versión: 1.0.9
-- Fecha: 2026-07-09
-- =====================================================

-- Campo para borrador generado por IA
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_records' AND column_name = 'ai_report_draft') THEN
    ALTER TABLE service_records ADD COLUMN ai_report_draft TEXT;
  END IF;

  -- Campo para informe final revisado
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_records' AND column_name = 'final_report_text') THEN
    ALTER TABLE service_records ADD COLUMN final_report_text TEXT;
  END IF;
END $$;
