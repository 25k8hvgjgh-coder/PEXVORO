-- Keep private conversation unread state consistent on web, iPhone, and Android.
-- No old messages are deleted, and the recipient is the only account allowed
-- to acknowledge receipt. A recipient can update only the read_at column.
ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS read_at timestamptz;
CREATE INDEX IF NOT EXISTS direct_messages_unread_recipient_idx
 ON public.direct_messages(recipient_id,created_at DESC) WHERE read_at IS NULL;
GRANT UPDATE(read_at) ON public.direct_messages TO authenticated;
DROP POLICY IF EXISTS "DM recipient marks messages read" ON public.direct_messages;
CREATE POLICY "DM recipient marks messages read" ON public.direct_messages
FOR UPDATE TO authenticated
USING ((SELECT auth.uid())=recipient_id)
WITH CHECK ((SELECT auth.uid())=recipient_id);
