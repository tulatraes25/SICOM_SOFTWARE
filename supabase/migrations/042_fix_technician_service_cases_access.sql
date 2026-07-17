-- 042: Allow technicians to read service_cases linked to their service orders
-- Fixes "N.º undefined" in technician order views.

-- ============================================================
-- 1. ADD POLICY FOR TECHNICIAN ACCESS VIA SERVICE ORDERS
-- ============================================================

DO $$
BEGIN
  -- Drop old restrictive policy
  DROP POLICY IF EXISTS "service_cases_technician_select" ON service_cases;

  -- Technician can see:
  -- 1. Cases where they are directly assigned (claims, etc.)
  -- 2. Cases linked to service orders they are assigned to
  CREATE POLICY "service_cases_technician_select" ON service_cases
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'technician')
      AND (
        assigned_to = auth.uid()
        OR id IN (
          SELECT so.service_case_id
          FROM service_orders so
          JOIN service_order_technicians sot ON sot.service_order_id = so.id
          WHERE sot.technician_id = auth.uid()
        )
      )
    );
END $$;

-- ============================================================
-- DONE
-- ============================================================
