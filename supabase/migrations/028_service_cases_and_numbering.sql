-- 028: Service cases (expediente maestro) and secure numbering
-- Idempotent where possible. Does NOT delete existing data.

-- ============================================================
-- 1. TABLES
-- ============================================================

-- Central entity: one case = one expedition number
CREATE TABLE IF NOT EXISTS service_cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_number INTEGER NOT NULL,
  numbering_mode TEXT NOT NULL CHECK (numbering_mode IN ('test', 'production')),
  origin_type TEXT NOT NULL CHECK (origin_type IN ('budget', 'claim', 'direct_report', 'scheduled_service', 'other')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'in_progress', 'completed', 'closed', 'cancelled')),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  building_id UUID REFERENCES buildings(id) ON DELETE SET NULL,
  elevator_id UUID REFERENCES elevators(id) ON DELETE SET NULL,
  title TEXT,
  description TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT
);

-- Single-row configuration for numbering
CREATE TABLE IF NOT EXISTS document_numbering_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true,
  current_mode TEXT NOT NULL DEFAULT 'test' CHECK (current_mode IN ('test', 'production')),
  next_test_number INTEGER NOT NULL DEFAULT 1900 CHECK (next_test_number >= 1900 AND next_test_number <= 2000),
  next_production_number INTEGER NOT NULL DEFAULT 2000 CHECK (next_production_number >= 2000),
  production_activated_at TIMESTAMPTZ,
  production_activated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit events for service cases
CREATE TABLE IF NOT EXISTS service_case_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_case_id UUID NOT NULL REFERENCES service_cases(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('case_created', 'assigned', 'closed', 'cancelled', 'production_numbering_activated')),
  performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. INDEXES
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_cases_number ON service_cases(case_number);
CREATE INDEX IF NOT EXISTS idx_service_cases_client ON service_cases(client_id);
CREATE INDEX IF NOT EXISTS idx_service_cases_building ON service_cases(building_id);
CREATE INDEX IF NOT EXISTS idx_service_cases_elevator ON service_cases(elevator_id);
CREATE INDEX IF NOT EXISTS idx_service_cases_status ON service_cases(status);
CREATE INDEX IF NOT EXISTS idx_service_cases_created ON service_cases(created_at);
CREATE INDEX IF NOT EXISTS idx_service_case_events_case ON service_case_events(service_case_id);
CREATE INDEX IF NOT EXISTS idx_service_case_events_created ON service_case_events(created_at);

-- ============================================================
-- 3. LINK TO SERVICE_RECORDS
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_records' AND column_name = 'service_case_id'
  ) THEN
    ALTER TABLE service_records ADD COLUMN service_case_id UUID REFERENCES service_cases(id) ON DELETE SET NULL;
    CREATE INDEX idx_service_records_service_case ON service_records(service_case_id);
  END IF;
END $$;

-- ============================================================
-- 4. INITIAL CONFIGURATION (idempotent)
-- ============================================================

INSERT INTO document_numbering_settings (id, current_mode, next_test_number, next_production_number)
VALUES (true, 'test', 1900, 2000)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 5. RLS
-- ============================================================

ALTER TABLE service_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_numbering_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_case_events ENABLE ROW LEVEL SECURITY;

-- service_cases policies
DO $$
BEGIN
  -- Drop existing policies if they exist (idempotent)
  DROP POLICY IF EXISTS "service_cases_admin_select" ON service_cases;
  DROP POLICY IF EXISTS "service_cases_supervisor_select" ON service_cases;
  DROP POLICY IF EXISTS "service_cases_technician_select" ON service_cases;

  -- Admin: full read access
  CREATE POLICY "service_cases_admin_select" ON service_cases
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

  -- Supervisor: full read access
  CREATE POLICY "service_cases_supervisor_select" ON service_cases
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'supervisor')
    );

  -- Technician: read only assigned cases
  CREATE POLICY "service_cases_technician_select" ON service_cases
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'technician')
      AND assigned_to = auth.uid()
    );
END $$;

-- document_numbering_settings policies
DO $$
BEGIN
  DROP POLICY IF EXISTS "numbering_settings_admin_select" ON document_numbering_settings;
  DROP POLICY IF EXISTS "numbering_settings_supervisor_select" ON document_numbering_settings;

  CREATE POLICY "numbering_settings_admin_select" ON document_numbering_settings
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

  CREATE POLICY "numbering_settings_supervisor_select" ON document_numbering_settings
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'supervisor')
    );
END $$;

-- service_case_events policies
DO $$
BEGIN
  DROP POLICY IF EXISTS "case_events_admin_select" ON service_case_events;
  DROP POLICY IF EXISTS "case_events_supervisor_select" ON service_case_events;

  CREATE POLICY "case_events_admin_select" ON service_case_events
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

  CREATE POLICY "case_events_supervisor_select" ON service_case_events
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'supervisor')
    );
