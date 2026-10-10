-- ReconFeed query-path indexes and RLS policy optimization.
CREATE INDEX IF NOT EXISTS comments_user_id_idx ON public.comments (user_id);
CREATE INDEX IF NOT EXISTS follows_following_id_idx ON public.follows (following_id);
CREATE INDEX IF NOT EXISTS likes_user_id_idx ON public.likes (user_id);
CREATE INDEX IF NOT EXISTS marketplace_listing_reports_reporter_id_idx ON public.marketplace_listing_reports (reporter_id);
CREATE INDEX IF NOT EXISTS marketplace_listings_seller_id_idx ON public.marketplace_listings (seller_id);
CREATE INDEX IF NOT EXISTS marketplace_messages_recipient_id_idx ON public.marketplace_messages (recipient_id);
CREATE INDEX IF NOT EXISTS marketplace_messages_sender_id_idx ON public.marketplace_messages (sender_id);
CREATE INDEX IF NOT EXISTS marketplace_orders_listing_id_idx ON public.marketplace_orders (listing_id);
CREATE INDEX IF NOT EXISTS marketplace_saved_listings_listing_id_idx ON public.marketplace_saved_listings (listing_id);
CREATE INDEX IF NOT EXISTS saved_posts_post_id_idx ON public.saved_posts (post_id);

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));
