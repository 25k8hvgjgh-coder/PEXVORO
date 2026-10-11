-- After the /api/beta-signup deployment adopted join_reconfeed_beta_legal,
-- disable the older direct public signup function which has no terms fields.
REVOKE EXECUTE ON FUNCTION public.join_reconfeed_beta(text,text,text[],text,boolean,boolean,text) FROM PUBLIC,anon,authenticated;
