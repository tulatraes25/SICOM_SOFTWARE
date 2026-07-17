-- 039: Service orders module linked to service_cases
-- Idempotent where possible. Does NOT delete existing data.

-- ============================================================
-- 1. TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS service_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_case_id UUID NOT NULL REFERENCES service_cases(id) ON DELETE RESTRICT,
  claim_id UUID REFERENCES claims(id) ON DELETE SET NULL,
  budget_id UUID REFERENCES budgets(id) ON DELETE SET NULL,
  service_record_id UUID REFERENCES service_records(id) ON DELETE SET NULL,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE RESTRICT,
  elevator_id UUID REFERENCES elevators(id) ON DELETE SET NULL,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  scheduled_date DATE,
  scheduled_time TIME,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  order_type TEXT NOT NULL DEFAULT 'other' CHECK (order_type IN ('preventive','corrective','emergency','inspection','claim_response','budgeted_work','modernization','other')),
  subject TEXT NOT NULL,
  work_requested TEXT NOT NULL,
  internal_notes TEXT,
  client_notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ready','assigned','in_progress','visited','completed','cancelled')),
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  ready_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ready_at TIMESTAMPTZ,
  assigned_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  completion_summary TEXT,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_order_technicians (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  role TEXT,
  is_lead BOOLEAN NOT NULL DEFAULT false,
  assigned_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(service_order_id, technician_id)
);

CREATE TABLE IF NOT EXISTS service_order_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'order_created','marked_ready','technician_assigned','technician_removed',
    'technician_notified','order_started','visit_registered','progress_added',
    'order_completed','order_cancelled','order_reopened','pdf_generated','email_sent'
  )),
  performed_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_order_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  note TEXT NOT NULL,
  progress_type TEXT NOT NULL DEFAULT 'update' CHECK (progress_type IN (
    'update','diagnostic','material_needed','waiting_client','waiting_parts','safety_stop','completion_note'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add service_order_id to elevator_visit_entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'elevator_visit_entries' AND column_name = 'service_order_id'
  ) THEN
    ALTER TABLE elevator_visit_entries ADD COLUMN service_order_id UUID REFERENCES service_orders(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 2. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_so_case ON service_orders(service_case_id);
CREATE INDEX IF NOT EXISTS idx_so_client ON service_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_so_building ON service_orders(building_id);
CREATE INDEX IF NOT EXISTS idx_so_elevator ON service_orders(elevator_id);
CREATE INDEX IF NOT EXISTS idx_so_status ON service_orders(status);
CREATE INDEX IF NOT EXISTS idx_so_priority ON service_orders(priority);
CREATE INDEX IF NOT EXISTS idx_so_claim ON service_orders(claim_id);
CREATE INDEX IF NOT EXISTS idx_so_budget ON service_orders(budget_id);
CREATE INDEX IF NOT EXISTS idx_so_scheduled ON service_orders(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_sot_order ON service_order_technicians(service_order_id);
CREATE INDEX IF NOT EXISTS idx_sot_tech ON service_order_technicians(technician_id);
CREATE INDEX IF NOT EXISTS idx_soe_order ON service_order_events(service_order_id);
CREATE INDEX IF NOT EXISTS idx_sop_order ON service_order_progress(service_order_id);

-- ============================================================
-- 3. RLS
-- ============================================================

ALTER TABLE service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_order_technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_order_progress ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- service_orders
  DROP POLICY IF EXISTS "so_admin_all" ON service_orders;
  DROP POLICY IF EXISTS "so_supervisor_all" ON service_orders;
  DROP POLICY IF EXISTS "so_technician_select" ON service_orders;

  CREATE POLICY "so_admin_all" ON service_orders FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
  CREATE POLICY "so_supervisor_all" ON service_orders FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'supervisor')
  );
  CREATE POLICY "so_technician_select" ON service_orders FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'technician')
    AND id IN (SELECT service_order_id FROM service_order_technicians WHERE technician_id = auth.uid())
  );

  -- service_order_technicians
  DROP POLICY IF EXISTS "sot_admin_all" ON service_order_technicians;
  DROP POLICY IF EXISTS "sot_supervisor_all" ON service_order_technicians;
  DROP POLICY IF EXISTS "sot_technician_select" ON service_order_technicians;

  CREATE POLICY "sot_admin_all" ON service_order_technicians FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
  CREATE POLICY "sot_supervisor_all" ON service_order_technicians FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'supervisor')
  );
  CREATE POLICY "sot_technician_select" ON service_order_technicians FOR SELECT USING (
    technician_id = auth.uid() OR service_order_id IN (
      SELECT service_order_id FROM service_order_technicians WHERE technician_id = auth.uid()
    )
  );

  -- service_order_events
  DROP POLICY IF EXISTS "soe_admin_supervisor" ON service_order_events;
  DROP POLICY IF EXISTS "soe_technician_select" ON service_order_events;

  CREATE POLICY "soe_admin_supervisor" ON service_order_events FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','supervisor'))
  );
  CREATE POLICY "soe_technician_select" ON service_order_events FOR SELECT USING (
    service_order_id IN (SELECT service_order_id FROM service_order_technicians WHERE technician_id = auth.uid())
  );

  -- service_order_progress
  DROP POLICY IF EXISTS "sop_admin_supervisor" ON service_order_progress;
  DROP POLICY IF EXISTS "sop_technician" ON service_order_progress;

  CREATE POLICY "sop_admin_supervisor" ON service_order_progress FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','supervisor'))
  );
  CREATE POLICY "sop_technician" ON service_order_progress FOR ALL USING (
    technician_id = auth.uid()
  );
