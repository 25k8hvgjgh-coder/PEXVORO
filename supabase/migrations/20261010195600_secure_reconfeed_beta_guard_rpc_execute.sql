-- Keep signup enforcement private to the auth.users insert trigger.
REVOKE EXECUTE ON FUNCTION public.enforce_reconfeed_beta_registration() FROM PUBLIC, anon, authenticated;
