-- ReconFeed authenticated account deletion request queue.
-- Intake alone does not delete any customer content.
CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL UNIQUE,
 requested_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_review','completed','rejected')),
 resolved_at timestamptz,
 operator_notes text
);
CREATE INDEX IF NOT EXISTS account_deletion_requests_pending_idx
 ON public.account_deletion_requests(requested_at ASC) WHERE status='pending';
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_deletion_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.account_deletion_requests TO authenticated;
DROP POLICY IF EXISTS "Own account deletion request visible" ON public.account_deletion_requests;
CREATE POLICY "Own account deletion request visible" ON public.account_deletion_requests
 FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS "Authenticated account owner requests deletion" ON public.account_deletion_requests;
CREATE POLICY "Authenticated account owner requests deletion" ON public.account_deletion_requests
 FOR INSERT TO authenticated WITH CHECK (
  user_id=(SELECT auth.uid()) AND status='pending'
  AND resolved_at IS NULL AND operator_notes IS NULL
);
