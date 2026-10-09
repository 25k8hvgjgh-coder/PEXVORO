## Integration setup

See [`docs/INTEGRATION_SETUP.md`](docs/INTEGRATION_SETUP.md) for the exact Supabase, Vercel, AI provider, marketplace payment, news pipeline, and mobile release steps, including security notes and tests required before launch.

## Release readiness

See [`docs/RELEASE_READINESS.md`](docs/RELEASE_READINESS.md) for the current launch checklist and the distinction between committed app components and integrations that still require credentials and testing.

## Morning news and marketplace requirements

See [`docs/MORNING_NEWS_AND_MARKETPLACE.md`](docs/MORNING_NEWS_AND_MARKETPLACE.md) for the optional morning news-video feed and seller listing/payment requirements, including the disclosed 10% platform fee. These require implementation and backend integrations before they are live.

# ReconFeed

**Veteran-owned and operated.**

ReconFeed is being built as a native iOS and Android creator-first social video/photo app with a short-form feed, creator profiles, media publishing, and an AI creation studio. The root website is intended to be a simple app-download landing page; the native app source lives in `mobile/`.

## Feature parity plan

The prioritized feature checklist and definition-of-done criteria are in [`docs/FEATURE_PARITY_BUILD_PLAN.md`](docs/FEATURE_PARITY_BUILD_PLAN.md). This is a build plan, not a claim that every feature is already implemented.

## Current status
- The native React Native / Expo app foundation is source-controlled in `mobile/`.
- The root `index.html` is the app-download landing page, and `app-link.json` is the future official install-link setting. It intentionally does not pretend an App Store or install link exists before a release is published.
- GitHub Actions checks the website/API JavaScript syntax and runs a TypeScript check on the mobile app.
- The current feed still includes demo content until Supabase is configured and real posts exist.
- The Creator Studio can select local media and publish to cloud storage after the Supabase setup below.
- The mobile app currently includes account sign-in/sign-up, a public community feed, media publishing, likes, follows, profile editing, caption search, and an AI Studio interface that calls the provider API adapter when configured. It has not yet been end-to-end tested against your live Supabase project.
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

The schema creates profiles, posts, likes, comments, follows, saves, row-level security policies, and a public `post-media` storage bucket with a 25 MB limit. The mobile app currently uses public post publishing; private cloud drafts and followers-only media access are not finished. Public-bucket media is publicly viewable by URL; only upload media you intend to be public. Run the schema in your own Supabase project before the tables exist.

## Native app

- Source: `mobile/App.tsx`
- Expo project configuration: `mobile/app.json`
- Set the three `EXPO_PUBLIC_*` values in `mobile/.env` using `mobile/.env.example` before running the app.
- Run locally from `mobile/` with `npm install` and `npx expo start`.
- To produce installable iOS/Android builds, connect an Expo account and run EAS Build. Expo's official guide: https://docs.expo.dev/build/setup/ . An app-store release also requires Apple/Google developer accounts and store review.

## Endpoints
- `GET /api/health`: reports whether expected environment variables are present; it does not test a full integration.
- `GET /api/config`: returns only the Supabase project URL and public anon key for browser initialization.
- `api/generate.js` and `api/generation-status.js`: provider adapter scaffolding only; AI generation is not ready for users.

## Security
Never commit API tokens to GitHub or expose service-role keys in browser code. Keep public post media in the public bucket only. Before a wider launch, add moderation/reporting, abuse controls, rate limits, account deletion, stronger validation, and end-to-end tests.

## Community and feed policy

ReconFeed's intended conservative-first feed, political-content moderation, firearms/explosives safety boundaries, and launch requirements are documented in [`docs/COMMUNITY_AND_FEED_POLICY.md`](docs/COMMUNITY_AND_FEED_POLICY.md). These are product requirements; they should not be described as live features until implemented and tested.

