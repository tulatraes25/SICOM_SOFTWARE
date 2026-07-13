-- =====================================================
-- SICOM Patagonia SRL - Seguridad Portal Público QR
-- Versión: 1.0.19
-- Fecha: 2026-07-13
-- =====================================================

-- =====================================================
-- RPC: get_public_elevator_by_token
-- Datos públicos del ascensor por token
-- =====================================================
DROP FUNCTION IF EXISTS get_public_elevator_by_token(text);

CREATE OR REPLACE FUNCTION get_public_elevator_by_token(p_token TEXT)
RETURNS TABLE (
  code TEXT,
  elevator_type TEXT,
  manufacturer TEXT,
  model TEXT,
  building_name TEXT,
  building_address TEXT,
  building_locality TEXT,
  building_province TEXT,
  operational_status TEXT,
  conservation_status TEXT,
  last_service_date DATE,
  company_name TEXT
) AS $$
BEGIN
  -- Validar token
  IF p_token IS NULL OR p_token = '' OR length(p_token) > 50 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    e.code,
    e.elevator_type,
    e.manufacturer,
    e.model,
    b.name,
    b.address,
    b.locality,
    b.province,
    e.operational_status,
    e.conservation_status,
    e.last_service_date,
    'SICOM Patagonia SRL'::TEXT
  FROM elevators e
  LEFT JOIN buildings b ON b.id = e.building_id
  WHERE e.qr_token = p_token
    AND e.active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- =====================================================
-- RPC: get_public_elevator_history_by_token
-- Últimos mantenimientos aprobados
-- =====================================================
DROP FUNCTION IF EXISTS get_public_elevator_history_by_token(text, integer);

CREATE OR REPLACE FUNCTION get_public_elevator_history_by_token(
  p_token TEXT,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  service_date DATE,
  service_type TEXT,
  operational_status TEXT,
  conservation_status TEXT
) AS $$
DECLARE
  v_elevator_id UUID;
  v_max_limit INTEGER;
BEGIN
  -- Validar token
  IF p_token IS NULL OR p_token = '' OR length(p_token) > 50 THEN
    RETURN;
  END IF;

  -- Limitar máximo
  v_max_limit := LEAST(GREATEST(p_limit, 1), 10);

  -- Obtener elevator_id
  SELECT id INTO v_elevator_id
  FROM elevators
  WHERE qr_token = p_token AND active = true;

  IF v_elevator_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    sr.service_date,
    sr.service_type,
    sr.operational_status_at_service,
    sr.conservation_status_at_service
  FROM service_records sr
  WHERE sr.elevator_id = v_elevator_id
    AND sr.status = 'approved'
  ORDER BY sr.service_date DESC
  LIMIT v_max_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- =====================================================
-- RPC: register_public_qr_scan
-- Registrar escaneo de forma segura
-- =====================================================
DROP FUNCTION IF EXISTS register_public_qr_scan(text, text);

CREATE OR REPLACE FUNCTION register_public_qr_scan(
  p_token TEXT,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_elevator_id UUID;
  v_ua TEXT;
BEGIN
  -- Validar token
  IF p_token IS NULL OR p_token = '' OR length(p_token) > 50 THEN
    RETURN FALSE;
  END IF;

  -- Limitar user_agent
  v_ua := LEFT(COALESCE(p_user_agent, ''), 500);

  -- Obtener elevator_id
  SELECT id INTO v_elevator_id
  FROM elevators
  WHERE qr_token = p_token AND active = true;

  IF v_elevator_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Insertar registro
  INSERT INTO qr_scan_logs (elevator_id, qr_token, user_agent, scanned_at)
  VALUES (v_elevator_id, p_token, v_ua, NOW());

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- =====================================================
-- PERMISOS
-- =====================================================
REVOKE ALL ON FUNCTION get_public_elevator_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_public_elevator_by_token(text) TO anon;
GRANT EXECUTE ON FUNCTION get_public_elevator_by_token(text) TO authenticated;

REVOKE ALL ON FUNCTION get_public_elevator_history_by_token(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_public_elevator_history_by_token(text, integer) TO anon;
GRANT EXECUTE ON FUNCTION get_public_elevator_history_by_token(text, integer) TO authenticated;

REVOKE ALL ON FUNCTION register_public_qr_scan(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION register_public_qr_scan(text, text) TO anon;
GRANT EXECUTE ON FUNCTION register_public_qr_scan(text, text) TO authenticated;

-- =====================================================
-- REVOCAR ACCESO ANÓNIMO DIRECTO
-- =====================================================
-- Eliminar políticas que permitan SELECT directo a anon
DROP POLICY IF EXISTS "technician_select_own_service_records" ON service_records;
DROP POLICY IF EXISTS "supervisor_select_service_records" ON service_records;

-- Re-crear sin acceso anon
CREATE POLICY "technician_select_own_service_records"
  ON service_records FOR SELECT
  TO authenticated
  USING (
    technician_id = auth.uid()
  );

CREATE POLICY "supervisor_select_service_records"
  ON service_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'supervisor' AND active = true
    )
  );
