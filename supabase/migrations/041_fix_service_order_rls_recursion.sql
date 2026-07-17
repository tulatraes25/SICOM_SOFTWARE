-- 041: Fix RLS recursion in service_order_technicians
-- Creates SECURITY DEFINER helper functions and recreates policies.

-- ============================================================
-- 1. HELPER FUNCTIONS (bypass RLS)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_service_order_technician(p_service_order_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.service_order_technicians
    WHERE service_order_id = p_service_order_id
      AND technician_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_service_order_technician(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_service_order_technician(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_service_order_technician(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_service_order_lead_technician(p_service_order_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.service_order_technicians
    WHERE service_order_id = p_service_order_id
      AND technician_id = auth.uid()
      AND is_lead = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_service_order_lead_technician(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_service_order_lead_technician(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_service_order_lead_technician(UUID) TO authenticated;

-- ============================================================
-- 2. DROP OLD POLICIES
-- ============================================================

DO $$
BEGIN
  -- service_order_technicians
  DROP POLICY IF EXISTS "sot_admin_all" ON service_order_technicians;
  DROP POLICY IF EXISTS "sot_supervisor_all" ON service_order_technicians;
  DROP POLICY IF EXISTS "sot_technician_select" ON service_order_technicians;

  -- service_orders
  DROP POLICY IF EXISTS "so_admin_all" ON service_orders;
  DROP POLICY IF EXISTS "so_supervisor_all" ON service_orders;
  DROP POLICY IF EXISTS "so_technician_select" ON service_orders;

  -- service_order_events
  DROP POLICY IF EXISTS "soe_admin_supervisor" ON service_order_events;
  DROP POLICY IF EXISTS "soe_technician_select" ON service_order_events;

  -- service_order_progress
  DROP POLICY IF EXISTS "sop_admin_supervisor" ON service_order_progress;
  DROP POLICY IF EXISTS "sop_technician" ON service_order_progress;
END $$;

-- ============================================================
-- 3. RECREATE POLICIES (no recursion)
-- ============================================================

-- service_order_technicians
CREATE POLICY "sot_admin_all" ON service_order_technicians FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','supervisor'))
);

CREATE POLICY "sot_technician_select_own" ON service_order_technicians
  FOR SELECT USING (technician_id = auth.uid());

-- service_orders
CREATE POLICY "so_admin_all" ON service_orders FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','supervisor'))
);

CREATE POLICY "so_technician_select" ON service_orders FOR SELECT USING (
  public.is_service_order_technician(id)
);

-- service_order_events
CREATE POLICY "soe_admin_supervisor" ON service_order_events FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','supervisor'))
);

CREATE POLICY "soe_technician_select" ON service_order_events FOR SELECT USING (
  public.is_service_order_technician(service_order_id)
);

-- service_order_progress
CREATE POLICY "sop_admin_supervisor" ON service_order_progress FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','supervisor'))
);

CREATE POLICY "sop_technician_all" ON service_order_progress FOR ALL USING (
  technician_id = auth.uid()
);

-- ============================================================
-- DONE
-- ============================================================
