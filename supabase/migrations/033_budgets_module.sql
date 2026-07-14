-- 033: Budgets module linked to service_cases
-- Idempotent where possible. Does NOT delete existing data.

-- ============================================================
-- 1. TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_case_id UUID NOT NULL UNIQUE REFERENCES service_cases(id) ON DELETE RESTRICT,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  building_id UUID REFERENCES buildings(id) ON DELETE SET NULL,
  elevator_id UUID REFERENCES elevators(id) ON DELETE SET NULL,
  budget_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  subject TEXT NOT NULL,
  introduction TEXT,
  notes TEXT,
  payment_terms TEXT,
  delivery_terms TEXT,
  currency TEXT NOT NULL DEFAULT 'ARS',
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 21,
  tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'ready', 'sent', 'accepted', 'rejected', 'expired', 'cancelled'
  )),
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budget_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  item_order INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
  unit TEXT,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  line_subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budget_email_sends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  provider_message_id TEXT,
  error_message TEXT,
  sent_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_budgets_case ON budgets(service_case_id);
CREATE INDEX IF NOT EXISTS idx_budgets_client ON budgets(client_id);
CREATE INDEX IF NOT EXISTS idx_budgets_building ON budgets(building_id);
CREATE INDEX IF NOT EXISTS idx_budgets_status ON budgets(status);
CREATE INDEX IF NOT EXISTS idx_budgets_created ON budgets(created_at);
CREATE INDEX IF NOT EXISTS idx_budget_items_budget ON budget_items(budget_id);
CREATE INDEX IF NOT EXISTS idx_budget_email_budget ON budget_email_sends(budget_id);

-- ============================================================
-- 3. RLS
-- ============================================================

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_email_sends ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "budgets_admin_all" ON budgets;
  DROP POLICY IF EXISTS "budgets_supervisor_all" ON budgets;
  DROP POLICY IF EXISTS "budget_items_admin_all" ON budget_items;
  DROP POLICY IF EXISTS "budget_items_supervisor_all" ON budget_items;
  DROP POLICY IF EXISTS "budget_email_admin_all" ON budget_email_sends;
  DROP POLICY IF EXISTS "budget_email_supervisor_all" ON budget_email_sends;

  -- budgets: admin
  CREATE POLICY "budgets_admin_all" ON budgets
    FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

  -- budgets: supervisor
  CREATE POLICY "budgets_supervisor_all" ON budgets
    FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'supervisor')
    );

  -- budget_items: admin
  CREATE POLICY "budget_items_admin_all" ON budget_items
    FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

  -- budget_items: supervisor
  CREATE POLICY "budget_items_supervisor_all" ON budget_items
    FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'supervisor')
    );

  -- budget_email_sends: admin
  CREATE POLICY "budget_email_admin_all" ON budget_email_sends
    FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

  -- budget_email_sends: supervisor
  CREATE POLICY "budget_email_supervisor_all" ON budget_email_sends
    FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'supervisor')
    );
END $$;

-- ============================================================
-- 4. RPC: create_budget
-- ============================================================

DROP FUNCTION IF EXISTS public.create_budget(UUID, UUID, UUID, TEXT, DATE, DATE, UUID);
DROP FUNCTION IF EXISTS public.create_budget(UUID, TEXT, UUID, UUID, DATE, DATE, UUID);

