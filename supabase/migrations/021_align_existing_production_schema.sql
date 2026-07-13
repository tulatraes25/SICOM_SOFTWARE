-- =====================================================
-- SICOM Patagonia SRL - Migración Incremental 021
-- Versión: 1.0.21
-- Fecha: 2026-07-14
-- =====================================================
-- Esta migración es IDEMPOTENTE y NO DESTRUCTIVA.
-- Puede ejecutarse sobre una base que ya tenga 001-019.
-- No crea tablas nuevas.
-- No borra datos.
-- Solo agrega o corrige lo que falte.
-- =====================================================

-- =====================================================
-- 1. CAMPOS DE IA EN service_records
-- =====================================================
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_records' AND column_name = 'ai_report_draft') THEN
    ALTER TABLE service_records ADD COLUMN ai_report_draft TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_records' AND column_name = 'final_report_text') THEN
    ALTER TABLE service_records ADD COLUMN final_report_text TEXT;
  END IF;
END $$;

-- =====================================================
-- 2. CAMPOS EN monthly_reports
-- =====================================================
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monthly_reports' AND column_name = 'pdf_url') THEN
    ALTER TABLE monthly_reports ADD COLUMN pdf_url TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monthly_reports' AND column_name = 'pdf_generated_at') THEN
    ALTER TABLE monthly_reports ADD COLUMN pdf_generated_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monthly_reports' AND column_name = 'sent_at') THEN
    ALTER TABLE monthly_reports ADD COLUMN sent_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monthly_reports' AND column_name = 'services_count') THEN
    ALTER TABLE monthly_reports ADD COLUMN services_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- =====================================================
-- 3. TABLA building_report_recipients
-- =====================================================
CREATE TABLE IF NOT EXISTS building_report_recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_building_recipients_building ON building_report_recipients(building_id);

-- =====================================================
-- 4. TABLA service_report_sends
-- =====================================================
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

CREATE INDEX IF NOT EXISTS idx_service_report_sends_record ON service_report_sends(service_record_id);

-- =====================================================
-- 5. RPCs SEGURAS (CREATE OR REPLACE)
-- =====================================================

-- get_public_elevator_by_token
CREATE OR REPLACE FUNCTION get_public_elevator_by_token(p_token TEXT)
RETURNS TABLE (
  code TEXT, elevator_type TEXT, manufacturer TEXT, model TEXT,
  building_name TEXT, building_address TEXT, building_locality TEXT,
  building_province TEXT, operational_status TEXT, conservation_status TEXT,
  last_service_date DATE, company_name TEXT
) AS $$
BEGIN
  IF p_token IS NULL OR p_token = '' OR length(p_token) > 50 THEN RETURN; END IF;
  RETURN QUERY
  SELECT e.code, e.elevator_type, e.manufacturer, e.model,
    b.name, b.address, b.locality, b.province,
    e.operational_status, e.conservation_status, e.last_service_date,
    'SICOM Patagonia SRL'::TEXT
  FROM elevators e LEFT JOIN buildings b ON b.id = e.building_id
  WHERE e.qr_token = p_token AND e.active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- get_public_elevator_history_by_token
CREATE OR REPLACE FUNCTION get_public_elevator_history_by_token(p_token TEXT, p_limit INTEGER DEFAULT 5)
RETURNS TABLE (service_date DATE, service_type TEXT, operational_status TEXT, conservation_status TEXT) AS $$
DECLARE
  v_elevator_id UUID;
  v_max_limit INTEGER;
BEGIN
  IF p_token IS NULL OR p_token = '' OR length(p_token) > 50 THEN RETURN; END IF;
  v_max_limit := LEAST(GREATEST(p_limit, 1), 10);
  SELECT id INTO v_elevator_id FROM elevators WHERE qr_token = p_token AND active = true;
  IF v_elevator_id IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT sr.service_date, sr.service_type, sr.operational_status_at_service, sr.conservation_status_at_service
  FROM service_records sr
  WHERE sr.elevator_id = v_elevator_id AND sr.status = 'approved'
  ORDER BY sr.service_date DESC LIMIT v_max_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- register_public_qr_scan
