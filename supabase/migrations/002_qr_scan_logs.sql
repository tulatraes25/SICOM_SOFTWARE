-- =====================================================
-- SICOM QR Ascensores - Tabla de escaneos QR
-- Versión: 1.0.1
-- Fecha: 2026-07-04
-- =====================================================

CREATE TABLE IF NOT EXISTS qr_scan_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  elevator_id UUID NOT NULL REFERENCES elevators(id) ON DELETE CASCADE,
  qr_token TEXT NOT NULL,
  scanned_at TIMESTAMPTZ DEFAULT NOW(),
  user_agent TEXT,
  ip_address INET,
  referrer TEXT
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_qr_scan_logs_elevator ON qr_scan_logs(elevator_id);
CREATE INDEX IF NOT EXISTS idx_qr_scan_logs_token ON qr_scan_logs(qr_token);
CREATE INDEX IF NOT EXISTS idx_qr_scan_logs_date ON qr_scan_logs(scanned_at);

-- Habilitar RLS
ALTER TABLE qr_scan_logs ENABLE ROW LEVEL SECURITY;

-- Política para permitir inserción desde frontend (anon)
CREATE POLICY "Allow anonymous insert for QR scans"
  ON qr_scan_logs FOR INSERT
  WITH CHECK (true);

-- Solo admin puede ver los logs
CREATE POLICY "Admin can view QR scan logs"
  ON qr_scan_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
