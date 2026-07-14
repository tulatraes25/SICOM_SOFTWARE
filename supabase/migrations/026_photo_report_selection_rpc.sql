-- =====================================================
-- SICOM Patagonia SRL - RPC para selección de fotos
-- Versión: 1.0.26
-- Fecha: 2026-07-14
-- =====================================================

-- RPC para actualizar include_in_report de una foto
CREATE OR REPLACE FUNCTION set_service_photo_report_selection(
  p_photo_id UUID,
  p_include BOOLEAN
)
RETURNS BOOLEAN AS $$
DECLARE
  v_profile RECORD;
  v_photo RECORD;
BEGIN
  -- Verificar usuario
  SELECT * INTO v_profile FROM profiles WHERE id = auth.uid() AND active = true;
  IF v_profile IS NULL OR v_profile.role NOT IN ('admin', 'supervisor') THEN
    RAISE EXCEPTION 'No tenés permisos';
  END IF;

  -- Verificar que la foto existe
  SELECT * INTO v_photo FROM service_photos WHERE id = p_photo_id;
  IF v_photo IS NULL THEN
    RAISE EXCEPTION 'Fotografía no encontrada';
  END IF;

  -- Actualizar solo include_in_report
  UPDATE service_photos
  SET include_in_report = p_include
  WHERE id = p_photo_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Permisos
GRANT EXECUTE ON FUNCTION set_service_photo_report_selection(UUID, BOOLEAN) TO authenticated;
