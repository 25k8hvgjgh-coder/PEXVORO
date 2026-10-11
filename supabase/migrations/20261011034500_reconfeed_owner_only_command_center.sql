-- Keep the owner-only command center authorization consistent across reinstalls.
-- Do not grant this permission to moderators, testers or other ReconFeed staff.
CREATE OR REPLACE FUNCTION public.reconfeed_is_command_center_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
 SELECT auth.uid() = '8287fc6f-dd23-48d8-988e-388a8c93fe7b'::uuid
  AND EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id=auth.uid()
      AND u.email_confirmed_at IS NOT NULL
      AND u.raw_app_meta_data->>'tester_report_reviewer' = 'true'
      AND u.raw_app_meta_data->>'reconfeed_command_center_admin' = 'true'
  )
$function$;
REVOKE EXECUTE ON FUNCTION public.reconfeed_is_command_center_owner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconfeed_is_command_center_owner() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.reconfeed_command_center_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconfeed_command_center_summary() TO authenticated;
