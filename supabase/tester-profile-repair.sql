-- Profile edits remain restricted to the account owner by existing RLS.
GRANT UPDATE (username) ON public.profiles TO authenticated;
-- Public beta labels contain no private account fields.
GRANT SELECT (is_beta_tester) ON public.profiles TO anon, authenticated;
CREATE POLICY "Report reviewers read issues" ON public.tester_issues FOR SELECT TO authenticated
USING ((auth.jwt()->'app_metadata'->>'tester_report_reviewer') = 'true');
GRANT UPDATE (status,updated_at) ON public.tester_issues TO authenticated;
CREATE POLICY "Report reviewers triage issues" ON public.tester_issues FOR UPDATE TO authenticated
USING ((auth.jwt()->'app_metadata'->>'tester_report_reviewer') = 'true')
WITH CHECK ((auth.jwt()->'app_metadata'->>'tester_report_reviewer') = 'true');
CREATE POLICY "Report reviewers view screenshots" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='tester-screenshots' AND (auth.jwt()->'app_metadata'->>'tester_report_reviewer')='true');
