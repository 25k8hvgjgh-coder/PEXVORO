-- Require Story metadata to point inside the authenticated author's own
-- Storage folder. Stops metadata spoofing of private story-media paths.
-- All prior Stories continue to work: only new inserts are constrained.
DROP POLICY IF EXISTS "Story owner creates" ON public.stories;
CREATE POLICY "Story owner creates" ON public.stories
 FOR INSERT TO authenticated
 WITH CHECK (
   (SELECT auth.uid())=user_id
   AND split_part(media_path,'/',1)=(SELECT auth.uid())::text
   AND expires_at>created_at
   AND expires_at<=created_at+interval '24 hours 5 minutes'
 );