CREATE OR REPLACE FUNCTION register_public_qr_scan(p_token TEXT, p_user_agent TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE v_elevator_id UUID; v_ua TEXT;
BEGIN
  IF p_token IS NULL OR p_token = '' OR length(p_token) > 50 THEN RETURN FALSE; END IF;
  v_ua := LEFT(COALESCE(p_user_agent, ''), 500);
  SELECT id INTO v_elevator_id FROM elevators WHERE qr_token = p_token AND active = true;
  IF v_elevator_id IS NULL THEN RETURN FALSE; END IF;
  INSERT INTO qr_scan_logs (elevator_id, qr_token, user_agent, scanned_at) VALUES (v_elevator_id, p_token, v_ua, NOW());
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- start_service_review
CREATE OR REPLACE FUNCTION start_service_review(p_service_record_id UUID)
RETURNS JSONB AS $$
DECLARE v_profile RECORD; v_record RECORD;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = auth.uid() AND active = true;
  IF v_profile IS NULL OR v_profile.role NOT IN ('admin', 'supervisor') THEN
    RETURN jsonb_build_object('error', 'No tenés permisos');
  END IF;
  SELECT * INTO v_record FROM service_records WHERE id = p_service_record_id;
  IF v_record IS NULL THEN RETURN jsonb_build_object('error', 'Registro no encontrado'); END IF;
  IF v_record.status != 'submitted' THEN
    RETURN jsonb_build_object('error', 'Solo se puede revisar registros en estado enviado');
  END IF;
  UPDATE service_records SET status = 'in_review', reviewed_by = auth.uid(), reviewed_at = NOW(), updated_at = NOW()
  WHERE id = p_service_record_id;
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES (auth.uid(), 'start_review', 'service_record', p_service_record_id);
  RETURN jsonb_build_object('success', true, 'status', 'in_review');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- save_review_report
CREATE OR REPLACE FUNCTION save_review_report(p_service_record_id UUID, p_ai_report_draft TEXT, p_final_report_text TEXT)
RETURNS JSONB AS $$
DECLARE v_profile RECORD;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = auth.uid() AND active = true;
  IF v_profile IS NULL OR v_profile.role NOT IN ('admin', 'supervisor') THEN
    RETURN jsonb_build_object('error', 'No tenés permisos');
  END IF;
  UPDATE service_records SET ai_report_draft = p_ai_report_draft, final_report_text = p_final_report_text, updated_at = NOW()
  WHERE id = p_service_record_id;
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES (auth.uid(), 'save_report', 'service_record', p_service_record_id);
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- approve_service_record
CREATE OR REPLACE FUNCTION approve_service_record(p_service_record_id UUID)
RETURNS JSONB AS $$
DECLARE v_profile RECORD; v_record RECORD;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = auth.uid() AND active = true;
  IF v_profile IS NULL OR v_profile.role NOT IN ('admin', 'supervisor') THEN
    RETURN jsonb_build_object('error', 'No tenés permisos');
  END IF;
  SELECT * INTO v_record FROM service_records WHERE id = p_service_record_id;
  IF v_record IS NULL THEN RETURN jsonb_build_object('error', 'Registro no encontrado'); END IF;
  IF v_record.status NOT IN ('submitted', 'in_review') THEN
    RETURN jsonb_build_object('error', 'Solo se pueden aprobar registros enviados o en revisión');
  END IF;
  UPDATE service_records SET status = 'approved', approved_by = auth.uid(), approved_at = NOW(), updated_at = NOW()
  WHERE id = p_service_record_id;
  UPDATE elevators SET operational_status = v_record.operational_status_at_service, conservation_status = v_record.conservation_status_at_service,
    last_service_date = v_record.service_date, updated_at = NOW()
  WHERE id = v_record.elevator_id;
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES (auth.uid(), 'approve', 'service_record', p_service_record_id);
  RETURN jsonb_build_object('success', true, 'status', 'approved');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- reject_service_record
CREATE OR REPLACE FUNCTION reject_service_record(p_service_record_id UUID, p_rejection_reason TEXT)
RETURNS JSONB AS $$
DECLARE v_profile RECORD; v_record RECORD;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = auth.uid() AND active = true;
  IF v_profile IS NULL OR v_profile.role NOT IN ('admin', 'supervisor') THEN
    RETURN jsonb_build_object('error', 'No tenés permisos');
  END IF;
  SELECT * INTO v_record FROM service_records WHERE id = p_service_record_id;
  IF v_record IS NULL THEN RETURN jsonb_build_object('error', 'Registro no encontrado'); END IF;
  IF v_record.status NOT IN ('submitted', 'in_review') THEN
    RETURN jsonb_build_object('error', 'Solo se pueden rechazar registros enviados o en revisión');
  END IF;
  UPDATE service_records SET status = 'rejected', rejection_reason = p_rejection_reason,
    reviewed_by = auth.uid(), reviewed_at = NOW(), updated_at = NOW()
  WHERE id = p_service_record_id;
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data)
  VALUES (auth.uid(), 'reject', 'service_record', p_service_record_id, jsonb_build_object('reason', p_rejection_reason));
  RETURN jsonb_build_object('success', true, 'status', 'rejected');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- =====================================================
-- 6. PERMISOS DE FUNCIONES
-- =====================================================
GRANT EXECUTE ON FUNCTION get_public_elevator_by_token(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_public_elevator_by_token(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_public_elevator_history_by_token(TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION get_public_elevator_history_by_token(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION register_public_qr_scan(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION register_public_qr_scan(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION start_service_review(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION save_review_report(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_service_record(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_service_record(UUID, TEXT) TO authenticated;

-- =====================================================
-- 7. RLS PARA NUEVAS TABLAS
-- =====================================================

-- building_report_recipients
ALTER TABLE building_report_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can manage building recipients" ON building_report_recipients;
CREATE POLICY "Admin can manage building recipients"
ON building_report_recipients FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND active = true));

DROP POLICY IF EXISTS "Supervisor can view building recipients" ON building_report_recipients;
CREATE POLICY "Supervisor can view building recipients"
ON building_report_recipients FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'supervisor' AND active = true));

-- service_report_sends
ALTER TABLE service_report_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin/supervisor can manage report sends" ON service_report_sends;
CREATE POLICY "Admin/supervisor can manage report sends"
ON service_report_sends FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'supervisor') AND active = true));

-- =====================================================
-- 8. ELIMINAR UPDATE DIRECTO SUPERVISOR
-- =====================================================
DROP POLICY IF EXISTS "supervisor_update_service_records" ON service_records;
DROP POLICY IF EXISTS "Supervisor can update service records" ON service_records;
