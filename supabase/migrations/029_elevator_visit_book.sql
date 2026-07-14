-- 029: Elevator digital visit book
-- Idempotent where possible. Does NOT delete existing data.

-- ============================================================
-- 1. TABLES
-- ============================================================

-- Per-elevator numbering sequence
CREATE TABLE IF NOT EXISTS elevator_visit_numbering (
  elevator_id UUID PRIMARY KEY REFERENCES elevators(id) ON DELETE CASCADE,
  next_entry_number INTEGER NOT NULL DEFAULT 1 CHECK (next_entry_number >= 1),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Visit book entries
CREATE TABLE IF NOT EXISTS elevator_visit_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  elevator_id UUID NOT NULL REFERENCES elevators(id) ON DELETE RESTRICT,
  service_case_id UUID REFERENCES service_cases(id) ON DELETE SET NULL,
  service_record_id UUID REFERENCES service_records(id) ON DELETE SET NULL,
  entry_number INTEGER NOT NULL,
  visit_date DATE NOT NULL,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'scheduled_service', 'preventive_maintenance', 'corrective_maintenance',
    'claim_visit', 'inspection', 'emergency', 'verification', 'other'
  )),
  origin_type TEXT,
  title TEXT,
  description TEXT NOT NULL,
  work_performed TEXT,
  observations TEXT,
  recommendations TEXT,
  operational_status TEXT,
  conservation_status TEXT,
  technician_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  registered_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'submitted', 'approved', 'rectified', 'cancelled'
  )),
  is_rectification BOOLEAN NOT NULL DEFAULT false,
  rectifies_entry_id UUID REFERENCES elevator_visit_entries(id) ON DELETE SET NULL,
  cancellation_reason TEXT,
  technician_signature_id UUID,
  reviewer_signature_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add visit_entry_id to service_records for uniqueness
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_records' AND column_name = 'visit_entry_id'
  ) THEN
    ALTER TABLE service_records ADD COLUMN visit_entry_id UUID REFERENCES elevator_visit_entries(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 2. INDEXES
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_visit_entries_elevator_number
  ON elevator_visit_entries(elevator_id, entry_number);

CREATE INDEX IF NOT EXISTS idx_visit_entries_elevator ON elevator_visit_entries(elevator_id);
CREATE INDEX IF NOT EXISTS idx_visit_entries_service_record ON elevator_visit_entries(service_record_id);
CREATE INDEX IF NOT EXISTS idx_visit_entries_service_case ON elevator_visit_entries(service_case_id);
CREATE INDEX IF NOT EXISTS idx_visit_entries_visit_date ON elevator_visit_entries(visit_date);
CREATE INDEX IF NOT EXISTS idx_visit_entries_status ON elevator_visit_entries(status);
CREATE INDEX IF NOT EXISTS idx_visit_entries_technician ON elevator_visit_entries(technician_id);
CREATE INDEX IF NOT EXISTS idx_visit_entries_registered ON elevator_visit_entries(registered_at);

-- Unique constraint: one visit entry per service_record
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_visit_entry_per_service_record'
  ) THEN
    ALTER TABLE elevator_visit_entries
      ADD CONSTRAINT uq_visit_entry_per_service_record
      UNIQUE (service_record_id);
  END IF;
END $$;

-- ============================================================
-- 3. RLS
-- ============================================================

ALTER TABLE elevator_visit_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE elevator_visit_numbering ENABLE ROW LEVEL SECURITY;

-- elevator_visit_entries policies
DO $$
BEGIN
  DROP POLICY IF EXISTS "visit_entries_admin_all" ON elevator_visit_entries;
  DROP POLICY IF EXISTS "visit_entries_supervisor_all" ON elevator_visit_entries;
  DROP POLICY IF EXISTS "visit_entries_technician_select" ON elevator_visit_entries;
  DROP POLICY IF EXISTS "visit_entries_technician_insert" ON elevator_visit_entries;

  -- Admin: full access
  CREATE POLICY "visit_entries_admin_all" ON elevator_visit_entries
    FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

  -- Supervisor: full access
  CREATE POLICY "visit_entries_supervisor_all" ON elevator_visit_entries
    FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'supervisor')
    );

  -- Technician: read own/assigned entries
  CREATE POLICY "visit_entries_technician_select" ON elevator_visit_entries
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'technician')
      AND (technician_id = auth.uid() OR registered_by = auth.uid())
    );

  -- Technician: insert via RPC only (policy allows if registered_by = auth.uid)
  CREATE POLICY "visit_entries_technician_insert" ON elevator_visit_entries
    FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'technician')
      AND registered_by = auth.uid()
      AND status = 'draft'
    );