END $$;

-- ============================================================
-- 6. RPC: create_service_case
-- ============================================================

CREATE OR REPLACE FUNCTION create_service_case(
  p_origin_type TEXT,
  p_client_id UUID DEFAULT NULL,
  p_building_id UUID DEFAULT NULL,
  p_elevator_id UUID DEFAULT NULL,
  p_title TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_assigned_to UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_settings RECORD;
  v_case_number INTEGER;
  v_mode TEXT;
  v_new_case service_cases;
BEGIN
  -- Validate auth
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No autenticado');
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_user_id AND active = true;
  IF v_role IS NULL THEN
    RETURN jsonb_build_object('error', 'Perfil no encontrado o inactivo');
  END IF;

  IF v_role NOT IN ('admin', 'supervisor') THEN
    RETURN jsonb_build_object('error', 'Sin permisos para crear expedientes');
  END IF;

  -- Lock and read numbering settings
  SELECT * INTO v_settings FROM document_numbering_settings
  WHERE id = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Configuración de numeración no encontrada');
  END IF;

  -- Determine number
  v_mode := v_settings.current_mode;

  IF v_mode = 'test' THEN
    v_case_number := v_settings.next_test_number;
    IF v_case_number > 1999 THEN
      RETURN jsonb_build_object('error', 'Se agotaron los números de prueba (1900-1999). Active la numeración productiva.');
    END IF;
    UPDATE document_numbering_settings
    SET next_test_number = next_test_number + 1, updated_at = NOW()
    WHERE id = true;
  ELSE
    v_case_number := v_settings.next_production_number;
    UPDATE document_numbering_settings
    SET next_production_number = next_production_number + 1, updated_at = NOW()
    WHERE id = true;
  END IF;

  -- Create case
  INSERT INTO service_cases (
    case_number, numbering_mode, origin_type, status,
    client_id, building_id, elevator_id,
    title, description, created_by, assigned_to
  ) VALUES (
    v_case_number, v_mode, p_origin_type, 'open',
    p_client_id, p_building_id, p_elevator_id,
    p_title, p_description, v_user_id, p_assigned_to
  )
  RETURNING * INTO v_new_case;

  -- Log event
  INSERT INTO service_case_events (service_case_id, event_type, performed_by, details)
  VALUES (v_new_case.id, 'case_created', v_user_id, jsonb_build_object(
    'origin_type', p_origin_type,
    'case_number', v_case_number,
    'numbering_mode', v_mode
  ));

  -- Audit log
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data)
  VALUES (v_user_id, 'create', 'service_cases', v_new_case.id, to_jsonb(v_new_case));

  RETURN jsonb_build_object(
    'id', v_new_case.id,
    'case_number', v_new_case.case_number,
    'numbering_mode', v_new_case.numbering_mode,
    'origin_type', v_new_case.origin_type,
    'status', v_new_case.status
  );
END;
$$;

