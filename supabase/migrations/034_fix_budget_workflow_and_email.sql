-- 034: Fix budget workflow, add missing columns, create send-budget-email Edge Function
-- Does NOT modify 033. Adds columns and replaces RPCs.

-- ============================================================
-- 1. ADD MISSING COLUMNS
-- ============================================================

DO $$
BEGIN
  -- ready_by / ready_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budgets' AND column_name='ready_by') THEN
    ALTER TABLE budgets ADD COLUMN ready_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budgets' AND column_name='ready_at') THEN
    ALTER TABLE budgets ADD COLUMN ready_at TIMESTAMPTZ;
  END IF;

  -- sent_by
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budgets' AND column_name='sent_by') THEN
    ALTER TABLE budgets ADD COLUMN sent_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;

  -- accepted_registered_by / rejected_registered_by (who recorded the client response)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budgets' AND column_name='accepted_registered_by') THEN
    ALTER TABLE budgets ADD COLUMN accepted_registered_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budgets' AND column_name='rejected_registered_by') THEN
    ALTER TABLE budgets ADD COLUMN rejected_registered_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;

  -- rejection_reason (separate from cancellation_reason)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budgets' AND column_name='rejection_reason') THEN
    ALTER TABLE budgets ADD COLUMN rejection_reason TEXT;
  END IF;

  -- client_response_notes / client_response_contact
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budgets' AND column_name='client_response_notes') THEN
    ALTER TABLE budgets ADD COLUMN client_response_notes TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budgets' AND column_name='client_response_contact') THEN
    ALTER TABLE budgets ADD COLUMN client_response_contact TEXT;
  END IF;
END $$;

-- ============================================================
-- 2. DROP AND RECREATE ALL AFFECTED RPCs
-- ============================================================

-- --- mark_budget_ready ---
DROP FUNCTION IF EXISTS mark_budget_ready(UUID);

CREATE OR REPLACE FUNCTION mark_budget_ready(p_budget_id UUID)
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
  IF v_role IS NULL THEN RETURN jsonb_build_object('error', 'No autenticado'); END IF;
  IF v_role NOT IN ('admin', 'supervisor') THEN RETURN jsonb_build_object('error', 'Sin permisos'); END IF;

  SELECT * INTO v_budget FROM budgets WHERE id = p_budget_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Presupuesto no encontrado'); END IF;
  IF v_budget.status != 'draft' THEN RETURN jsonb_build_object('error', 'Solo presupuestos en borrador pueden marcarse como listos'); END IF;

  PERFORM recalculate_budget_totals(p_budget_id);

  UPDATE budgets SET
    status = 'ready',
    ready_by = auth.uid(),
    ready_at = NOW(),
    updated_at = NOW()
  WHERE id = p_budget_id;

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id)
  VALUES (auth.uid(), 'mark_ready', 'budgets', p_budget_id);

  RETURN jsonb_build_object('success', true, 'status', 'ready');
END;
$$;

REVOKE ALL ON FUNCTION mark_budget_ready(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION mark_budget_ready(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION mark_budget_ready(UUID) TO authenticated;

-- --- mark_budget_sent ---
DROP FUNCTION IF EXISTS mark_budget_sent(UUID);

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
  IF v_role IS NULL THEN RETURN jsonb_build_object('error', 'No autenticado'); END IF;
  IF v_role NOT IN ('admin', 'supervisor') THEN RETURN jsonb_build_object('error', 'Sin permisos'); END IF;

  SELECT * INTO v_budget FROM budgets WHERE id = p_budget_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Presupuesto no encontrado'); END IF;
  IF v_budget.status != 'ready' THEN RETURN jsonb_build_object('error', 'Solo presupuestos listos pueden enviarse'); END IF;

  UPDATE budgets SET
    status = 'sent',
    sent_at = NOW(),
    sent_by = auth.uid(),
    updated_at = NOW()
  WHERE id = p_budget_id;

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id)
  VALUES (auth.uid(), 'mark_sent', 'budgets', p_budget_id);

  RETURN jsonb_build_object('success', true, 'status', 'sent');
END;
$$;

REVOKE ALL ON FUNCTION mark_budget_sent(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION mark_budget_sent(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION mark_budget_sent(UUID) TO authenticated;

-- --- accept_budget (FIXED: was using v_user_id for role) ---
DROP FUNCTION IF EXISTS accept_budget(UUID);

CREATE OR REPLACE FUNCTION accept_budget(
  p_budget_id UUID,
  p_response_notes TEXT DEFAULT NULL,
  p_response_contact TEXT DEFAULT NULL
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
  IF v_role IS NULL THEN RETURN jsonb_build_object('error', 'No autenticado'); END IF;
  IF v_role NOT IN ('admin', 'supervisor') THEN RETURN jsonb_build_object('error', 'Sin permisos'); END IF;

  SELECT * INTO v_budget FROM budgets WHERE id = p_budget_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Presupuesto no encontrado'); END IF;
  IF v_budget.status != 'sent' THEN RETURN jsonb_build_object('error', 'Solo presupuestos enviados pueden aceptarse'); END IF;

  UPDATE budgets SET
    status = 'accepted',
    accepted_at = NOW(),
    accepted_registered_by = auth.uid(),
    client_response_notes = p_response_notes,
    client_response_contact = p_response_contact,
    updated_at = NOW()
  WHERE id = p_budget_id;

  INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data)
  VALUES (auth.uid(), 'accept', 'budgets', p_budget_id,
    jsonb_build_object('notes', p_response_notes, 'contact', p_response_contact));

  RETURN jsonb_build_object('success', true, 'status', 'accepted');
END;
$$;

REVOKE ALL ON FUNCTION accept_budget(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION accept_budget(UUID, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION accept_budget(UUID, TEXT, TEXT) TO authenticated;

-- --- reject_budget ---
DROP FUNCTION IF EXISTS reject_budget(UUID, TEXT);

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
  IF v_role IS NULL THEN RETURN jsonb_build_object('error', 'No autenticado'); END IF;
  IF v_role NOT IN ('admin', 'supervisor') THEN RETURN jsonb_build_object('error', 'Sin permisos'); END IF;

  SELECT * INTO v_budget FROM budgets WHERE id = p_budget_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Presupuesto no encontrado'); END IF;
  IF v_budget.status != 'sent' THEN RETURN jsonb_build_object('error', 'Solo presupuestos enviados pueden rechazarse'); END IF;

  UPDATE budgets SET
    status = 'rejected',
    rejected_at = NOW(),
    rejected_registered_by = auth.uid(),
    rejection_reason = p_reason,
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

-- --- cancel_budget (no change needed, already correct) ---

-- ============================================================
-- 3. DONE
-- ============================================================
