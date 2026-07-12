-- =====================================================
-- SICOM Patagonia SRL - RPC para historial público
-- Versión: 1.0.13
-- Fecha: 2026-07-12
-- =====================================================

-- Función para obtener historial público de mantenimientos aprobados
CREATE OR REPLACE FUNCTION get_public_service_history(p_elevator_id UUID)
RETURNS TABLE (
  service_date DATE,
  service_type TEXT,
  operational_status TEXT,
  conservation_status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sr.service_date,
    sr.service_type,
    sr.operational_status_at_service,
    sr.conservation_status_at_service
  FROM service_records sr
  WHERE sr.elevator_id = p_elevator_id
    AND sr.status = 'approved'
  ORDER BY sr.service_date DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permitir ejecución anónima
GRANT EXECUTE ON FUNCTION get_public_service_history(UUID) TO anon;
