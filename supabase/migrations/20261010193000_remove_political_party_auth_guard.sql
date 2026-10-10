-- Keep ReconFeed registration independent of political affiliation.
-- Earlier versions attached this guard to auth.users; remove it if installed.
DROP TRIGGER IF EXISTS reconfeed_beta_registration_guard ON auth.users;
DROP FUNCTION IF EXISTS public.enforce_reconfeed_beta_registration();
