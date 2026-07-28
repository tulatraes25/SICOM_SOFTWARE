-- 060: Restrict profiles SELECT access
-- Removes global "Authenticated users can read profiles" policy.
-- Replaces with: own profile + active staff only.
-- Responsible gets technician names ONLY via get_responsible_technicians() RPC.

-- ============================================================
-- 1. HELPER: is_active_staff()
-- ============================================================

DROP FUNCTION IF EXISTS public.is_active_staff();

CREATE OR REPLACE FUNCTION public.is_active_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND active = true
      AND role IN ('admin', 'supervisor', 'technician')
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_staff() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_staff() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_active_staff() TO authenticated;

-- ============================================================
-- 2. REMOVE GLOBAL POLICY
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can read profiles" ON profiles;
DROP POLICY IF EXISTS "users_select_own_profile" ON profiles;
DROP POLICY IF EXISTS "active_staff_select_profiles" ON profiles;

-- Also drop any legacy policies with USING (true)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- ============================================================
-- 3. OWN PROFILE POLICY
-- ============================================================

CREATE POLICY "users_select_own_profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- ============================================================
-- 4. ACTIVE STAFF POLICY
-- ============================================================

CREATE POLICY "active_staff_select_profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (public.is_active_staff());

-- ============================================================
-- 5. VALIDATION: No global SELECT on profiles
-- ============================================================

DO $$
DECLARE
  v_bad_policy RECORD;
BEGIN
  FOR v_bad_policy IN
    SELECT policyname, roles, qual
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND cmd = 'SELECT'
      AND (
        qual = 'true'
        OR qual IS NULL
      )
  LOOP
    RAISE EXCEPTION 'Global SELECT policy on profiles: % (roles: %)',
      v_bad_policy.policyname, v_bad_policy.roles;
  END LOOP;
  RAISE NOTICE 'Validation passed: no global SELECT policies on profiles';
END $$;

-- ============================================================
-- DONE
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '=== Migration 060 Complete ===';
  RAISE NOTICE 'Functions created:';
  RAISE NOTICE '  - is_active_staff() → boolean (admin, supervisor, technician)';
  RAISE NOTICE 'Policies on profiles:';
  RAISE NOTICE '  - users_select_own_profile: own row only';
  RAISE NOTICE '  - active_staff_select_profiles: admin/supervisor/technician';
  RAISE NOTICE 'Responsible access: own profile + get_responsible_technicians() RPC only';
END $$;