CREATE OR REPLACE FUNCTION public.create_budget(
  p_client_id UUID,
  p_subject TEXT,
  p_building_id UUID DEFAULT NULL,
  p_elevator_id UUID DEFAULT NULL,
  p_budget_date DATE DEFAULT CURRENT_DATE,
  p_valid_until DATE DEFAULT NULL,
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
  v_budget budgets;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No autenticado');
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = v_user_id AND active = true;
  IF v_role NOT IN ('admin', 'supervisor') THEN
    RETURN jsonb_build_object('error', 'Sin permisos para crear presupuestos');
  END IF;

  -- Use existing case or create new one
  IF p_service_case_id IS NOT NULL THEN
    -- Verify case exists and is budget type
    SELECT id, case_number, numbering_mode INTO v_case_id, v_case_number, v_mode
    FROM service_cases WHERE id = p_service_case_id AND origin_type = 'budget';
    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'Expediente no encontrado o no es de tipo presupuesto');
    END IF;
  ELSE
    -- Create new service case using named parameters
    DECLARE
      v_result JSONB;
    BEGIN
      SELECT * INTO v_result FROM public.create_service_case(
        p_origin_type => 'budget',
        p_client_id => p_client_id,
        p_building_id => p_building_id,
        p_elevator_id => p_elevator_id,
        p_title => p_subject,
        p_description => NULL,
        p_assigned_to => NULL
      );
      IF v_result ? 'error' THEN
        RETURN v_result;
      END IF;
      v_case_id := (v_result->>'id')::UUID;
      v_case_number := (v_result->>'case_number')::INTEGER;
      v_mode := v_result->>'numbering_mode';
    END;
  END IF;

  -- Create budget
  INSERT INTO budgets (
    service_case_id, client_id, building_id, elevator_id,
    budget_date, valid_until, subject, created_by
  ) VALUES (
    v_case_id, p_client_id, p_building_id, p_elevator_id,
    p_budget_date, p_valid_until, p_subject, v_user_id
  )
  RETURNING * INTO v_budget;

  -- Audit (non-blocking)
  BEGIN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data)
    VALUES (v_user_id, 'create', 'budgets', v_budget.id, to_jsonb(v_budget));
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'budget_id', v_budget.id,
    'service_case_id', v_case_id,
    'case_number', v_case_number,
    'numbering_mode', v_mode
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_budget(UUID, TEXT, UUID, UUID, DATE, DATE, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_budget(UUID, TEXT, UUID, UUID, DATE, DATE, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_budget(UUID, TEXT, UUID, UUID, DATE, DATE, UUID) TO authenticated;

-- ============================================================
-- 5. RPC: recalculate_budget_totals
-- ============================================================

CREATE OR REPLACE FUNCTION recalculate_budget_totals(p_budget_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_budget RECORD;
  v_subtotal NUMERIC(14,2);
  v_tax_amount NUMERIC(14,2);
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No autenticado');
  END IF;

  SELECT * INTO v_budget FROM budgets WHERE id = p_budget_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Presupuesto no encontrado');
  END IF;

  -- Calculate subtotal from items
  SELECT COALESCE(SUM(line_subtotal), 0) INTO v_subtotal
  FROM budget_items WHERE budget_id = p_budget_id;

  v_tax_amount := ROUND(v_subtotal * v_budget.tax_rate / 100, 2);

  UPDATE budgets SET
    subtotal = v_subtotal,
    tax_amount = v_tax_amount,
    total = v_subtotal + v_tax_amount,
    updated_at = NOW()
  WHERE id = p_budget_id;

  RETURN jsonb_build_object(
    'subtotal', v_subtotal,
    'tax_amount', v_tax_amount,
    'total', v_subtotal + v_tax_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION recalculate_budget_totals(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION recalculate_budget_totals(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION recalculate_budget_totals(UUID) TO authenticated;

-- ============================================================
-- 6. RPC: mark_budget_ready
-- ============================================================

CREATE OR REPLACE FUNCTION mark_budget_ready(p_budget_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_budget RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No autenticado');
  END IF;

  SELECT * INTO v_budget FROM budgets WHERE id = p_budget_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Presupuesto no encontrado');
  END IF;

  IF v_budget.status != 'draft' THEN
    RETURN jsonb_build_object('error', 'Solo presupuestos en borrador pueden marcarse como listos');
  END IF;

  -- Recalculate first
  PERFORM recalculate_budget_totals(p_budget_id);

  UPDATE budgets SET status = 'ready', updated_at = NOW() WHERE id = p_budget_id;

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id)
  VALUES (v_user_id, 'mark_ready', 'budgets', p_budget_id);

  RETURN jsonb_build_object('success', true, 'status', 'ready');
END;
$$;

REVOKE ALL ON FUNCTION mark_budget_ready(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION mark_budget_ready(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION mark_budget_ready(UUID) TO authenticated;

-- ============================================================
-- 7. RPC: accept_budget
-- ============================================================

CREATE OR REPLACE FUNCTION accept_budget(p_budget_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_budget RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No autenticado');
  END IF;

  SELECT role INTO v_user_id FROM profiles WHERE id = auth.uid() AND active = true;
  IF v_user_id NOT IN ('admin', 'supervisor') THEN
    RETURN jsonb_build_object('error', 'Sin permisos');
  END IF;

  SELECT * INTO v_budget FROM budgets WHERE id = p_budget_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Presupuesto no encontrado');
  END IF;

  IF v_budget.status != 'sent' THEN
    RETURN jsonb_build_object('error', 'Solo presupuestos enviados pueden aceptarse');
  END IF;

  UPDATE budgets SET
    status = 'accepted',
    accepted_at = NOW(),
    approved_by = auth.uid(),
    approved_at = NOW(),
    updated_at = NOW()
  WHERE id = p_budget_id;

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id)
  VALUES (auth.uid(), 'accept', 'budgets', p_budget_id);

  RETURN jsonb_build_object('success', true, 'status', 'accepted');
END;
$$;

REVOKE ALL ON FUNCTION accept_budget(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION accept_budget(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION accept_budget(UUID) TO authenticated;

-- ============================================================
-- 8. RPC: reject_budget
-- ============================================================

CREATE OR REPLACE FUNCTION reject_budget(
  p_budget_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_budget RECORD;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid() AND active = true;
  IF v_role NOT IN ('admin', 'supervisor') THEN
    RETURN jsonb_build_object('error', 'Sin permisos');
  END IF;

  SELECT * INTO v_budget FROM budgets WHERE id = p_budget_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Presupuesto no encontrado');
  END IF;

  IF v_budget.status != 'sent' THEN
    RETURN jsonb_build_object('error', 'Solo presupuestos enviados pueden rechazarse');
  END IF;

  UPDATE budgets SET
    status = 'rejected',
    rejected_at = NOW(),
    cancellation_reason = p_reason,
    updated_at = NOW()
  WHERE id = p_budget_id;

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data)
  VALUES (auth.uid(), 'reject', 'budgets', p_budget_id,
    jsonb_build_object('reason', p_reason));

  RETURN jsonb_build_object('success', true, 'status', 'rejected');
END;
$$;

REVOKE ALL ON FUNCTION reject_budget(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION reject_budget(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION reject_budget(UUID, TEXT) TO authenticated;

-- ============================================================
-- 9. RPC: cancel_budget
-- ============================================================

CREATE OR REPLACE FUNCTION cancel_budget(
  p_budget_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_budget RECORD;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid() AND active = true;
  IF v_role NOT IN ('admin', 'supervisor') THEN
    RETURN jsonb_build_object('error', 'Sin permisos');
  END IF;

  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RETURN jsonb_build_object('error', 'El motivo de cancelación es obligatorio');
  END IF;

  SELECT * INTO v_budget FROM budgets WHERE id = p_budget_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Presupuesto no encontrado');
  END IF;

  IF v_budget.status IN ('accepted', 'cancelled') THEN
    RETURN jsonb_build_object('error', 'No se puede cancelar este presupuesto');
  END IF;

  UPDATE budgets SET
    status = 'cancelled',
    cancellation_reason = TRIM(p_reason),
    updated_at = NOW()
  WHERE id = p_budget_id;

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data)
  VALUES (auth.uid(), 'cancel', 'budgets', p_budget_id,
    jsonb_build_object('reason', p_reason));

  RETURN jsonb_build_object('success', true, 'status', 'cancelled');
END;
$$;

REVOKE ALL ON FUNCTION cancel_budget(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION cancel_budget(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION cancel_budget(UUID, TEXT) TO authenticated;

-- ============================================================
-- 10. RPC: mark_budget_sent
-- ============================================================

CREATE OR REPLACE FUNCTION mark_budget_sent(p_budget_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_budget RECORD;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid() AND active = true;
  IF v_role NOT IN ('admin', 'supervisor') THEN
    RETURN jsonb_build_object('error', 'Sin permisos');
  END IF;

  SELECT * INTO v_budget FROM budgets WHERE id = p_budget_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Presupuesto no encontrado');
  END IF;

  IF v_budget.status != 'ready' THEN
    RETURN jsonb_build_object('error', 'Solo presupuestos listos pueden enviarse');
  END IF;

  UPDATE budgets SET status = 'sent', sent_at = NOW(), updated_at = NOW() WHERE id = p_budget_id;

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id)
  VALUES (auth.uid(), 'mark_sent', 'budgets', p_budget_id);

  RETURN jsonb_build_object('success', true, 'status', 'sent');
END;
$$;

REVOKE ALL ON FUNCTION mark_budget_sent(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION mark_budget_sent(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION mark_budget_sent(UUID) TO authenticated;

-- ============================================================
-- 11. TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_budgets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_budgets_updated_at ON budgets;
CREATE TRIGGER trigger_budgets_updated_at
  BEFORE UPDATE ON budgets
  FOR EACH ROW
  EXECUTE FUNCTION update_budgets_updated_at();

CREATE OR REPLACE FUNCTION update_budget_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_budget_items_updated_at ON budget_items;
CREATE TRIGGER trigger_budget_items_updated_at
  BEFORE UPDATE ON budget_items
  FOR EACH ROW
  EXECUTE FUNCTION update_budget_items_updated_at();

-- ============================================================
-- DONE
-- ============================================================
