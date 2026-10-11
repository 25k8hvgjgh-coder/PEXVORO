-- Visible creator-declared advertising label: FTC-style material connections
-- do not overwrite historical content or force a false disclosure.
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_promotional boolean NOT NULL DEFAULT false;
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS is_promotional boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.posts.is_promotional IS 'Creator-declared material connection; display an on-video promotion badge.';
COMMENT ON COLUMN public.stories.is_promotional IS 'Creator-declared Story promotion; show a visible disclosure to viewers.';
