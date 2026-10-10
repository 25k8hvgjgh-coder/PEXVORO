-- Enforce ReconFeed's declared beta-registration eligibility at the Auth database boundary.
-- Existing accounts are unaffected. No device fingerprinting or device ban is attempted.
-- A signup without the required party metadata is denied, including direct API requests.
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

DROP TRIGGER IF EXISTS reconfeed_beta_registration_guard ON auth.users;
CREATE TRIGGER reconfeed_beta_registration_guard
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_reconfeed_beta_registration();