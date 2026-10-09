# PEXVORO

PEXVORO is being built as a creator-first social video and photo platform: a vertical creator feed, upload-and-post workflow, creator profiles, and a future AI-assisted editing studio.

## Current status
- The app-style front end is deployed through Vercel and source-controlled in this repository.
- The current feed still includes demo content until Supabase is configured and real posts exist.
- The creator studio previews selected media locally and includes a cloud publishing workflow that requires the setup below.
- Account UI, public community feed, server-backed like/unlike state, follow/unfollow, saved-post state and removal, comments, Following feed, profile editing, profile stats, and caption search are wired to Supabase in the front end; these have not yet been end-to-end tested against your live project.
- The creator profile includes a saved-post library for reviewing and removing saved posts.
- Paid memberships, credits, and checkout are intentionally paused.
- AI generation/editing is not yet connected end-to-end to a selected provider model.

## Enable accounts and cloud posts

1. In Supabase, open **SQL Editor**, create a new query, paste the contents of `supabase/schema.sql`, and run it.
2. In Vercel → Project → **Settings → Environment Variables**, add:
   - `SUPABASE_URL`: your project's base URL, such as `https://YOUR_PROJECT.supabase.co` (not the `/rest/v1/` endpoint).
   - `SUPABASE_ANON_KEY`: the project's public anon/publishable key. Do not use a service-role key.
3. Apply the variables to the deployment environments you use, then redeploy.
4. Open `/api/config` on the deployed site. It should return `configured: true` and only the public URL/key.
5. Supabase Auth email-confirmation settings may require users to confirm their email before signing in.

The schema creates profiles, posts, likes, comments, follows, saves, row-level security policies, and a public `post-media` storage bucket with a 25 MB limit. The front end currently uses public post publishing; private cloud drafts and followers-only media access are not finished. Public-bucket media is publicly viewable by URL; only upload media you intend to be public. Run the schema in your own Supabase project before the tables exist.

## Endpoints
- `GET /api/health`: reports whether expected environment variables are present; it does not test a full integration.
- `GET /api/config`: returns only the Supabase project URL and public anon key for browser initialization.
- `api/generate.js` and `api/generation-status.js`: provider adapter scaffolding only; AI generation is not ready for users.

## Security
Never commit API tokens to GitHub or expose service-role keys in browser code. Keep public post media in the public bucket only. Before a wider launch, add moderation/reporting, abuse controls, rate limits, account deletion, stronger validation, and end-to-end tests.
