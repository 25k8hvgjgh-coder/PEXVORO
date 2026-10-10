-- Social signup does not collect birth date. Only Auth-managed provider metadata
-- can grant this exception; user-editable metadata cannot select a provider.
CREATE OR REPLACE FUNCTION public.create_profile_for_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  base_name text;
  dob date;
  selected_gender text;
  social_signup boolean := coalesce(new.raw_app_meta_data ->> 'provider', '') IN ('apple', 'facebook', 'google');
BEGIN
  IF social_signup THEN
    dob := NULL;
    selected_gender := CASE WHEN new.raw_user_meta_data ->> 'gender' IN ('MALE', 'FEMALE', 'Other')
      THEN new.raw_user_meta_data ->> 'gender' ELSE NULL END;
  ELSE
    BEGIN
      dob := (new.raw_user_meta_data ->> 'date_of_birth')::date;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'A valid date of birth is required; ReconFeed is for adults 18 and older.';
    END;
    IF dob IS NULL OR dob > (current_date - interval '18 years')::date OR dob < date '1900-01-01' THEN
      RAISE EXCEPTION 'ReconFeed is for adults 18 and older.';
    END IF;
    selected_gender := new.raw_user_meta_data ->> 'gender';
    IF selected_gender IS NULL OR selected_gender NOT IN ('MALE', 'FEMALE', 'Other') THEN
      RAISE EXCEPTION 'Choose MALE, FEMALE, or Other.';
    END IF;
  END IF;
  base_name := lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1), 'creator'), '[^a-zA-Z0-9_]', '', 'g'));
  IF base_name = '' THEN base_name := 'creator'; END IF;
  INSERT INTO public.profiles (id, username, display_name, birth_date, gender)
  VALUES (new.id, base_name || '_' || substr(new.id::text, 1, 6),
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name',''), nullif(new.raw_user_meta_data ->> 'full_name',''),
      nullif(split_part(coalesce(new.email,''),'@',1),''), 'Creator'), dob, selected_gender)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$function$;
