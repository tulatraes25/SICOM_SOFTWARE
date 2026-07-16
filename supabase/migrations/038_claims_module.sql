-- 038: Claims module linked to service_cases
-- Idempotent where possible. Does NOT delete existing data.

-- ============================================================
-- 1. TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_case_id UUID NOT NULL REFERENCES service_cases(id) ON DELETE RESTRICT,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE RESTRICT,
  elevator_id UUID REFERENCES elevators(id) ON DELETE SET NULL,
  claim_date DATE NOT NULL DEFAULT CURRENT_DATE,
  claim_time TIME,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  received_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  claimant_name TEXT,
  claimant_email TEXT,
  claimant_phone TEXT,
  claimant_role TEXT,
  channel TEXT NOT NULL DEFAULT 'phone' CHECK (channel IN ('phone','email','whatsapp','in_person','website','internal','other')),
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('operational_failure','unusual_noise','door_problem','leveling','lighting','service_interruption','safety_concern','maintenance_request','administrative','other')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  internal_notes TEXT,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','assigned','in_progress','visited','resolved','closed','cancelled')),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolution_summary TEXT,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS claim_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('claim_created','assigned','priority_changed','status_changed','technician_notified','visit_registered','resolution_added','resolved','closed','cancelled','reopened')),
  performed_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS technician_notification_sends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id UUID REFERENCES claims(id) ON DELETE SET NULL,
  service_case_id UUID REFERENCES service_cases(id) ON DELETE SET NULL,
  technician_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent','failed')),
  provider_message_id TEXT,
  error_message TEXT,
  sent_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add claim_id to elevator_visit_entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'elevator_visit_entries' AND column_name = 'claim_id'
  ) THEN
    ALTER TABLE elevator_visit_entries ADD COLUMN claim_id UUID REFERENCES claims(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 2. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_claims_case ON claims(service_case_id);
CREATE INDEX IF NOT EXISTS idx_claims_client ON claims(client_id);
CREATE INDEX IF NOT EXISTS idx_claims_building ON claims(building_id);
CREATE INDEX IF NOT EXISTS idx_claims_elevator ON claims(elevator_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_priority ON claims(priority);
CREATE INDEX IF NOT EXISTS idx_claims_assigned ON claims(assigned_to);
CREATE INDEX IF NOT EXISTS idx_claims_date ON claims(claim_date);
CREATE INDEX IF NOT EXISTS idx_claim_events_claim ON claim_events(claim_id);
CREATE INDEX IF NOT EXISTS idx_tech_notif_claim ON technician_notification_sends(claim_id);
CREATE INDEX IF NOT EXISTS idx_tech_notif_tech ON technician_notification_sends(technician_id);

-- ============================================================
-- 3. RLS
-- ============================================================

ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE technician_notification_sends ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "claims_admin_all" ON claims;
  DROP POLICY IF EXISTS "claims_supervisor_all" ON claims;
  DROP POLICY IF EXISTS "claims_technician_select" ON claims;
  DROP POLICY IF EXISTS "ce_admin_supervisor_all" ON claim_events;
  DROP POLICY IF EXISTS "ce_technician_select" ON claim_events;
  DROP POLICY IF EXISTS "tns_admin_all" ON technician_notification_sends;

  CREATE POLICY "claims_admin_all" ON claims FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
  CREATE POLICY "claims_supervisor_all" ON claims FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'supervisor')
  );
  CREATE POLICY "claims_technician_select" ON claims FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'technician')
    AND assigned_to = auth.uid()
  );

  CREATE POLICY "ce_admin_supervisor_all" ON claim_events FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','supervisor'))
  );
  CREATE POLICY "ce_technician_select" ON claim_events FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'technician')
    AND claim_id IN (SELECT id FROM claims WHERE assigned_to = auth.uid())
  );

  CREATE POLICY "tns_admin_all" ON technician_notification_sends FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','supervisor'))
  );
END $$;

-- ============================================================
-- 4. RPC: create_claim
-- ============================================================

DROP FUNCTION IF EXISTS public.create_claim(UUID,UUID,UUID,DATE,TIME,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,UUID,UUID);

