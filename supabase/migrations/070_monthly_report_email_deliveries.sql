-- 070: Create monthly_report_email_deliveries for audit trail
-- Tracks email delivery attempts for monthly reports.

CREATE TABLE IF NOT EXISTS public.monthly_report_email_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monthly_report_id uuid NOT NULL REFERENCES public.monthly_reports(id) ON DELETE CASCADE,
  pdf_version integer NOT NULL,
  recipients jsonb NOT NULL,
  subject text NOT NULL,
  sent_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at timestamptz,
  provider_message_id text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mred_monthly_report_id ON public.monthly_report_email_deliveries(monthly_report_id);
CREATE INDEX IF NOT EXISTS idx_mred_status ON public.monthly_report_email_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_mred_created_at ON public.monthly_report_email_deliveries(created_at);
CREATE INDEX IF NOT EXISTS idx_mred_provider_message_id ON public.monthly_report_email_deliveries(provider_message_id) WHERE provider_message_id IS NOT NULL;

-- RLS: service_role bypasses RLS, authenticated can only read their own deliveries.
-- No INSERT/UPDATE/DELETE policies for authenticated or anon: the Edge Function
-- uses service_role (which bypasses RLS), so no extra grants are required.
ALTER TABLE public.monthly_report_email_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_own" ON public.monthly_report_email_deliveries
  FOR SELECT
  TO authenticated
  USING (sent_by = auth.uid());

COMMENT ON TABLE public.monthly_report_email_deliveries IS 'Audit trail for monthly report email delivery attempts.';