END $$;

-- ============================================================
-- 4. RPC: create_service_order
-- ============================================================

DROP FUNCTION IF EXISTS public.create_service_order(UUID,UUID,UUID,UUID,DATE,TIME,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,UUID,UUID);
DROP FUNCTION IF EXISTS public.create_service_order(UUID,UUID,TEXT,TEXT,UUID,DATE,TIME,TEXT,TEXT,TEXT,TEXT,TEXT,UUID,UUID,UUID);

CREATE OR REPLACE FUNCTION public.create_service_order(
  p_client_id UUID,
  p_building_id UUID,
  p_subject TEXT,
  p_work_requested TEXT,
  p_elevator_id UUID DEFAULT NULL,
  p_order_date DATE DEFAULT CURRENT_DATE,
  p_scheduled_date DATE DEFAULT NULL,
  p_scheduled_time TIME DEFAULT NULL,
  p_priority TEXT DEFAULT 'normal',
  p_order_type TEXT DEFAULT 'other',
  p_internal_notes TEXT DEFAULT NULL,
  p_client_notes TEXT DEFAULT NULL,
  p_service_case_id UUID DEFAULT NULL,
  p_claim_id UUID DEFAULT NULL,
  p_budget_id UUID DEFAULT NULL
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
  v_order service_orders;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('error', 'No autenticado'); END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_user_id AND active = true;
  IF v_role NOT IN ('admin', 'supervisor') THEN
    RETURN jsonb_build_object('error', 'Sin permisos');
  END IF;

  -- Resolve service_case_id from claim or budget if not provided
  IF p_service_case_id IS NOT NULL THEN
    SELECT id, case_number, numbering_mode INTO v_case_id, v_case_number, v_mode
    FROM service_cases WHERE id = p_service_case_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Expediente no encontrado'); END IF;
  ELSIF p_claim_id IS NOT NULL THEN
    SELECT service_case_id INTO v_case_id FROM claims WHERE id = p_claim_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Reclamo no encontrado'); END IF;
    SELECT case_number, numbering_mode INTO v_case_number, v_mode FROM service_cases WHERE id = v_case_id;
  ELSIF p_budget_id IS NOT NULL THEN
    SELECT service_case_id INTO v_case_id FROM budgets WHERE id = p_budget_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Presupuesto no encontrado'); END IF;
    SELECT case_number, numbering_mode INTO v_case_number, v_mode FROM service_cases WHERE id = v_case_id;
  ELSE
    DECLARE v_result JSONB; BEGIN
      SELECT * INTO v_result FROM public.create_service_case(
        p_origin_type => 'service_order',
        p_client_id => p_client_id,
        p_building_id => p_building_id,
        p_elevator_id => p_elevator_id,
        p_title => p_subject,
        p_description => p_work_requested,
        p_assigned_to => NULL
      );
      IF v_result ? 'error' THEN RETURN v_result; END IF;
      v_case_id := (v_result->>'id')::UUID;
      v_case_number := (v_result->>'case_number')::INTEGER;
      v_mode := v_result->>'numbering_mode';
    END;
  END IF;

  INSERT INTO service_orders (
    service_case_id, claim_id, budget_id, client_id, building_id, elevator_id,
    order_date, scheduled_date, scheduled_time, priority, order_type,
    subject, work_requested, internal_notes, client_notes, created_by, status
  ) VALUES (
    v_case_id, p_claim_id, p_budget_id, p_client_id, p_building_id, p_elevator_id,
    p_order_date, p_scheduled_date, p_scheduled_time, p_priority, p_order_type,
    p_subject, p_work_requested, p_internal_notes, p_client_notes, v_user_id, 'draft'
  ) RETURNING * INTO v_order;

  INSERT INTO service_order_events (service_order_id, event_type, performed_by, details)
  VALUES (v_order.id, 'order_created', v_user_id, jsonb_build_object('order_type', p_order_type, 'priority', p_priority));

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data)
  VALUES (v_user_id, 'create', 'service_orders', v_order.id, to_jsonb(v_order));

  RETURN jsonb_build_object(
    'order_id', v_order.id, 'service_case_id', v_case_id,
    'case_number', v_case_number, 'numbering_mode', v_mode, 'status', v_order.status
  );
