-- Beta onboarding policy-acknowledgement audit trail.
ALTER TABLE public.reconfeed_beta_testers
 ADD COLUMN IF NOT EXISTS legal_terms_version text,
 ADD COLUMN IF NOT EXISTS legal_terms_accepted_at timestamptz;

CREATE OR REPLACE FUNCTION public.join_reconfeed_beta_legal(
 p_email text,p_platform text,p_interests text[],p_source text,
 p_confirm_adult boolean,p_consent boolean,p_trap text,
 p_legal_accepted boolean,p_legal_version text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='public','pg_temp'
AS $func$
DECLARE e text := lower(trim(coalesce(p_email,'')));safe_interests text;
BEGIN
 IF length(coalesce(p_trap,''))>0 THEN RETURN true;END IF;
 IF coalesce(p_confirm_adult,false) IS NOT TRUE OR coalesce(p_consent,false) IS NOT TRUE
    OR coalesce(p_legal_accepted,false) IS NOT TRUE
    OR p_legal_version IS DISTINCT FROM '2026-10-10'
 THEN RAISE EXCEPTION 'Adult affirmation and legal/privacy acknowledgements required';END IF;
 IF length(e)<6 OR length(e)>254
    OR e !~* '^[^[:space:]@]+@[^[:space:]@]+\.[a-z]{2,}$'
 THEN RAISE EXCEPTION 'Invalid email';END IF;
 IF p_platform NOT IN ('iphone','android','both','web')
 THEN RAISE EXCEPTION 'Unsupported platform';END IF;
 IF cardinality(coalesce(p_interests,'{}'::text[]))>6 OR EXISTS(
  SELECT 1 FROM unnest(coalesce(p_interests,'{}'::text[])) v
  WHERE v NOT IN ('veterans','trades','trucks','outdoors','creators','marketplace')
 ) THEN RAISE EXCEPTION 'Invalid interests';END IF;
 IF coalesce(p_source,'') !~ '^[a-zA-Z0-9_-]{1,48}$'
 THEN RAISE EXCEPTION 'Invalid source';END IF;
 safe_interests:=coalesce(nullif(array_to_string(coalesce(p_interests,'{}'::text[]),','),''),'community');
 INSERT INTO public.reconfeed_beta_testers
  (email,platform,interests,source,adult_18_plus,contact_consent,legal_terms_version,legal_terms_accepted_at)
 VALUES(e,p_platform,safe_interests,p_source,true,true,p_legal_version,now())
 ON CONFLICT DO NOTHING;
 RETURN true;
END $func$;
REVOKE ALL ON FUNCTION public.join_reconfeed_beta_legal(text,text,text[],text,boolean,boolean,text,boolean,text) FROM PUBLIC,authenticated,anon;
GRANT EXECUTE ON FUNCTION public.join_reconfeed_beta_legal(text,text,text[],text,boolean,boolean,text,boolean,text) TO anon;