CREATE OR REPLACE FUNCTION public.create_claim(
  p_client_id UUID,
  p_building_id UUID,
  p_subject TEXT,
  p_description TEXT,
  p_elevator_id UUID DEFAULT NULL,
  p_claim_date DATE DEFAULT CURRENT_DATE,
  p_claim_time TIME DEFAULT NULL,
  p_claimant_name TEXT DEFAULT NULL,
  p_claimant_email TEXT DEFAULT NULL,
  p_claimant_phone TEXT DEFAULT NULL,
  p_claimant_role TEXT DEFAULT NULL,
  p_channel TEXT DEFAULT 'phone',
  p_category TEXT DEFAULT 'other',
  p_priority TEXT DEFAULT 'normal',
  p_internal_notes TEXT DEFAULT NULL,
  p_assigned_to UUID DEFAULT NULL,
  p_service_case_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
  v_case_id UUID;
  v_case_number INTEGER;
  v_mode TEXT;
  v_claim claims;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('error', 'No autenticado'); END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_user_id AND active = true;
  IF v_role NOT IN ('admin', 'supervisor') THEN
    RETURN jsonb_build_object('error', 'Sin permisos para crear reclamos');
  END IF;

  -- Use existing case or create new one
  IF p_service_case_id IS NOT NULL THEN
    SELECT id, case_number, numbering_mode INTO v_case_id, v_case_number, v_mode
    FROM service_cases WHERE id = p_service_case_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Expediente no encontrado'); END IF;
  ELSE
    DECLARE v_result JSONB; BEGIN
      SELECT * INTO v_result FROM public.create_service_case(
        p_origin_type => 'claim',
        p_client_id => p_client_id,
        p_building_id => p_building_id,
        p_elevator_id => p_elevator_id,
        p_title => p_subject,
        p_description => p_description,
        p_assigned_to => p_assigned_to
      );
      IF v_result ? 'error' THEN RETURN v_result; END IF;
      v_case_id := (v_result->>'id')::UUID;
      v_case_number := (v_result->>'case_number')::INTEGER;
      v_mode := v_result->>'numbering_mode';
    END;
  END IF;

  INSERT INTO claims (
    service_case_id, client_id, building_id, elevator_id,
    claim_date, claim_time, received_by,
    claimant_name, claimant_email, claimant_phone, claimant_role,
    channel, category, priority, subject, description, internal_notes,
    assigned_to, status
  ) VALUES (
    v_case_id, p_client_id, p_building_id, p_elevator_id,
    p_claim_date, p_claim_time, v_user_id,
    p_claimant_name, p_claimant_email, p_claimant_phone, p_claimant_role,
    p_channel, p_category, p_priority, p_subject, p_description, p_internal_notes,
    p_assigned_to, CASE WHEN p_assigned_to IS NOT NULL THEN 'assigned' ELSE 'open' END
  ) RETURNING * INTO v_claim;

  IF p_assigned_to IS NOT NULL THEN
    UPDATE claims SET assigned_at = NOW() WHERE id = v_claim.id;
    UPDATE service_cases SET assigned_to = p_assigned_to WHERE id = v_case_id;
  END IF;

  INSERT INTO claim_events (claim_id, event_type, performed_by, details)
  VALUES (v_claim.id, 'claim_created', v_user_id, jsonb_build_object('priority', p_priority, 'category', p_category));

  IF p_assigned_to IS NOT NULL THEN
    INSERT INTO claim_events (claim_id, event_type, performed_by, details)
    VALUES (v_claim.id, 'assigned', v_user_id, jsonb_build_object('technician_id', p_assigned_to));
  END IF;

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data)
  VALUES (v_user_id, 'create', 'claims', v_claim.id, to_jsonb(v_claim));

  RETURN jsonb_build_object(
    'claim_id', v_claim.id, 'service_case_id', v_case_id,
    'case_number', v_case_number, 'numbering_mode', v_mode, 'status', v_claim.status
  );
END;
$$;

