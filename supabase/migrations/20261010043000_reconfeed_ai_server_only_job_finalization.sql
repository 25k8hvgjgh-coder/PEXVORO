-- Restrict AI job creation/finalization to the trusted server using the Supabase service role.
-- Authenticated users may read only their own job rows; they cannot forge provider IDs/status.
DROP FUNCTION IF EXISTS public.reserve_ai_generation(text);
DROP FUNCTION IF EXISTS public.finalize_ai_generation(uuid, text, text);

CREATE OR REPLACE FUNCTION public.reserve_ai_generation(p_user_id uuid, p_workflow text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $rf_reserve$
DECLARE hourly_count integer; daily_count integer; job_id uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Server authorization required.';
  END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'User ID is required.'; END IF;
  IF p_workflow IS NULL OR p_workflow NOT IN ('text-video','image-video','image','video-transform') THEN
    RAISE EXCEPTION 'Unsupported AI workflow.';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_user_id::text));
  SELECT count(*) FILTER (WHERE created_at >= now() - interval '1 hour')::integer, count(*)::integer
  INTO hourly_count, daily_count
  FROM public.ai_generation_jobs
  WHERE user_id = p_user_id AND created_at >= now() - interval '24 hours';
  IF hourly_count >= 3 OR daily_count >= 10 THEN
    RAISE EXCEPTION 'AI_RATE_LIMIT: You have reached the AI generation limit. Try again later.';
  END IF;
  INSERT INTO public.ai_generation_jobs (user_id, workflow, status)
  VALUES (p_user_id, p_workflow, 'starting') RETURNING id INTO job_id;
  RETURN job_id;
END;
$rf_reserve$;

CREATE OR REPLACE FUNCTION public.finalize_ai_generation(p_user_id uuid, p_job_id uuid, p_prediction_id text, p_status text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $rf_finalize$
DECLARE updated_count integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Server authorization required.';
  END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'User ID is required.'; END IF;
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
  WHERE id = p_job_id AND user_id = p_user_id;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count = 1;
END;
$rf_finalize$;

REVOKE ALL ON FUNCTION public.reserve_ai_generation(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_generation(uuid, text) TO service_role;
REVOKE ALL ON FUNCTION public.finalize_ai_generation(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_ai_generation(uuid, uuid, text, text) TO service_role;
