-- Limit creator-accessible deletion-request fields to protect internal notes.
REVOKE SELECT,INSERT ON public.account_deletion_requests FROM authenticated;
GRANT SELECT(id,user_id,requested_at,status,resolved_at) ON public.account_deletion_requests TO authenticated;
GRANT INSERT(user_id) ON public.account_deletion_requests TO authenticated;
