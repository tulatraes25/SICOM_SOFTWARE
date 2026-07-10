-- =====================================================
-- SICOM Patagonia SRL - Tabla de envíos de informes de servicio
-- Versión: 1.0.10
-- Fecha: 2026-07-09
-- =====================================================

-- Tabla para registrar envíos de informes de servicio por correo
CREATE TABLE IF NOT EXISTS service_report_sends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_record_id UUID NOT NULL REFERENCES service_records(id) ON DELETE CASCADE,
  elevator_id UUID REFERENCES elevators(id) ON DELETE SET NULL,
  recipient_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  sent_by UUID REFERENCES profiles(id),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_service_report_sends_record ON service_report_sends(service_record_id);
CREATE INDEX IF NOT EXISTS idx_service_report_sends_elevator ON service_report_sends(elevator_id);

-- RLS
ALTER TABLE service_report_sends ENABLE ROW LEVEL SECURITY;

-- Admin/supervisor pueden ver y crear envíos
CREATE POLICY "Admin/supervisor can manage service report sends"
ON service_report_sends FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'supervisor')
    AND active = true
  )
);
