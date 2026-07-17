-- 040: Allow service_order as origin_type in service_cases
-- Adds 'service_order' to the CHECK constraint without breaking existing data.

-- ============================================================
-- 1. UPDATE CHECK CONSTRAINT
-- ============================================================

ALTER TABLE public.service_cases
  DROP CONSTRAINT IF EXISTS service_cases_origin_type_check;

ALTER TABLE public.service_cases
  ADD CONSTRAINT service_cases_origin_type_check
  CHECK (
    origin_type IN (
      'budget',
      'claim',
      'scheduled_service',
      'direct_report',
      'service_order'
    )
  );

-- ============================================================
-- DONE
-- ============================================================
