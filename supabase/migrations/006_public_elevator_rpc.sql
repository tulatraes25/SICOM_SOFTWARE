-- =====================================================
-- SICOM Patagonia Ascensores - RPC para vista pública QR
-- Versión: 1.0.5
-- Fecha: 2026-07-05
-- =====================================================

-- Función segura para obtener datos públicos del ascensor por token
CREATE OR REPLACE FUNCTION get_public_elevator_by_token(token TEXT)
RETURNS TABLE (
  id UUID,
  code TEXT,
  manufacturer TEXT,
  model TEXT,
  elevator_type TEXT,
  operational_status TEXT,
  conservation_status TEXT,
  contractual_status TEXT,
  last_service_date DATE,
  updated_at TIMESTAMPTZ,
  building_name TEXT,
  building_address TEXT,
  building_locality TEXT,
  building_province TEXT,
  client_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.code,
    e.manufacturer,
    e.model,
    e.elevator_type,
    e.operational_status,
    e.conservation_status,
    e.contractual_status,
    e.last_service_date,
    e.updated_at,
    b.name AS building_name,
    b.address AS building_address,
    b.locality AS building_locality,
    b.province AS building_province,
    c.name AS client_name
  FROM elevators e
  LEFT JOIN buildings b ON b.id = e.building_id
  LEFT JOIN clients c ON c.id = e.client_id
  WHERE e.qr_token = token
    AND e.active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permitir ejecución anónima (para vista pública)
GRANT EXECUTE ON FUNCTION get_public_elevator_by_token(TEXT) TO anon;

-- =====================================================
-- Bucket Storage para PDFs y fotos
-- =====================================================
-- NOTA: Estos buckets deben crearse desde Supabase Dashboard
-- Storage > New Bucket

-- Bucket: reports (para PDFs de informes)
-- Configurar como público si se quieren URLs directas
-- O privado con signed URLs para mayor seguridad

-- Bucket: service-photos (para fotos de mantenimiento)
-- Configurar como privado
