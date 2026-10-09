# Veytrava integration and launch setup

This guide identifies the configuration that must be completed in the real service accounts. Do not paste secret keys into GitHub issues, source files, or chat.

## 1. Supabase

1. Open the Supabase project intended for Veytrava.
2. In SQL Editor, review and run `supabase/schema.sql`. This creates the social tables and the marketplace listing/order data model. Back up existing data before applying schema changes to a project that already has production data.
3. In Project Settings / API, copy the project URL and the publishable/anon public key.
4. Set these values for the Expo mobile build using `mobile/.env.example` as a template:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_API_BASE_URL`
5. Restart Expo after changing environment values. The `EXPO_PUBLIC_` prefix means values are bundled into the client; only the public anon/publishable key belongs there. Never place a service-role key in the app.
6. Test adult signup with a DOB under 18 and an eligible DOB, then test sign-in, profile creation, media upload, post creation, likes, follows, comments, and RLS permissions using test accounts.

The SQL trigger now requires `date_of_birth` and `gender` signup metadata. The mobile signup form sends both. If Supabase email confirmation is enabled, confirm the message before signing in. A date-of-birth gate is not identity verification and cannot prevent all false DOB claims.

## 2. Vercel API configuration

In the Vercel project settings, configure server-only variables as needed:
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` for the health/configuration indicator.
- `REPLICATE_API_TOKEN`
- `REPLICATE_IMAGE_MODEL` for image generation.
- `REPLICATE_VIDEO_MODEL` for video workflows.

Replicate model names and accepted inputs differ. Configure models whose schemas support the API's current prompt/aspect-ratio/duration inputs, then run private generation tests. Do not advertise AI generation as available until image and video requests both complete successfully. Do not expose provider tokens as `EXPO_PUBLIC_` variables.

## 3. Marketplace

The database foundation now includes seller-owned listings and order records with a 10% platform-fee field. It is **not a checkout integration**. Before enabling transactions, implement and test:
- Server-side authentication and listing/price validation.
- Stripe Connect or another supported marketplace payout setup for sellers.
- Checkout creation with the 10% fee calculated on the server.
- Verified, idempotent payment webhooks that alone update order payment status.
- Refunds, disputes, seller onboarding/payouts, shipping/pickup, tax handling, moderation, and prohibited-item rules.

Do not collect live payments until the platform account, seller payout flow, webhook verification, and test-mode end-to-end cases pass. Never trust client-supplied price or fee values.

## 4. Morning news

The optional card component is present, but there is no live news ingestion or scheduler. A launch needs a scheduled server-side job, licensed/reliable source ingestion, story deduplication, citations and timestamps, AI narration/generation credentials, persistent storage, corrections handling, and a way to mute or hide news. Do not fabricate footage or present generated visuals as real reporting.

## 5. Build and release

The GitHub Actions workflow installs mobile dependencies and runs TypeScript validation plus API syntax checks. Check the Actions tab for its result. Then install dependencies locally in `mobile/`, run `npm run typecheck`, run `npx expo-doctor`, and test on physical iOS and Android devices. Create signed store builds only after those tests pass. The website is a landing page, not an app installer.

## Status

Code in GitHub is not proof that a backend migration, provider integration, payment flow, or mobile build has been executed. Keep those launch gates open until test evidence exists.
