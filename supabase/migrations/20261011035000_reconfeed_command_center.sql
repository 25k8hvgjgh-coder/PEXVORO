-- ReconFeed: owner/reviewer-only Command Center aggregates and contact list.
-- App never receives a service-role key. Every request checks the authenticated
-- user's current server-side app_metadata, not a client-controlled boolean.
CREATE OR REPLACE FUNCTION public.reconfeed_command_center_summary()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
   SELECT 1 FROM auth.users u
   WHERE u.id = auth.uid() AND u.raw_app_meta_data->>'tester_report_reviewer'='true'
 ) THEN
  RAISE EXCEPTION 'Command Center access denied' USING ERRCODE = '42501';
 END IF;
 SELECT jsonb_build_object(
  'issues_total',(SELECT count(*) FROM public.tester_issues),
  'issues_open',(SELECT count(*) FROM public.tester_issues WHERE status='open'),
  'issues_in_progress',(SELECT count(*) FROM public.tester_issues WHERE status='in_progress'),
  'issues_fixed',(SELECT count(*) FROM public.tester_issues WHERE status='fixed'),
  'issues_with_screenshot',(SELECT count(*) FROM public.tester_issues WHERE screenshot_path IS NOT NULL),
  'latest_issue_at',(SELECT max(created_at) FROM public.tester_issues),
  'tester_signups',(SELECT count(*) FROM public.reconfeed_beta_testers),
  'latest_signup_at',(SELECT max(created_at) FROM public.reconfeed_beta_testers),
  'surveys_total',(SELECT count(*) FROM public.reconfeed_research_responses),
  'registered_accounts',(SELECT count(*) FROM auth.users),
  'public_posts',(SELECT count(*) FROM public.posts WHERE visibility='public'),
  'active_stories',(SELECT count(*) FROM public.stories WHERE expires_at>now()),
  'recent_signups',coalesce((
   SELECT jsonb_agg(jsonb_build_object(
    'email',email,'platform',platform,'status',status,'created_at',created_at
   ) ORDER BY created_at DESC)
   FROM (SELECT email,platform,status,created_at FROM public.reconfeed_beta_testers ORDER BY created_at DESC LIMIT 30) q
  ),'[]'::jsonb),
  'recent_feedback',coalesce((
   SELECT jsonb_agg(jsonb_build_object(
    'biggest_need',left(coalesce(biggest_need,''),500),
    'feature_interests',feature_interests,'willing_to_test',willing_to_test,
    'created_at',created_at
   ) ORDER BY created_at DESC)
   FROM (SELECT biggest_need,feature_interests,willing_to_test,created_at
    FROM public.reconfeed_research_responses ORDER BY created_at DESC LIMIT 30) q
  ),'[]'::jsonb)
 ) INTO result;
 RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.reconfeed_command_center_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconfeed_command_center_summary() TO authenticated;
-- Beta applications must pass the validated rate-limited website RPC.
-- SECURITY DEFINER join_reconfeed_beta_legal executes as its owner.
REVOKE INSERT ON TABLE public.reconfeed_beta_testers FROM anon, authenticated;