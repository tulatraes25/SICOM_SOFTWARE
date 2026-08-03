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
BEGIN
  -- Function must exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_public_elevator_history_by_token'
  ) THEN
    RAISE EXCEPTION 'Function get_public_elevator_history_by_token does not exist';
  END IF;

  -- anon must not be able to execute
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    JOIN pg_proc_acl acl ON acl.proacl IS NOT NULL
    WHERE n.nspname = 'public'
      AND p.proname = 'get_public_elevator_history_by_token'
      AND EXISTS (SELECT 1 FROM unnest(p.proacl) a WHERE a.grantee = 'anon'::regrole)
  ) THEN
    RAISE EXCEPTION 'anon can still execute get_public_elevator_history_by_token';
  END IF;

  -- authenticated must not be able to execute
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    JOIN pg_proc_acl acl ON acl.proacl IS NOT NULL
    WHERE n.nspname = 'public'
      AND p.proname = 'get_public_elevator_history_by_token'
      AND EXISTS (SELECT 1 FROM unnest(p.proacl) a WHERE a.grantee = 'authenticated'::regrole)
  ) THEN
    RAISE EXCEPTION 'authenticated can still execute get_public_elevator_history_by_token';
  END IF;

  -- get_public_elevator_by_token must still be executable by anon
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    JOIN pg_proc_acl acl ON acl.proacl IS NOT NULL
    WHERE n.nspname = 'public'
      AND p.proname = 'get_public_elevator_by_token'
      AND EXISTS (SELECT 1 FROM unnest(p.proacl) a WHERE a.grantee = 'anon'::regrole)
  ) THEN
    RAISE EXCEPTION 'get_public_elevator_by_token lost anon access';
  END IF;

  -- register_public_qr_scan must still be executable by anon
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    JOIN pg_proc_acl acl ON acl.proacl IS NOT NULL
    WHERE n.nspname = 'public'
      AND p.proname = 'register_public_qr_scan'
      AND EXISTS (SELECT 1 FROM unnest(p.proacl) a WHERE a.grantee = 'anon'::regrole)
  ) THEN
    RAISE EXCEPTION 'register_public_qr_scan lost anon access';
  END IF;

  RAISE NOTICE 'Migration 069 verification passed';
END $$;
