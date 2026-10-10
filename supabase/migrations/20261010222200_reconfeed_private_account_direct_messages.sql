-- Account-to-account messaging, independent of listing marketplace messaging.
CREATE TABLE IF NOT EXISTS public.direct_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
 reply_to_id uuid REFERENCES public.direct_messages(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT direct_messages_not_to_self CHECK (sender_id <> recipient_id)
);
CREATE INDEX IF NOT EXISTS direct_messages_sender_time_idx ON public.direct_messages(sender_id,created_at DESC);
CREATE INDEX IF NOT EXISTS direct_messages_recipient_time_idx ON public.direct_messages(recipient_id,created_at DESC);
CREATE INDEX IF NOT EXISTS direct_messages_reply_idx ON public.direct_messages(reply_to_id) WHERE reply_to_id IS NOT NULL;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.direct_messages FROM PUBLIC, anon;
GRANT SELECT, INSERT ON public.direct_messages TO authenticated;

-- Block checks use a SECURITY DEFINER helper because users cannot read blocks
-- created by other accounts under blocked_accounts RLS.
CREATE OR REPLACE FUNCTION public.reconfeed_can_send_direct_message(p_sender uuid,p_recipient uuid,p_reply_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
 SELECT p_sender = (SELECT auth.uid())
 AND p_sender IS DISTINCT FROM p_recipient
 AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = p_sender)
 AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = p_recipient)
 AND NOT EXISTS(SELECT 1 FROM public.blocked_accounts b
   WHERE (b.blocker_id=p_sender AND b.blocked_id=p_recipient)
      OR (b.blocker_id=p_recipient AND b.blocked_id=p_sender))
 AND COALESCE((SELECT ps.allow_messages FROM public.profile_settings ps WHERE ps.user_id=p_recipient),'followers') <> 'none'
 AND (
   COALESCE((SELECT ps.allow_messages FROM public.profile_settings ps WHERE ps.user_id=p_recipient),'followers') = 'everyone'
   OR (
     EXISTS(SELECT 1 FROM public.follows f WHERE f.follower_id=p_sender AND f.following_id=p_recipient)
     AND EXISTS(SELECT 1 FROM public.follows f WHERE f.follower_id=p_recipient AND f.following_id=p_sender)
   )
 )
 AND (p_reply_id IS NULL OR EXISTS(
   SELECT 1 FROM public.direct_messages parent WHERE parent.id=p_reply_id
   AND (
     (parent.sender_id=p_sender AND parent.recipient_id=p_recipient)
     OR (parent.sender_id=p_recipient AND parent.recipient_id=p_sender)
   )
 ));
$function$;
REVOKE ALL ON FUNCTION public.reconfeed_can_send_direct_message(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reconfeed_can_send_direct_message(uuid,uuid,uuid) TO authenticated;
DROP POLICY IF EXISTS "DM participants read their messages" ON public.direct_messages;
CREATE POLICY "DM participants read their messages" ON public.direct_messages
 FOR SELECT TO authenticated USING ((SELECT auth.uid())=sender_id OR (SELECT auth.uid())=recipient_id);
DROP POLICY IF EXISTS "DM sender authorized mutual or public messages" ON public.direct_messages;
CREATE POLICY "DM sender authorized mutual or public messages" ON public.direct_messages
 FOR INSERT TO authenticated WITH CHECK (
  (SELECT auth.uid())=sender_id
  AND public.reconfeed_can_send_direct_message(sender_id,recipient_id,reply_to_id)
 );
