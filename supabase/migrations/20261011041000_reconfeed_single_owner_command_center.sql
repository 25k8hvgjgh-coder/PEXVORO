-- Command Center: immutable single owner permission. Viewer flags alone grant nothing.
CREATE OR REPLACE FUNCTION public.reconfeed_is_command_center_owner()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
 SELECT auth.uid() = '8287fc6f-dd23-48d8-988e-388a8c93fe7b'::uuid
  AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id=auth.uid()
      AND u.raw_app_meta_data->>'tester_report_reviewer'='true')
$$;
REVOKE ALL ON FUNCTION public.reconfeed_is_command_center_owner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconfeed_is_command_center_owner() TO authenticated;

-- Both overview RPC and any data-reading UI are checked against the exact owner.
CREATE OR REPLACE FUNCTION public.reconfeed_command_center_summary()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE result jsonb;
BEGIN
 IF NOT public.reconfeed_is_command_center_owner() THEN
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

-- Reporters may still view their own reports. Only owner can see/triage all.
ALTER POLICY "Report reviewers read issues" ON public.tester_issues
USING ((SELECT public.reconfeed_is_command_center_owner()));
ALTER POLICY "Report reviewers triage issues" ON public.tester_issues
USING ((SELECT public.reconfeed_is_command_center_owner()))
WITH CHECK ((SELECT public.reconfeed_is_command_center_owner()));

-- Original private screenshots stay visible to their uploader, while all-report
-- screenshot access belongs exclusively to the single Command Center owner.
ALTER POLICY "Report reviewers view screenshots" ON storage.objects
USING (bucket_id='tester-screenshots' AND
 (SELECT public.reconfeed_is_command_center_owner()));
