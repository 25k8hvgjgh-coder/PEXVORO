-- ReconFeed: require complete signup metadata and protect/limit paid AI generations.
CREATE OR REPLACE FUNCTION public.create_profile_for_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  base_name text;
  dob date;
  selected_gender text;
BEGIN
  BEGIN
    dob := (new.raw_user_meta_data ->> 'date_of_birth')::date;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'A valid date of birth is required; ReconFeed is for adults 18 and older.';
  END;

  IF dob IS NULL OR dob > (current_date - interval '18 years')::date OR dob < date '1900-01-01' THEN
    RAISE EXCEPTION 'ReconFeed is for adults 18 and older.';
  END IF;

  selected_gender := new.raw_user_meta_data ->> 'gender';
  IF selected_gender IS NULL OR selected_gender NOT IN ('MALE','FEMALE','Other') THEN
    RAISE EXCEPTION 'Choose MALE, FEMALE, or Other.';
  END IF;

  base_name := lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1), 'creator'), '[^a-zA-Z0-9_]', '', 'g'));
  IF base_name = '' THEN base_name := 'creator'; END IF;

  INSERT INTO public.profiles (id, username, display_name, birth_date, gender)
  VALUES (
    new.id,
    base_name || '_' || substr(new.id::text, 1, 6),
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name',''), nullif(split_part(coalesce(new.email,''),'@',1),''), 'Creator'),
    dob,
    selected_gender
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

CREATE TABLE IF NOT EXISTS public.ai_generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_prediction_id text UNIQUE,
  workflow text NOT NULL CHECK (workflow IN ('text-video','image-video','image','video-transform')),
  status text NOT NULL DEFAULT 'starting' CHECK (status IN ('starting','queued','processing','succeeded','failed','canceled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_generation_jobs_user_created_idx
  ON public.ai_generation_jobs (user_id, created_at DESC);

ALTER TABLE public.ai_generation_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own AI generation jobs" ON public.ai_generation_jobs;
CREATE POLICY "Users read own AI generation jobs"
  ON public.ai_generation_jobs FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

REVOKE ALL PRIVILEGES ON TABLE public.ai_generation_jobs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.ai_generation_jobs TO authenticated;

CREATE OR REPLACE FUNCTION public.reserve_ai_generation(p_workflow text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid;
  hourly_count integer;
  daily_count integer;
  job_id uuid;
BEGIN
  actor_id := auth.uid();
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;
  IF p_workflow IS NULL OR p_workflow NOT IN ('text-video','image-video','image','video-transform') THEN
    RAISE EXCEPTION 'Unsupported AI workflow.';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(actor_id::text));

  SELECT
    count(*) FILTER (WHERE created_at >= now() - interval '1 hour')::integer,
    count(*)::integer
  INTO hourly_count, daily_count
  FROM public.ai_generation_jobs
  WHERE user_id = actor_id
    AND created_at >= now() - interval '24 hours';

  IF hourly_count >= 3 OR daily_count >= 10 THEN
    RAISE EXCEPTION 'AI_RATE_LIMIT: You have reached the AI generation limit. Try again later.';
  END IF;

  INSERT INTO public.ai_generation_jobs (user_id, workflow, status)
  VALUES (actor_id, p_workflow, 'starting')
  RETURNING id INTO job_id;

  RETURN job_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_ai_generation(
  p_job_id uuid,
  p_prediction_id text,
  p_status text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid;
  updated_count integer;
BEGIN
  actor_id := auth.uid();
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('starting','queued','processing','succeeded','failed','canceled') THEN
    RAISE EXCEPTION 'Unsupported AI status.';
  END IF;
  IF p_prediction_id IS NOT NULL AND (length(p_prediction_id) < 6 OR length(p_prediction_id) > 100 OR p_prediction_id !~ '^[A-Za-z0-9_-]+$') THEN
    RAISE EXCEPTION 'Invalid provider prediction ID.';
  END IF;

  UPDATE public.ai_generation_jobs
  SET provider_prediction_id = COALESCE(p_prediction_id, provider_prediction_id),
      status = p_status,
      updated_at = now()
  WHERE id = p_job_id
    AND user_id = actor_id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count = 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reserve_ai_generation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_ai_generation(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.finalize_ai_generation(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_ai_generation(uuid, text, text) TO authenticated;
