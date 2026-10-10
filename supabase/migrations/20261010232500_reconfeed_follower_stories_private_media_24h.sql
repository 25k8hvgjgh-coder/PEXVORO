-- Private, followers-only stories. Active for 24 hours.
CREATE TABLE IF NOT EXISTS public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_path text NOT NULL UNIQUE,
  media_type text NOT NULL CHECK (media_type IN ('image','video')),
  caption text NOT NULL DEFAULT '' CHECK (char_length(caption) <= 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now()+interval '24 hours'),
  CONSTRAINT story_valid_expiry CHECK (expires_at > created_at AND expires_at <= created_at+interval '24 hours 5 minutes')
);
CREATE INDEX IF NOT EXISTS stories_owner_recent_idx ON public.stories(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS stories_expiry_idx ON public.stories(expires_at);
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('story-media','story-media',false,25165824,ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm']::text[])
ON CONFLICT (id) DO UPDATE SET public=false,file_size_limit=EXCLUDED.file_size_limit,allowed_mime_types=EXCLUDED.allowed_mime_types;
CREATE OR REPLACE FUNCTION public.reconfeed_can_view_story(p_owner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $function$
 SELECT (SELECT auth.uid()) IS NOT NULL
 AND (p_owner = (SELECT auth.uid()) OR (
   EXISTS(SELECT 1 FROM public.follows f WHERE f.follower_id=(SELECT auth.uid()) AND f.following_id=p_owner)
   AND NOT EXISTS(SELECT 1 FROM public.blocked_accounts b
     WHERE (b.blocker_id=(SELECT auth.uid()) AND b.blocked_id=p_owner)
        OR (b.blocker_id=p_owner AND b.blocked_id=(SELECT auth.uid())))
 ));
$function$;
REVOKE ALL ON FUNCTION public.reconfeed_can_view_story(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reconfeed_can_view_story(uuid) TO authenticated;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.stories FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON TABLE public.stories TO authenticated;
DROP POLICY IF EXISTS "Followers view unexpired stories" ON public.stories;
CREATE POLICY "Followers view unexpired stories" ON public.stories
 FOR SELECT TO authenticated USING (expires_at>now() AND public.reconfeed_can_view_story(user_id));
DROP POLICY IF EXISTS "Story owner creates" ON public.stories;
CREATE POLICY "Story owner creates" ON public.stories
 FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid())=user_id AND expires_at<=created_at+interval '24 hours 5 minutes');
DROP POLICY IF EXISTS "Story owner deletes" ON public.stories;
CREATE POLICY "Story owner deletes" ON public.stories
 FOR DELETE TO authenticated USING ((SELECT auth.uid())=user_id);
DROP POLICY IF EXISTS "Story owner uploads private media" ON storage.objects;
CREATE POLICY "Story owner uploads private media" ON storage.objects
 FOR INSERT TO authenticated WITH CHECK (bucket_id='story-media' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
DROP POLICY IF EXISTS "Story audience reads private media" ON storage.objects;
CREATE POLICY "Story audience reads private media" ON storage.objects
 FOR SELECT TO authenticated USING (
  bucket_id='story-media' AND (
   (storage.foldername(name))[1]=(SELECT auth.uid())::text
   OR EXISTS(SELECT 1 FROM public.stories story WHERE story.media_path=name AND story.expires_at>now() AND public.reconfeed_can_view_story(story.user_id))
 ));
DROP POLICY IF EXISTS "Story owner removes private media" ON storage.objects;
CREATE POLICY "Story owner removes private media" ON storage.objects
 FOR DELETE TO authenticated USING (bucket_id='story-media' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);
