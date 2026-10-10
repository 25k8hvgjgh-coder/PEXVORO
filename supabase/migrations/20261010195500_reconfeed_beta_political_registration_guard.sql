-- ReconFeed beta account creation guard. Applies only to NEW auth.users rows.
-- Reinstates the explicit beta signup eligibility selected in website and native app UI.
-- Do not treat this as a permanent device ban or proof of someone's real-world affiliation.
CREATE OR REPLACE FUNCTION public.enforce_reconfeed_beta_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $reconfeed$
BEGIN
  IF COALESCE(NEW.raw_user_meta_data ->> 'political_party', '') <> 'republican' THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'ReconFeed beta registration is unavailable for the selected political party.';
  END IF;
  RETURN NEW;
END;
$reconfeed$;

REVOKE ALL ON FUNCTION public.enforce_reconfeed_beta_registration() FROM PUBLIC;
DROP TRIGGER IF EXISTS reconfeed_beta_registration_guard ON auth.users;
CREATE TRIGGER reconfeed_beta_registration_guard
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_reconfeed_beta_registration();