END $$;

-- elevator_visit_numbering policies
DO $$
BEGIN
  DROP POLICY IF EXISTS "visit_numbering_admin" ON elevator_visit_numbering;
  DROP POLICY IF EXISTS "visit_numbering_supervisor" ON elevator_visit_numbering;
  DROP POLICY IF EXISTS "visit_numbering_technician" ON elevator_visit_numbering;

  CREATE POLICY "visit_numbering_admin" ON elevator_visit_numbering
    FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

  CREATE POLICY "visit_numbering_supervisor" ON elevator_visit_numbering
    FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'supervisor')
    );

  CREATE POLICY "visit_numbering_technician" ON elevator_visit_numbering
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'technician')
    );
END $$;

-- ============================================================
-- 4. RPC: create_elevator_visit_entry
-- ============================================================

CREATE OR REPLACE FUNCTION create_elevator_visit_entry(
  p_elevator_id UUID,
  p_visit_date DATE,
  p_entry_type TEXT,
  p_description TEXT,
  p_title TEXT DEFAULT NULL,
  p_work_performed TEXT DEFAULT NULL,
  p_observations TEXT DEFAULT NULL,
  p_recommendations TEXT DEFAULT NULL,
  p_operational_status TEXT DEFAULT NULL,
  p_conservation_status TEXT DEFAULT NULL,
  p_technician_id UUID DEFAULT NULL,
  p_service_case_id UUID DEFAULT NULL,
  p_service_record_id UUID DEFAULT NULL,
  p_origin_type TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_entry_number INTEGER;
  v_new_entry elevator_visit_entries;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No autenticado');
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_user_id AND active = true;
  IF v_role IS NULL THEN
    RETURN jsonb_build_object('error', 'Perfil no encontrado o inactivo');
  END IF;

  IF v_role NOT IN ('admin', 'supervisor', 'technician') THEN
    RETURN jsonb_build_object('error', 'Sin permisos para crear asientos del libro');
  END IF;

  -- Validate elevator exists
  IF NOT EXISTS (SELECT 1 FROM elevators WHERE id = p_elevator_id AND active = true) THEN
    RETURN jsonb_build_object('error', 'Ascensor no encontrado o inactivo');
  END IF;

  -- Validate visit_date not future (allow 1 day tolerance)
  IF p_visit_date > CURRENT_DATE + INTERVAL '1 day' THEN
    RETURN jsonb_build_object('error', 'La fecha de visita no puede ser futura');
  END IF;

  -- Lock and increment numbering
  INSERT INTO elevator_visit_numbering (elevator_id, next_entry_number)
  VALUES (p_elevator_id, 2)
  ON CONFLICT (elevator_id) DO NOTHING;

  UPDATE elevator_visit_numbering
  SET next_entry_number = next_entry_number + 1, updated_at = NOW()
  WHERE elevator_id = p_elevator_id
  RETURNING next_entry_number - 1 INTO v_entry_number;

  -- Create entry
  INSERT INTO elevator_visit_entries (
    elevator_id, entry_number, visit_date, entry_type, description,
    title, work_performed, observations, recommendations,
    operational_status, conservation_status, technician_id,
    registered_by, service_case_id, service_record_id, origin_type, status
  ) VALUES (
    p_elevator_id, v_entry_number, p_visit_date, p_entry_type, p_description,
    p_title, p_work_performed, p_observations, p_recommendations,
    p_operational_status, p_conservation_status, p_technician_id,
    v_user_id, p_service_case_id, p_service_record_id, p_origin_type,
    CASE WHEN v_role IN ('admin', 'supervisor') THEN 'submitted' ELSE 'draft' END
  )
  RETURNING * INTO v_new_entry;

  -- Audit
  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data)
  VALUES (v_user_id, 'create', 'elevator_visit_entries', v_new_entry.id, to_jsonb(v_new_entry));

  RETURN jsonb_build_object(
    'id', v_new_entry.id,
    'entry_number', v_new_entry.entry_number,
    'status', v_new_entry.status
  );