END;
$$;

REVOKE ALL ON FUNCTION create_service_order(UUID,UUID,TEXT,TEXT,UUID,DATE,DATE,TIME,TEXT,TEXT,TEXT,TEXT,UUID,UUID,UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_service_order(UUID,UUID,TEXT,TEXT,UUID,DATE,DATE,TIME,TEXT,TEXT,TEXT,TEXT,UUID,UUID,UUID) FROM anon;
GRANT EXECUTE ON FUNCTION create_service_order(UUID,UUID,TEXT,TEXT,UUID,DATE,DATE,TIME,TEXT,TEXT,TEXT,TEXT,UUID,UUID,UUID) TO authenticated;

-- ============================================================
-- 5. RPC: mark_service_order_ready
-- ============================================================

DROP FUNCTION IF EXISTS mark_service_order_ready(UUID);

CREATE OR REPLACE FUNCTION mark_service_order_ready(p_order_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_role TEXT; v_order RECORD;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid() AND active = true;
  IF v_role NOT IN ('admin','supervisor') THEN RETURN jsonb_build_object('error','Sin permisos'); END IF;

  SELECT * INTO v_order FROM service_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Orden no encontrada'); END IF;
  IF v_order.status != 'draft' THEN RETURN jsonb_build_object('error','Solo borradores pueden marcarse como listos'); END IF;

  UPDATE service_orders SET status = 'ready', ready_by = auth.uid(), ready_at = NOW(), updated_at = NOW() WHERE id = p_order_id;
  INSERT INTO service_order_events (service_order_id, event_type, performed_by) VALUES (p_order_id, 'marked_ready', auth.uid());
  RETURN jsonb_build_object('success', true, 'status', 'ready');
END;
$$;

REVOKE ALL ON FUNCTION mark_service_order_ready(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION mark_service_order_ready(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION mark_service_order_ready(UUID) TO authenticated;

-- ============================================================
-- 6. RPC: assign_service_order_technicians
-- ============================================================

DROP FUNCTION IF EXISTS assign_service_order_technicians(UUID,UUID[],BOOLEAN);

CREATE OR REPLACE FUNCTION assign_service_order_technicians(
  p_order_id UUID, p_technician_ids UUID[], p_is_lead UUID DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_role TEXT; v_tid UUID; v_order RECORD;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid() AND active = true;
  IF v_role NOT IN ('admin','supervisor') THEN RETURN jsonb_build_object('error','Sin permisos'); END IF;

  SELECT * INTO v_order FROM service_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Orden no encontrada'); END IF;

  -- Remove existing technicians
  DELETE FROM service_order_technicians WHERE service_order_id = p_order_id;

  -- Add new ones
  FOREACH v_tid IN ARRAY p_technician_ids LOOP
    INSERT INTO service_order_technicians (service_order_id, technician_id, assigned_by, is_lead)
    VALUES (p_order_id, v_tid, auth.uid(), v_tid = COALESCE(p_is_lead, p_technician_ids[1]));
  END LOOP;

  UPDATE service_orders SET
    status = CASE WHEN status IN ('draft','ready') THEN 'assigned' ELSE status END,
    assigned_at = NOW(), updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO service_order_events (service_order_id, event_type, performed_by, details)
  VALUES (p_order_id, 'technician_assigned', auth.uid(), jsonb_build_object('technicians', p_technician_ids));

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION assign_service_order_technicians(UUID,UUID[],BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION assign_service_order_technicians(UUID,UUID[],BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION assign_service_order_technicians(UUID,UUID[],BOOLEAN) TO authenticated;

-- ============================================================
-- 7. RPC: start_service_order
-- ============================================================

DROP FUNCTION IF EXISTS start_service_order(UUID);

CREATE OR REPLACE FUNCTION start_service_order(p_order_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_role TEXT; v_order RECORD;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid() AND active = true;
  IF v_role IS NULL THEN RETURN jsonb_build_object('error','No autenticado'); END IF;

  SELECT * INTO v_order FROM service_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Orden no encontrada'); END IF;

  IF v_role = 'technician' AND NOT EXISTS (
    SELECT 1 FROM service_order_technicians WHERE service_order_id = p_order_id AND technician_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('error','No estás asignado a esta orden');
  END IF;

  IF v_order.status != 'assigned' THEN
    RETURN jsonb_build_object('error','Solo órdenes asignadas pueden iniciarse');
  END IF;

  UPDATE service_orders SET status = 'in_progress', started_at = NOW(), updated_at = NOW() WHERE id = p_order_id;
  UPDATE service_order_technicians SET started_at = NOW() WHERE service_order_id = p_order_id AND technician_id = auth.uid();
  INSERT INTO service_order_events (service_order_id, event_type, performed_by) VALUES (p_order_id, 'order_started', auth.uid());
  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION start_service_order(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION start_service_order(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION start_service_order(UUID) TO authenticated;

-- ============================================================
-- 8. RPC: complete_service_order
-- ============================================================

DROP FUNCTION IF EXISTS complete_service_order(UUID,TEXT);

CREATE OR REPLACE FUNCTION complete_service_order(p_order_id UUID, p_summary TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_role TEXT; v_order RECORD;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid() AND active = true;
  IF v_role NOT IN ('admin','supervisor','technician') THEN RETURN jsonb_build_object('error','Sin permisos'); END IF;

  SELECT * INTO v_order FROM service_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Orden no encontrada'); END IF;

  IF v_role = 'technician' AND NOT EXISTS (
    SELECT 1 FROM service_order_technicians WHERE service_order_id = p_order_id AND technician_id = auth.uid() AND is_lead = true
  ) THEN
    RETURN jsonb_build_object('error','Solo el técnico principal puede completar');
  END IF;

  IF v_order.status NOT IN ('in_progress','visited') THEN
    RETURN jsonb_build_object('error','Solo órdenes en atención pueden completarse');
  END IF;

  UPDATE service_orders SET
    status = 'completed', completed_at = NOW(), completed_by = auth.uid(),
    completion_summary = p_summary, updated_at = NOW()
  WHERE id = p_order_id;
  UPDATE service_order_technicians SET completed_at = NOW() WHERE service_order_id = p_order_id;
  INSERT INTO service_order_events (service_order_id, event_type, performed_by, details)
  VALUES (p_order_id, 'order_completed', auth.uid(), jsonb_build_object('summary', p_summary));
  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION complete_service_order(UUID,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION complete_service_order(UUID,TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION complete_service_order(UUID,TEXT) TO authenticated;

-- ============================================================
-- 9. RPC: cancel_service_order
-- ============================================================

DROP FUNCTION IF EXISTS cancel_service_order(UUID,TEXT);

CREATE OR REPLACE FUNCTION cancel_service_order(p_order_id UUID, p_reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid() AND active = true;
  IF v_role NOT IN ('admin','supervisor') THEN RETURN jsonb_build_object('error','Sin permisos'); END IF;
  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN RETURN jsonb_build_object('error','El motivo es obligatorio'); END IF;

  UPDATE service_orders SET status = 'cancelled', cancellation_reason = TRIM(p_reason), updated_at = NOW()
  WHERE id = p_order_id AND status NOT IN ('completed','cancelled');
  IF NOT FOUND THEN RETURN jsonb_build_object('error','No se puede cancelar esta orden'); END IF;

  INSERT INTO service_order_events (service_order_id, event_type, performed_by, details)
  VALUES (p_order_id, 'order_cancelled', auth.uid(), jsonb_build_object('reason', p_reason));
  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION cancel_service_order(UUID,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION cancel_service_order(UUID,TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION cancel_service_order(UUID,TEXT) TO authenticated;

-- ============================================================
-- 10. RPC: add_service_order_progress
-- ============================================================

DROP FUNCTION IF EXISTS add_service_order_progress(UUID,TEXT,TEXT);

CREATE OR REPLACE FUNCTION add_service_order_progress(
  p_order_id UUID, p_note TEXT, p_progress_type TEXT DEFAULT 'update'
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid() AND active = true;
  IF v_role IS NULL THEN RETURN jsonb_build_object('error','No autenticado'); END IF;

  IF NOT EXISTS (
    SELECT 1 FROM service_order_technicians WHERE service_order_id = p_order_id AND technician_id = auth.uid()
  ) AND v_role NOT IN ('admin','supervisor') THEN
    RETURN jsonb_build_object('error','No estás asignado a esta orden');
  END IF;

  INSERT INTO service_order_progress (service_order_id, technician_id, note, progress_type)
  VALUES (p_order_id, auth.uid(), p_note, p_progress_type);

  INSERT INTO service_order_events (service_order_id, event_type, performed_by, details)
  VALUES (p_order_id, 'progress_added', auth.uid(), jsonb_build_object('type', p_progress_type));

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION add_service_order_progress(UUID,TEXT,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION add_service_order_progress(UUID,TEXT,TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION add_service_order_progress(UUID,TEXT,TEXT) TO authenticated;

-- ============================================================
-- 11. TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_service_orders_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_so_updated_at ON service_orders;
CREATE TRIGGER trigger_so_updated_at BEFORE UPDATE ON service_orders FOR EACH ROW
  EXECUTE FUNCTION update_service_orders_updated_at();

-- ============================================================
-- DONE
-- ============================================================
