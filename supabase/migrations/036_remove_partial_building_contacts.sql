-- 036: Remove partial building_contacts objects from failed 035
-- and drop the preferences RPC that depends on it.

-- ============================================================
-- 1. DROP RPC DEPENDING ON building_contacts
-- ============================================================

DROP FUNCTION IF EXISTS public.set_building_contact_document_preferences(UUID, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN);

-- ============================================================
-- 2. DROP building_contacts AND RELATED OBJECTS
-- ============================================================

-- Policies
DO $$
BEGIN
  DROP POLICY IF EXISTS "bc_admin_all" ON building_contacts;
  DROP POLICY IF EXISTS "bc_supervisor_select" ON building_contacts;
  DROP POLICY IF EXISTS "bc_supervisor_update" ON building_contacts;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Trigger and function
DROP TRIGGER IF EXISTS trigger_building_contacts_updated_at ON building_contacts;
DROP FUNCTION IF EXISTS public.update_building_contacts_updated_at();

-- Table (CASCADE removes indexes)
DROP TABLE IF EXISTS public.building_contacts CASCADE;

-- ============================================================
-- DONE
-- ============================================================
