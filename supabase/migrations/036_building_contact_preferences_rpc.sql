-- 036: Add RPC for building contact document preferences
-- and allow supervisor to update document flags.

-- ============================================================
-- 1. RPC: set_building_contact_document_preferences
-- ============================================================

CREATE OR REPLACE FUNCTION set_building_contact_document_preferences(
  p_contact_id UUID,
  p_receives_reports BOOLEAN DEFAULT NULL,
  p_receives_budgets BOOLEAN DEFAULT NULL,
  p_receives_invoices BOOLEAN DEFAULT NULL,
  p_receives_service_orders BOOLEAN DEFAULT NULL,
  p_receives_claim_updates BOOLEAN DEFAULT NULL,
  p_receives_general_notices BOOLEAN DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_role TEXT;
  v_contact RECORD;
BEGIN
  SELECT role INTO v_user_role FROM profiles WHERE id = auth.uid() AND active = true;
  IF v_user_role IS NULL THEN
    RETURN jsonb_build_object('error', 'No autenticado');
  END IF;

  IF v_user_role NOT IN ('admin', 'supervisor') THEN
    RETURN jsonb_build_object('error', 'Sin permisos');
  END IF;

  SELECT * INTO v_contact FROM building_contacts WHERE id = p_contact_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Contacto no encontrado');
  END IF;

  UPDATE building_contacts SET
    receives_reports = COALESCE(p_receives_reports, receives_reports),
    receives_budgets = COALESCE(p_receives_budgets, receives_budgets),
    receives_invoices = COALESCE(p_receives_invoices, receives_invoices),
    receives_service_orders = COALESCE(p_receives_service_orders, receives_service_orders),
    receives_claim_updates = COALESCE(p_receives_claim_updates, receives_claim_updates),
    receives_general_notices = COALESCE(p_receives_general_notices, receives_general_notices),
    updated_at = NOW()
  WHERE id = p_contact_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION set_building_contact_document_preferences(UUID, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION set_building_contact_document_preferences(UUID, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION set_building_contact_document_preferences(UUID, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated;

-- ============================================================
-- 2. Allow supervisor to UPDATE building_contacts (document flags only)
-- ============================================================

DO $$
BEGIN
  DROP POLICY IF EXISTS "bc_supervisor_update" ON building_contacts;

  CREATE POLICY "bc_supervisor_update" ON building_contacts
    FOR UPDATE USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'supervisor')
    );
END $$;

-- ============================================================
-- DONE
-- ============================================================