REVOKE ALL ON FUNCTION create_claim(UUID,UUID,TEXT,TEXT,UUID,DATE,TIME,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,UUID,UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_claim(UUID,UUID,TEXT,TEXT,UUID,DATE,TIME,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,UUID,UUID) FROM anon;
GRANT EXECUTE ON FUNCTION create_claim(UUID,UUID,TEXT,TEXT,UUID,DATE,TIME,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,UUID,UUID) TO authenticated;

-- ============================================================
-- 5. RPC: assign_claim_technician
-- ============================================================

DROP FUNCTION IF EXISTS assign_claim_technician(UUID,UUID);

CREATE OR REPLACE FUNCTION assign_claim_technician(p_claim_id UUID, p_technician_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_role TEXT; v_claim RECORD;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid() AND active = true;
  IF v_role NOT IN ('admin','supervisor') THEN RETURN jsonb_build_object('error','Sin permisos'); END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_technician_id AND role = 'technician' AND active = true) THEN
    RETURN jsonb_build_object('error','Técnico no encontrado o inactivo');
  END IF;

  SELECT * INTO v_claim FROM claims WHERE id = p_claim_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Reclamo no encontrado'); END IF;

  UPDATE claims SET assigned_to = p_technician_id, assigned_at = NOW(),
    status = CASE WHEN status = 'open' THEN 'assigned' ELSE status END, updated_at = NOW()
  WHERE id = p_claim_id;

  UPDATE service_cases SET assigned_to = p_technician_id WHERE id = v_claim.service_case_id;

  INSERT INTO claim_events (claim_id, event_type, performed_by, details)
  VALUES (p_claim_id, 'assigned', auth.uid(), jsonb_build_object('technician_id', p_technician_id));

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION assign_claim_technician(UUID,UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION assign_claim_technician(UUID,UUID) FROM anon;
GRANT EXECUTE ON FUNCTION assign_claim_technician(UUID,UUID) TO authenticated;

-- ============================================================
-- 6. RPC: start_claim_work
-- ============================================================

DROP FUNCTION IF EXISTS start_claim_work(UUID);

CREATE OR REPLACE FUNCTION start_claim_work(p_claim_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_role TEXT; v_claim RECORD;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid() AND active = true;
  IF v_role IS NULL THEN RETURN jsonb_build_object('error','No autenticado'); END IF;

  SELECT * INTO v_claim FROM claims WHERE id = p_claim_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Reclamo no encontrado'); END IF;

  IF v_role = 'technician' AND v_claim.assigned_to != auth.uid() THEN
    RETURN jsonb_build_object('error','No te fue asignado este reclamo');
  END IF;

  IF v_claim.status NOT IN ('assigned') THEN
    RETURN jsonb_build_object('error','Solo reclamos asignados pueden iniciarse');
  END IF;

  UPDATE claims SET status = 'in_progress', updated_at = NOW() WHERE id = p_claim_id;
  INSERT INTO claim_events (claim_id, event_type, performed_by) VALUES (p_claim_id, 'status_changed', auth.uid());
  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION start_claim_work(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION start_claim_work(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION start_claim_work(UUID) TO authenticated;

-- ============================================================
-- 7. RPC: resolve_claim
-- ============================================================

DROP FUNCTION IF EXISTS resolve_claim(UUID,TEXT);

CREATE OR REPLACE FUNCTION resolve_claim(p_claim_id UUID, p_resolution TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_role TEXT; v_claim RECORD;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid() AND active = true;
  IF v_role NOT IN ('admin','supervisor','technician') THEN RETURN jsonb_build_object('error','Sin permisos'); END IF;

  IF p_resolution IS NULL OR TRIM(p_resolution) = '' THEN
    RETURN jsonb_build_object('error','El resumen de resolución es obligatorio');
  END IF;

  SELECT * INTO v_claim FROM claims WHERE id = p_claim_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Reclamo no encontrado'); END IF;

  IF v_claim.status NOT IN ('in_progress','visited') THEN
    RETURN jsonb_build_object('error','Solo reclamos en atención pueden resolverse');
  END IF;

  UPDATE claims SET status = 'resolved', resolved_at = NOW(), resolved_by = auth.uid(),
    resolution_summary = p_resolution, updated_at = NOW() WHERE id = p_claim_id;

  INSERT INTO claim_events (claim_id, event_type, performed_by, details)
  VALUES (p_claim_id, 'resolved', auth.uid(), jsonb_build_object('resolution', p_resolution));
  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION resolve_claim(UUID,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION resolve_claim(UUID,TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION resolve_claim(UUID,TEXT) TO authenticated;

-- ============================================================
-- 8. RPC: close_claim
-- ============================================================

DROP FUNCTION IF EXISTS close_claim(UUID);

CREATE OR REPLACE FUNCTION close_claim(p_claim_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid() AND active = true;
  IF v_role NOT IN ('admin','supervisor') THEN RETURN jsonb_build_object('error','Sin permisos'); END IF;

  UPDATE claims SET status = 'closed', updated_at = NOW() WHERE id = p_claim_id AND status = 'resolved';
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Solo reclamos resueltos pueden cerrarse'); END IF;

  INSERT INTO claim_events (claim_id, event_type, performed_by) VALUES (p_claim_id, 'closed', auth.uid());
  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION close_claim(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION close_claim(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION close_claim(UUID) TO authenticated;

-- ============================================================
-- 9. RPC: cancel_claim
-- ============================================================

DROP FUNCTION IF EXISTS cancel_claim(UUID,TEXT);

CREATE OR REPLACE FUNCTION cancel_claim(p_claim_id UUID, p_reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid() AND active = true;
  IF v_role NOT IN ('admin','supervisor') THEN RETURN jsonb_build_object('error','Sin permisos'); END IF;
  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN RETURN jsonb_build_object('error','El motivo es obligatorio'); END IF;

  UPDATE claims SET status = 'cancelled', cancellation_reason = TRIM(p_reason), updated_at = NOW()
  WHERE id = p_claim_id AND status NOT IN ('closed','cancelled');
  IF NOT FOUND THEN RETURN jsonb_build_object('error','No se puede cancelar este reclamo'); END IF;

  INSERT INTO claim_events (claim_id, event_type, performed_by, details)
  VALUES (p_claim_id, 'cancelled', auth.uid(), jsonb_build_object('reason', p_reason));
  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION cancel_claim(UUID,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION cancel_claim(UUID,TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION cancel_claim(UUID,TEXT) TO authenticated;

-- ============================================================
-- 10. TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_claims_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_claims_updated_at ON claims;
CREATE TRIGGER trigger_claims_updated_at BEFORE UPDATE ON claims FOR EACH ROW
  EXECUTE FUNCTION update_claims_updated_at();

-- ============================================================
-- DONE
-- ============================================================
