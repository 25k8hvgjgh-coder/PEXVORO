# ReconFeed Feature-Parity Build Plan

## Goal
Build a polished short-form social video and creator app for iOS and Android, inspired by familiar short-video workflows while keeping ReconFeed's own identity. “Feature parity” means each feature has a real user interface, secure backend behavior, loading/empty/error states, accessibility, tests, and operational controls—not just a button or mock screen.

## Current verified baseline
- Expo / React Native app source: `mobile/App.tsx`.
- Supabase client is optional and reads `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- Current app foundation includes authentication, feed/profile basics, media-library selection, post publishing, likes/follows, search, and an AI Studio request adapter.
- Root site is a download landing page, not a published mobile binary.
- This repository does not establish that App Store / Google Play releases, live streaming, a full editing timeline, direct messages, marketplace payments, or production AI generation are complete.
- Supabase schema must be installed in the target project and secrets/provider configuration must be set before cloud features can be verified end to end.

## Build order and acceptance criteria

### P0 — Safe, reliable app foundation
- [ ] Configure Supabase project, schema, storage buckets, row-level security (RLS), indexes, and auth redirect URLs.
- [ ] Add mandatory date of birth and 18+ self-attestation at signup; enforce eligibility in trusted server/database logic, not only the client.
- [ ] Add username validation, account recovery, session persistence, account deletion, privacy controls, and clear auth errors.
- [ ] Replace demo/fallback posts with explicit empty/loading/error states when the backend is configured; clearly label local demo mode otherwise.
- [ ] Add automated typecheck/lint and tests for auth, permissions, upload, feed, likes, follows, and security policies.

### P1 — Short-video feed
- [ ] Full-screen vertical paging, autoplay only for the active item, pause on navigation/background, mute/unmute, replay, and smooth preloading.
- [ ] For You and Following feeds with server-side pagination and ranking; refresh, deduplication, and resilient network states.
- [ ] Likes, comments/replies, sharing, saves/favorites, creator follows, reporting, blocking, and content visibility settings.
- [ ] Creator attribution, sound/audio metadata, captions, accessibility labels, and accurate engagement counts.
- [ ] Ranking controls: conservative-first discovery defaults plus user-controlled interests, mutes, and transparent feed preferences. Do not remove political content solely because of viewpoint.

### P2 — Capture and editing
- [ ] In-app camera with permissions, front/back camera, record/stop, flash where supported, and gallery import.
- [ ] Trim/split clips, reorder, crop/rotate, speed controls, volume/mute, voiceover, text overlays, captions, transitions, filters, and draft saving.
- [ ] Preview and export with documented supported resolutions/aspect ratios; handle interrupted exports and low storage.
- [ ] Validate file type, duration, size, upload progress, retries, cancellation, and resumable uploads.

### P3 — AI Creator Studio
- [ ] Connect real provider credentials on server only; never ship secret provider keys in the app.
- [ ] Validate prompts and media inputs, show cost/credit disclosure where applicable, queue jobs, poll status, retry failures, and save results.
- [ ] Support generation history, download/export, report/appeal workflows, and rate limits.
- [ ] Keep provider-specific model IDs and input schemas configurable; test each model before enabling it for users.

### P4 — Social and community
- [ ] Comment threads/replies, notifications, creator profiles, follower lists, favorites, sharing/deep links, and block/mute/report.
- [ ] Direct messages only after spam prevention, abuse reporting, privacy, retention, and blocking controls are in place.
- [ ] LIVE only after stream provider integration, chat moderation, reporting, age controls, recording/retention decisions, and abuse-response operations are tested.

### P5 — Marketplace
- [ ] Product/listing management, search, seller profiles, listing moderation, order status, refunds/disputes, and customer support.
- [ ] Integrate a compliant payment provider and implement server-side price validation, webhooks, idempotency, and fraud controls.
- [ ] Do not enable regulated-goods transactions; firearm-related educational or sporting content is not the same as allowing sales.

### P6 — Launch and quality
- [ ] Add crash reporting, privacy disclosures, data deletion/export process, moderation operations, rate limits, and incident response.
- [ ] Test on real iOS and Android devices, including slow networks, offline recovery, permission denial, background/foreground transitions, and accessibility.
- [ ] Produce signed internal builds, test them with users, fix blockers, then complete store metadata, policy declarations, and store review.
- [ ] Publish verified installation links only after real builds are available.

## Definition of done for each feature
1. A real user can complete the flow on a device.
2. Backend authorization and RLS prevent unauthorized access or mutation.
3. Loading, empty, success, offline, and failure states are handled.
4. Automated tests cover critical behavior and abuse cases.
5. No placeholder action is presented as a successful operation.
6. The feature is documented as shipped only after tests and a device-level check pass.

## Immediate next step
Audit and harden P0 (Supabase configuration, age gate, security rules, and clear demo-vs-live behavior) before building more surface area. Shipping lots of screens without a working backend would not deliver a better TikTok-like experience.