END;
$$;

REVOKE ALL ON FUNCTION create_elevator_visit_entry(UUID, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_elevator_visit_entry(UUID, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID, UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION create_elevator_visit_entry(UUID, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID, UUID, TEXT) TO authenticated;

-- ============================================================
-- 5. RPC: submit_elevator_visit_entry
-- ============================================================

CREATE OR REPLACE FUNCTION submit_elevator_visit_entry(p_entry_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_entry elevator_visit_entries;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No autenticado');
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_user_id AND active = true;
  IF v_role IS NULL THEN
    RETURN jsonb_build_object('error', 'Perfil no encontrado');
  END IF;

  SELECT * INTO v_entry FROM elevator_visit_entries WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Asiento no encontrado');
  END IF;

  IF v_entry.status != 'draft' THEN
    RETURN jsonb_build_object('error', 'Solo se pueden enviar asientos en borrador');
  END IF;

  -- Technician can only submit own drafts
  IF v_role = 'technician' AND v_entry.registered_by != v_user_id THEN
    RETURN jsonb_build_object('error', 'Solo puede enviar sus propios borradores');
  END IF;

  UPDATE elevator_visit_entries
  SET status = 'submitted', updated_at = NOW()
  WHERE id = p_entry_id
  RETURNING * INTO v_entry;

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data)
  VALUES (v_user_id, 'submit', 'elevator_visit_entries', p_entry_id, to_jsonb(v_entry));

  RETURN jsonb_build_object('success', true, 'status', 'submitted');
END;
$$;

REVOKE ALL ON FUNCTION submit_elevator_visit_entry(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION submit_elevator_visit_entry(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION submit_elevator_visit_entry(UUID) TO authenticated;

-- ============================================================
-- 6. RPC: approve_elevator_visit_entry
-- ============================================================

CREATE OR REPLACE FUNCTION approve_elevator_visit_entry(p_entry_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_entry elevator_visit_entries;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No autenticado');
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_user_id AND active = true;
  IF v_role NOT IN ('admin', 'supervisor') THEN
    RETURN jsonb_build_object('error', 'Sin permisos para aprobar asientos');
  END IF;

  SELECT * INTO v_entry FROM elevator_visit_entries WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Asiento no encontrado');
  END IF;

  IF v_entry.status != 'submitted' THEN
    RETURN jsonb_build_object('error', 'Solo se pueden aprobar asientos enviados');
  END IF;

  UPDATE elevator_visit_entries
  SET status = 'approved', reviewed_by = v_user_id, reviewed_at = NOW(), updated_at = NOW()
  WHERE id = p_entry_id
  RETURNING * INTO v_entry;

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data)
  VALUES (v_user_id, 'approve', 'elevator_visit_entries', p_entry_id, to_jsonb(v_entry));

  RETURN jsonb_build_object('success', true, 'status', 'approved');
END;
$$;

REVOKE ALL ON FUNCTION approve_elevator_visit_entry(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION approve_elevator_visit_entry(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION approve_elevator_visit_entry(UUID) TO authenticated;

-- ============================================================
-- 7. RPC: rectify_elevator_visit_entry
-- ============================================================

CREATE OR REPLACE FUNCTION rectify_elevator_visit_entry(
  p_entry_id UUID,
  p_reason TEXT,
  p_corrected_fields JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_entry elevator_visit_entries;
  v_new_entry elevator_visit_entries;
  v_new_entry_number INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No autenticado');
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_user_id AND active = true;
  IF v_role NOT IN ('admin', 'supervisor') THEN
    RETURN jsonb_build_object('error', 'Sin permisos para rectificar asientos');
  END IF;

  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RETURN jsonb_build_object('error', 'El motivo de rectificación es obligatorio');
  END IF;

  SELECT * INTO v_entry FROM elevator_visit_entries WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Asiento no encontrado');
  END IF;

  IF v_entry.status = 'cancelled' THEN
    RETURN jsonb_build_object('error', 'No se puede rectificar un asiento anulado');
  END IF;

  IF v_entry.is_rectification THEN
    RETURN jsonb_build_object('error', 'No se puede rectificar una rectificación');
  END IF;

  -- Mark original as rectified
  UPDATE elevator_visit_entries
  SET status = 'rectified', updated_at = NOW()
  WHERE id = p_entry_id;

  -- Get next entry number for this elevator
  UPDATE elevator_visit_numbering
  SET next_entry_number = next_entry_number + 1, updated_at = NOW()
  WHERE elevator_id = v_entry.elevator_id
  RETURNING next_entry_number - 1 INTO v_new_entry_number;

  -- Create new entry with corrected fields
  INSERT INTO elevator_visit_entries (
    elevator_id, entry_number, visit_date, entry_type, description,
    title, work_performed, observations, recommendations,
    operational_status, conservation_status, technician_id,
    registered_by, service_case_id, service_record_id, origin_type,
    status, is_rectification, rectifies_entry_id
  ) VALUES (
    v_entry.elevator_id,
    v_new_entry_number,
    COALESCE((p_corrected_fields->>'visit_date')::DATE, v_entry.visit_date),
    COALESCE(p_corrected_fields->>'entry_type', v_entry.entry_type),
    COALESCE(p_corrected_fields->>'description', v_entry.description),
    COALESCE(p_corrected_fields->>'title', v_entry.title),
    COALESCE(p_corrected_fields->>'work_performed', v_entry.work_performed),
    COALESCE(p_corrected_fields->>'observations', v_entry.observations),
    COALESCE(p_corrected_fields->>'recommendations', v_entry.recommendations),
    COALESCE(p_corrected_fields->>'operational_status', v_entry.operational_status),
    COALESCE(p_corrected_fields->>'conservation_status', v_entry.conservation_status),
    COALESCE((p_corrected_fields->>'technician_id')::UUID, v_entry.technician_id),
    v_user_id,
    v_entry.service_case_id,
    v_entry.service_record_id,
    v_entry.origin_type,
    'submitted',
    true,
    p_entry_id
  )
  RETURNING * INTO v_new_entry;

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_data, new_data)
  VALUES (v_user_id, 'rectify', 'elevator_visit_entries', p_entry_id,
    to_jsonb(v_entry), jsonb_build_object('reason', p_reason, 'corrected_fields', p_corrected_fields));

  RETURN jsonb_build_object(
    'success', true,
    'original_id', p_entry_id,
    'new_id', v_new_entry.id,
    'new_entry_number', v_new_entry.entry_number
  );
END;
$$;

REVOKE ALL ON FUNCTION rectify_elevator_visit_entry(UUID, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION rectify_elevator_visit_entry(UUID, TEXT, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION rectify_elevator_visit_entry(UUID, TEXT, JSONB) TO authenticated;

-- ============================================================
-- 8. RPC: cancel_elevator_visit_entry
-- ============================================================

CREATE OR REPLACE FUNCTION cancel_elevator_visit_entry(
  p_entry_id UUID,
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
  v_entry elevator_visit_entries;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No autenticado');
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_user_id AND active = true;
  IF v_role NOT IN ('admin', 'supervisor') THEN
    RETURN jsonb_build_object('error', 'Sin permisos para anular asientos');
  END IF;

  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RETURN jsonb_build_object('error', 'El motivo de anulación es obligatorio');
  END IF;

  SELECT * INTO v_entry FROM elevator_visit_entries WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Asiento no encontrado');
  END IF;

  IF v_entry.status = 'cancelled' THEN
    RETURN jsonb_build_object('error', 'El asiento ya está anulado');
  END IF;

  UPDATE elevator_visit_entries
  SET status = 'cancelled', cancellation_reason = TRIM(p_reason), updated_at = NOW()
  WHERE id = p_entry_id
  RETURNING * INTO v_entry;

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data)
  VALUES (v_user_id, 'cancel', 'elevator_visit_entries', p_entry_id,
    jsonb_build_object('reason', p_reason));

  RETURN jsonb_build_object('success', true, 'status', 'cancelled');
END;
$$;

REVOKE ALL ON FUNCTION cancel_elevator_visit_entry(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION cancel_elevator_visit_entry(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION cancel_elevator_visit_entry(UUID, TEXT) TO authenticated;

-- ============================================================
-- 9. RPC: auto-create visit entry from approved service record
-- ============================================================

CREATE OR REPLACE FUNCTION create_visit_entry_from_service_record(p_service_record_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_record RECORD;
  v_entry_type TEXT;
  v_entry_number INTEGER;
  v_new_entry elevator_visit_entries;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No autenticado');
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_user_id AND active = true;
  IF v_role NOT IN ('admin', 'supervisor') THEN
    RETURN jsonb_build_object('error', 'Sin permisos');
  END IF;

  -- Check if visit entry already exists for this record
  IF EXISTS (SELECT 1 FROM elevator_visit_entries WHERE service_record_id = p_service_record_id) THEN
    RETURN jsonb_build_object('error', 'Ya existe un asiento del libro para este mantenimiento');
  END IF;

  -- Get service record
  SELECT sr.*, e.id as elev_id INTO v_record
  FROM service_records sr
  JOIN elevators e ON e.id = sr.elevator_id
  WHERE sr.id = p_service_record_id AND sr.status = 'approved';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Mantenimiento no encontrado o no aprobado');
  END IF;

  -- Map service type to entry type
  v_entry_type := CASE v_record.service_type
    WHEN 'preventivo' THEN 'preventive_maintenance'
    WHEN 'correctivo' THEN 'corrective_maintenance'
    WHEN 'emergencia' THEN 'emergency'
    WHEN 'inspeccion' THEN 'inspection'
    ELSE 'scheduled_service'
  END;

  -- Lock and increment numbering
  INSERT INTO elevator_visit_numbering (elevator_id, next_entry_number)
  VALUES (v_record.elev_id, 2)
  ON CONFLICT (elevator_id) DO NOTHING;

  UPDATE elevator_visit_numbering
  SET next_entry_number = next_entry_number + 1, updated_at = NOW()
  WHERE elevator_id = v_record.elev_id
  RETURNING next_entry_number - 1 INTO v_entry_number;

  -- Create entry
  INSERT INTO elevator_visit_entries (
    elevator_id, service_record_id, service_case_id,
    entry_number, visit_date, entry_type, description,
    work_performed, observations, recommendations,
    operational_status, conservation_status,
    technician_id, registered_by, reviewed_by, reviewed_at, status
  ) VALUES (
    v_record.elev_id, p_service_record_id, v_record.service_case_id,
    v_entry_number, v_record.service_date, v_entry_type,
    COALESCE(v_record.description, 'Mantenimiento registrado'),
    v_record.final_report_text, v_record.observations, NULL,
    v_record.operational_status_at_service, v_record.conservation_status_at_service,
    v_record.technician_id, v_user_id, v_user_id, NOW(), 'approved'
  )
  RETURNING * INTO v_new_entry;

  -- Update service_records with visit_entry_id
  UPDATE service_records
  SET visit_entry_id = v_new_entry.id
  WHERE id = p_service_record_id;

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data)
  VALUES (v_user_id, 'auto_create_visit', 'elevator_visit_entries', v_new_entry.id,
    jsonb_build_object('service_record_id', p_service_record_id, 'entry_number', v_entry_number));

  RETURN jsonb_build_object(
    'success', true,
    'id', v_new_entry.id,
    'entry_number', v_new_entry.entry_number,
    'status', 'approved'
  );
END;
$$;

REVOKE ALL ON FUNCTION create_visit_entry_from_service_record(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_visit_entry_from_service_record(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION create_visit_entry_from_service_record(UUID) TO authenticated;

-- ============================================================
-- 10. updated_at TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_elevator_visit_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_elevator_visit_entries_updated_at ON elevator_visit_entries;
CREATE TRIGGER trigger_elevator_visit_entries_updated_at
  BEFORE UPDATE ON elevator_visit_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_elevator_visit_entries_updated_at();

CREATE OR REPLACE FUNCTION update_elevator_visit_numbering_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_elevator_visit_numbering_updated_at ON elevator_visit_numbering;
CREATE TRIGGER trigger_elevator_visit_numbering_updated_at
  BEFORE UPDATE ON elevator_visit_numbering
  FOR EACH ROW
  EXECUTE FUNCTION update_elevator_visit_numbering_updated_at();

-- ============================================================
-- DONE
-- ============================================================