REVOKE ALL ON FUNCTION create_service_case(TEXT, UUID, UUID, UUID, TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_service_case(TEXT, UUID, UUID, UUID, TEXT, TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION create_service_case(TEXT, UUID, UUID, UUID, TEXT, TEXT, UUID) TO authenticated;

-- ============================================================
-- 7. RPC: activate_production_numbering
-- ============================================================

CREATE OR REPLACE FUNCTION activate_production_numbering()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_settings RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No autenticado');
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_user_id AND active = true;
  IF v_role IS DISTINCT FROM 'admin' THEN
    RETURN jsonb_build_object('error', 'Solo administradores pueden activar numeración productiva');
  END IF;

  SELECT * INTO v_settings FROM document_numbering_settings
  WHERE id = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Configuración no encontrada');
  END IF;

  IF v_settings.current_mode = 'production' THEN
    RETURN jsonb_build_object(
      'error', 'La numeración productiva ya está activa',
      'current_mode', 'production',
      'next_production_number', v_settings.next_production_number
    );
  END IF;

  UPDATE document_numbering_settings
  SET
    current_mode = 'production',
    next_production_number = GREATEST(next_production_number, 2000),
    production_activated_at = NOW(),
    production_activated_by = v_user_id,
    updated_at = NOW()
  WHERE id = true;

  -- Audit log
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data)
  VALUES (v_user_id, 'activate_production', 'document_numbering_settings', NULL, jsonb_build_object(
    'previous_mode', 'test',
    'new_mode', 'production',
    'next_production_number', GREATEST(v_settings.next_production_number, 2000)
  ));

  RETURN jsonb_build_object(
    'success', true,
    'current_mode', 'production',
    'next_production_number', GREATEST(v_settings.next_production_number, 2000)
  );
END;
$$;

REVOKE ALL ON FUNCTION activate_production_numbering() FROM PUBLIC;
REVOKE ALL ON FUNCTION activate_production_numbering() FROM anon;
GRANT EXECUTE ON FUNCTION activate_production_numbering() TO authenticated;

-- ============================================================
-- 8. RPC: cancel_service_case
-- ============================================================

CREATE OR REPLACE FUNCTION cancel_service_case(
  p_case_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_case service_cases;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No autenticado');
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_user_id AND active = true;
  IF v_role NOT IN ('admin', 'supervisor') THEN
    RETURN jsonb_build_object('error', 'Sin permisos para anular expedientes');
  END IF;

  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RETURN jsonb_build_object('error', 'El motivo de anulación es obligatorio');
  END IF;

  SELECT * INTO v_case FROM service_cases WHERE id = p_case_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Expediente no encontrado');
  END IF;

  IF v_case.status = 'cancelled' THEN
    RETURN jsonb_build_object('error', 'El expediente ya está anulado');
  END IF;

  IF v_case.status = 'closed' THEN
    RETURN jsonb_build_object('error', 'No se puede anular un expediente cerrado');
  END IF;

  UPDATE service_cases
  SET
    status = 'cancelled',
    cancelled_at = NOW(),
    cancellation_reason = TRIM(p_reason),
    updated_at = NOW()
  WHERE id = p_case_id
  RETURNING * INTO v_case;

  INSERT INTO service_case_events (service_case_id, event_type, performed_by, details)
  VALUES (p_case_id, 'cancelled', v_user_id, jsonb_build_object('reason', TRIM(p_reason)));

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data)
  VALUES (v_user_id, 'cancel', 'service_cases', p_case_id, to_jsonb(v_case));

  RETURN jsonb_build_object(
    'success', true,
    'case_number', v_case.case_number,
    'status', 'cancelled'
  );
END;
$$;

REVOKE ALL ON FUNCTION cancel_service_case(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION cancel_service_case(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION cancel_service_case(UUID, TEXT) TO authenticated;

-- ============================================================
-- 9. RPC: close_service_case
-- ============================================================

CREATE OR REPLACE FUNCTION close_service_case(
  p_case_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_case service_cases;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No autenticado');
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_user_id AND active = true;
  IF v_role NOT IN ('admin', 'supervisor') THEN
    RETURN jsonb_build_object('error', 'Sin permisos para cerrar expedientes');
  END IF;

  SELECT * INTO v_case FROM service_cases WHERE id = p_case_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Expediente no encontrado');
  END IF;

  IF v_case.status = 'closed' THEN
    RETURN jsonb_build_object('error', 'El expediente ya está cerrado');
  END IF;

  IF v_case.status = 'cancelled' THEN
    RETURN jsonb_build_object('error', 'No se puede cerrar un expediente anulado');
  END IF;

  UPDATE service_cases
  SET
    status = 'closed',
    closed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_case_id
  RETURNING * INTO v_case;

  INSERT INTO service_case_events (service_case_id, event_type, performed_by, details)
  VALUES (p_case_id, 'closed', v_user_id, '{}');

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data)
  VALUES (v_user_id, 'close', 'service_cases', p_case_id, to_jsonb(v_case));

  RETURN jsonb_build_object(
    'success', true,
    'case_number', v_case.case_number,
    'status', 'closed'
  );
END;
$$;

REVOKE ALL ON FUNCTION close_service_case(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION close_service_case(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION close_service_case(UUID) TO authenticated;

-- ============================================================
-- 10. RPC: get_numbering_settings
-- ============================================================

CREATE OR REPLACE FUNCTION get_numbering_settings()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_settings RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No autenticado');
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_user_id AND active = true;
  IF v_role IS NULL THEN
    RETURN jsonb_build_object('error', 'Perfil no encontrado');
  END IF;

  IF v_role NOT IN ('admin', 'supervisor') THEN
    RETURN jsonb_build_object('error', 'Sin permisos');
  END IF;

  SELECT * INTO v_settings FROM document_numbering_settings WHERE id = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Configuración no encontrada');
  END IF;

  RETURN jsonb_build_object(
    'current_mode', v_settings.current_mode,
    'next_test_number', v_settings.next_test_number,
    'next_production_number', v_settings.next_production_number,
    'production_activated_at', v_settings.production_activated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION get_numbering_settings() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_numbering_settings() FROM anon;
GRANT EXECUTE ON FUNCTION get_numbering_settings() TO authenticated;

-- ============================================================
-- 11. updated_at TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_service_cases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_service_cases_updated_at ON service_cases;
CREATE TRIGGER trigger_service_cases_updated_at
  BEFORE UPDATE ON service_cases
  FOR EACH ROW
  EXECUTE FUNCTION update_service_cases_updated_at();

-- ============================================================
-- DONE
-- ============================================================
