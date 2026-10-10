# ReconFeed release readiness

Updated October 10, 2026. This is an evidence checklist, not a 100% launch certification.

## Changes prepared in this update

- The same React Native app now exports a browser version at `/app/`, with real Supabase authentication, feed, publishing, and marketplace screens. The landing page links to it. Browser dialogs report account and upload errors.
- Creator names open the creator's profile/posts. The profile screen opens personal posts and saved posts.
- The marketplace displays all categories initially and provides a private inquiry inbox. Buyer inquiries use the existing deployed INSERT policy; sellers can read incoming inquiries. Seller replies require the separately prepared database-policy migration, which has NOT been applied.
- Feed tabs highlight correctly. Following/Discover retain chronological results. Stale feed requests cannot replace a newer feed. Videos pause while comments, collections, or inbox are open; native authentication refresh follows app visibility.
- Impossible birth dates are rejected. Login buttons disable during requests. Profile/password/composer state resets on account changes. Comment counts update after posting. AI polling reports HTTP errors rather than silently looping.
- Four API source files contained retrieval-error text rather than JavaScript. They are repaired: account status verifies a bearer token, checkout fails closed, and prior lead/estimate routes delegate to their retained implementations.
- Every API file now receives a syntax check in CI. Authentication/checkout contracts, mobile TypeScript checks, browser export, and existing no-charge AI contracts are automated.
- The corrupted ignore file and environment template are repaired. Dependency lockfile included.

## Verification

- Local TypeScript validation passed.
- All API syntax checks passed.
- Offline authentication/checkout and AI request-contract tests passed without provider calls or charges.
- Browser production export passed; asset references resolve under `/app/`.
- Existing public website/API/database checks passed before these updates.
- Android persistent-signature release `android-eas-beta` was verified with a 64,173,060-byte APK updated 2026-10-10T04:50:24Z.
- Browser interaction/device testing is still required; a successful export does not prove every interaction works on Safari or Android.

## Remaining launch gates

1. Apply and verify the seller-reply migration after explicit authorization. Automatic approval review rejected the production RLS change because the broad completion request did not explicitly authorize altering a production security boundary. The proposed rule permits a listing owner to send replies; it retains sender ownership, prohibits self-messages, and preserves participant-only reads. No live policy change occurred.
2. Complete Apple distribution signing and a processed TestFlight upload. The inspected iOS run failed with `Distribution Certificate is not validated for non-interactive builds`. A payment receipt is not signing readiness.
3. Connect and test the AI generation provider/server configuration. The live health endpoint reported AI unconfigured. Do not claim generation works until a signed-in request completes.
4. Implement and test marketplace checkout, verified/idempotent webhooks, seller onboarding and payouts before taking payments. Checkout deliberately returns 503 today.
5. News scheduling/ingestion, live streaming, avatar experiences, and licensed music remain separate unimplemented product work; documentation or surveys do not make these features operational.
6. Complete authenticated user-flow, two-account messaging, upload, account recovery/deletion, moderation/reporting/blocking, and physical-device release checks before a public launch.

The Vercel account connection returned 403 for the project scope. CLI fallback had no existing credentials. Repository-triggered deployment can still be checked through GitHub and public URLs; no dashboard configuration was changed.
