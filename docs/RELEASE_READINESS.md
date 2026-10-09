# PEXVORO launch-ready product foundation

This checklist is for the remaining app-side work that can be prepared before backend/provider credentials and mobile-store release are configured. It does not certify a public launch.

## Product identity
- PEXVORO is presented as veteran-owned and operated on the public landing page and README.
- Conservative-first feed direction is documented; political viewpoint alone is not a removal reason.
- The morning news item is optional in-feed content, never a forced interstitial.

## App-side components
- `mobile/MorningBriefCard.tsx` provides an optional, source-attributed news card component for insertion among ordinary feed items. It is not connected to a scheduler or news provider yet.
- `mobile/App.tsx` has a conservative keyword ranking baseline and returns to For You when the app resumes.
- Seller flow requirements and a 10% PEXVORO platform fee disclosure are documented in `docs/MORNING_NEWS_AND_MARKETPLACE.md`. Payment collection is not implemented by the disclosure alone.

## Before calling a feature operational
- Run TypeScript checks and app build.
- Connect Supabase and run the schema.
- Add server-side 18+ enforcement, not only a client check.
- Test uploads, post creation, likes/follows, and row-level security against a real project.
- Integrate trusted news sources and a scheduled job; include source attribution, timestamps, correction workflow, and generated-media labels.
- Implement marketplace listings, moderation, payment provider, verified webhooks, refunds/disputes, seller payout flow, and server-side fee accounting.
- Test the app on physical iOS and Android devices and publish signed builds through the chosen distribution channel.

## Honesty about status
A committed component is not an end-to-end feature. Do not represent the news pipeline, AI listing generation, marketplace payments, live streaming, or store installation as available until integration tests and device tests pass.
