-- Restrict public profile reads to fields intended to be shown to other users.
-- Run once against the deployed Supabase database before considering production privacy hardened.
BEGIN;
REVOKE ALL PRIVILEGES ON TABLE public.profiles FROM anon, authenticated;
GRANT SELECT (id, username, display_name, bio, avatar_url, created_at) ON TABLE public.profiles TO anon, authenticated;
GRANT UPDATE (display_name, bio, avatar_url) ON TABLE public.profiles TO authenticated;
COMMIT;
