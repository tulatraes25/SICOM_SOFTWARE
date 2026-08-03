-- 069: Disable public elevator history RPC
-- Restricts get_public_elevator_history_by_token to service_role only.
-- No data changes. No table changes. No function body changes.

-- ============================================================
-- 1. RESTRICT get_public_elevator_history_by_token
-- ============================================================
REVOKE ALL ON FUNCTION public.get_public_elevator_history_by_token(TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_elevator_history_by_token(TEXT, INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.get_public_elevator_history_by_token(TEXT, INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_elevator_history_by_token(TEXT, INTEGER) TO service_role;

-- ============================================================
-- 2. VERIFICATION
-- ============================================================
DO $$
DECLARE
  v_history_oid OID :=
    to_regprocedure(
      'public.get_public_elevator_history_by_token(text,integer)'
    );

  v_elevator_oid OID :=
    to_regprocedure(
      'public.get_public_elevator_by_token(text)'
    );

  v_scan_oid OID :=
    to_regprocedure(
      'public.register_public_qr_scan(text,text)'
    );
BEGIN
  IF v_history_oid IS NULL THEN
    RAISE EXCEPTION
      'Function get_public_elevator_history_by_token(text,integer) does not exist';
  END IF;

  IF v_elevator_oid IS NULL THEN
    RAISE EXCEPTION
      'Function get_public_elevator_by_token(text) does not exist';
  END IF;

  IF v_scan_oid IS NULL THEN
    RAISE EXCEPTION
      'Function register_public_qr_scan(text,text) does not exist';
  END IF;

  IF has_function_privilege(
    'anon',
    v_history_oid,
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION
      'anon can still execute public elevator history';
  END IF;

  IF has_function_privilege(
    'authenticated',
    v_history_oid,
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION
      'authenticated can still execute public elevator history';
  END IF;

  IF NOT has_function_privilege(
    'service_role',
    v_history_oid,
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION
      'service_role lost access to public elevator history';
  END IF;

  IF NOT has_function_privilege(
    'anon',
    v_elevator_oid,
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION
      'get_public_elevator_by_token lost anon access';
  END IF;

  IF NOT has_function_privilege(
    'anon',
    v_scan_oid,
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION
      'register_public_qr_scan lost anon access';
  END IF;

  RAISE NOTICE
    'Migration 069 verification passed';
END $$;
