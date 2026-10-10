-- ReconFeed P0 security hardening.
-- Personal DOB and gender are only used for adult eligibility and signup UX.
-- Expose only public creator profile fields through PostgREST.
REVOKE ALL PRIVILEGES ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, username, display_name, bio, avatar_url, created_at)
  ON TABLE public.profiles TO anon, authenticated;
GRANT UPDATE (display_name, bio, avatar_url)
  ON TABLE public.profiles TO authenticated;

-- These are internal trigger/event-trigger functions, not public RPC endpoints.
REVOKE EXECUTE ON FUNCTION public.create_profile_for_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
