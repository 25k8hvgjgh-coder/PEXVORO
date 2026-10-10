-- Non-destructive, query-plan-only improvements.
CREATE INDEX IF NOT EXISTS blocked_accounts_blocked_id_idx ON public.blocked_accounts(blocked_id);
CREATE INDEX IF NOT EXISTS comment_likes_user_id_idx ON public.comment_likes(user_id);
CREATE INDEX IF NOT EXISTS tester_issues_reporter_id_idx ON public.tester_issues(reporter_id,created_at DESC);
-- Preserve existing membership/privacy rules, reducing auth evaluation overhead.
ALTER POLICY "Like comments as self" ON public.comment_likes
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY "Unlike comments as self" ON public.comment_likes
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "Testers can see own issues" ON public.tester_issues
  USING ((SELECT auth.uid()) = reporter_id);
ALTER POLICY "Testers can submit own issues" ON public.tester_issues
  WITH CHECK ((SELECT auth.uid()) = reporter_id AND status='open');
ALTER POLICY "Report reviewers read issues" ON public.tester_issues
  USING (((SELECT auth.jwt())->'app_metadata'->>'tester_report_reviewer')='true');
ALTER POLICY "Report reviewers triage issues" ON public.tester_issues
  USING (((SELECT auth.jwt())->'app_metadata'->>'tester_report_reviewer')='true')
  WITH CHECK (((SELECT auth.jwt())->'app_metadata'->>'tester_report_reviewer')='true');
