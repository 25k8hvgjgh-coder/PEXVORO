-- ReconFeed remains an 18+ community; signup uses the displayed eligibility notice.
-- New accounts do not collect or validate birth dates. Existing profile data is retained.
CREATE OR REPLACE FUNCTION public.create_profile_for_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  base_name text;
  selected_gender text;
  social_signup boolean := coalesce(new.raw_app_meta_data ->> 'provider', '') IN ('apple', 'facebook', 'google');
BEGIN
  selected_gender := CASE WHEN new.raw_user_meta_data ->> 'gender' IN ('MALE', 'FEMALE', 'Other')
    THEN new.raw_user_meta_data ->> 'gender' ELSE NULL END;
  IF NOT social_signup AND selected_gender IS NULL THEN
    RAISE EXCEPTION 'Choose MALE, FEMALE, or Other.';
  END IF;
  base_name := lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1), 'creator'), '[^a-zA-Z0-9_]', '', 'g'));
  IF base_name = '' THEN base_name := 'creator'; END IF;
  INSERT INTO public.profiles (id, username, display_name, birth_date, gender)
  VALUES (new.id, base_name || '_' || substr(new.id::text, 1, 6),
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name',''), nullif(new.raw_user_meta_data ->> 'full_name',''),
      nullif(split_part(coalesce(new.email,''),'@',1),''), 'Creator'), NULL, selected_gender)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$function$;
