-- 044: Allow service order review event types
-- Adds corrections_requested and order_approved to the CHECK constraint.

-- ============================================================
-- 1. UPDATE CHECK CONSTRAINT
-- ============================================================

ALTER TABLE public.service_order_events
  DROP CONSTRAINT IF EXISTS service_order_events_event_type_check;

ALTER TABLE public.service_order_events
  ADD CONSTRAINT service_order_events_event_type_check
  CHECK (
    event_type IN (
      'order_created',
      'marked_ready',
      'technician_assigned',
      'technician_removed',
      'technician_notified',
      'order_started',
      'visit_registered',
      'progress_added',
      'order_completed',
      'order_cancelled',
      'order_reopened',
      'pdf_generated',
      'email_sent',
      'corrections_requested',
      'order_approved'
    )
  );

-- ============================================================
-- DONE
-- ============================================================
