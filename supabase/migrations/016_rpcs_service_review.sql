-- =====================================================
-- SICOM Patagonia SRL - RPCs de Revisión y Protección
-- Versión: 1.0.16
-- Fecha: 2026-07-13
-- =====================================================

-- =====================================================
-- FUNCIÓN: start_service_review
-- Transición: submitted → in_review
-- =====================================================
CREATE OR REPLACE FUNCTION start_service_review(p_service_record_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_profile RECORD;
  v_record RECORD;
BEGIN
  -- Verificar que el usuario sea admin o supervisor
  SELECT * INTO v_profile FROM profiles WHERE id = auth.uid() AND active = true;
  IF v_profile IS NULL OR v_profile.role NOT IN ('admin', 'supervisor') THEN
    RETURN jsonb_build_object('error', 'No tenés permisos para realizar esta acción');
  END IF;

  -- Obtener el registro
  SELECT * INTO v_record FROM service_records WHERE id = p_service_record_id;
  IF v_record IS NULL THEN
    RETURN jsonb_build_object('error', 'Registro no encontrado');
  END IF;

  -- Validar transición
  IF v_record.status != 'submitted' THEN
    RETURN jsonb_build_object('error', 'Solo se puede revisar registros en estado enviado');
  END IF;

  -- Actualizar
  UPDATE service_records SET
    status = 'in_review',
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_service_record_id;

  -- Audit
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id)
  VALUES (auth.uid(), 'start_review', 'service_record', p_service_record_id);

  RETURN jsonb_build_object('success', true, 'status', 'in_review');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: save_review_report
-- Guarda el informe del supervisor (campos protegidos)
-- =====================================================
CREATE OR REPLACE FUNCTION save_review_report(
  p_service_record_id UUID,
  p_ai_report_draft TEXT,
  p_final_report_text TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_profile RECORD;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = auth.uid() AND active = true;
  IF v_profile IS NULL OR v_profile.role NOT IN ('admin', 'supervisor') THEN
    RETURN jsonb_build_object('error', 'No tenés permisos');
  END IF;

  UPDATE service_records SET
    ai_report_draft = p_ai_report_draft,
    final_report_text = p_final_report_text,
    updated_at = NOW()
  WHERE id = p_service_record_id;

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id)
  VALUES (auth.uid(), 'save_report', 'service_record', p_service_record_id);

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: approve_service_record
-- Transición: submitted/in_review → approved
-- =====================================================
CREATE OR REPLACE FUNCTION approve_service_record(p_service_record_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_profile RECORD;
  v_record RECORD;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = auth.uid() AND active = true;
  IF v_profile IS NULL OR v_profile.role NOT IN ('admin', 'supervisor') THEN
    RETURN jsonb_build_object('error', 'No tenés permisos');
  END IF;

  SELECT * INTO v_record FROM service_records WHERE id = p_service_record_id;
  IF v_record IS NULL THEN
    RETURN jsonb_build_object('error', 'Registro no encontrado');
  END IF;

  -- Validar transición
  IF v_record.status NOT IN ('submitted', 'in_review') THEN
    RETURN jsonb_build_object('error', 'Solo se pueden aprobar registros enviados o en revisión');
  END IF;

  UPDATE service_records SET
    status = 'approved',
    approved_by = auth.uid(),
    approved_at = NOW(),
    updated_at = NOW()
  WHERE id = p_service_record_id;

  -- Actualizar estado del ascensor
  UPDATE elevators SET
    operational_status = v_record.operational_status_at_service,
    conservation_status = v_record.conservation_status_at_service,
    last_service_date = v_record.service_date,
    updated_at = NOW()
  WHERE id = v_record.elevator_id;

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id)
  VALUES (auth.uid(), 'approve', 'service_record', p_service_record_id);

  RETURN jsonb_build_object('success', true, 'status', 'approved');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: reject_service_record
-- Transición: submitted/in_review → rejected
-- =====================================================
CREATE OR REPLACE FUNCTION reject_service_record(
  p_service_record_id UUID,
  p_rejection_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_profile RECORD;
  v_record RECORD;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = auth.uid() AND active = true;
  IF v_profile IS NULL OR v_profile.role NOT IN ('admin', 'supervisor') THEN
    RETURN jsonb_build_object('error', 'No tenés permisos');
  END IF;

  SELECT * INTO v_record FROM service_records WHERE id = p_service_record_id;
  IF v_record IS NULL THEN
    RETURN jsonb_build_object('error', 'Registro no encontrado');
  END IF;

  IF v_record.status NOT IN ('submitted', 'in_review') THEN
    RETURN jsonb_build_object('error', 'Solo se pueden rechazar registros enviados o en revisión');
  END IF;

  UPDATE service_records SET
    status = 'rejected',
    rejection_reason = p_rejection_reason,
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_service_record_id;

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data)
  VALUES (auth.uid(), 'reject', 'service_record', p_service_record_id,
          jsonb_build_object('reason', p_rejection_reason));

  RETURN jsonb_build_object('success', true, 'status', 'rejected');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Otorgar ejecución a authenticated
GRANT EXECUTE ON FUNCTION start_service_review(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION save_review_report(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_service_record(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_service_record(UUID, TEXT) TO authenticated;
