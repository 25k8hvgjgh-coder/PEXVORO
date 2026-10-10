# ReconFeed live audit — October 10, 2026

This report covers checks and source changes deployed on October 10, 2026. **This is not a certification of every screen or phone.** The production application still requires human device testing.

## Automated deployment and validation

- GitHub main release: `608fae5e528fdfd38b521277505ccd92366a9370`.
- JavaScript/TypeScript validation, responsive contract tests, browser export, profile-photo preparation tests, website smoke, and Supabase live smoke: passed.
- Vercel project `pexvoro`: production deployment READY on the corresponding commit.
- Expo EAS OTA preview and production channels: both published for Android and iOS.
- iOS native App Store/TestFlight delivery requires separately validated Apple signing, not just an OTA publish.

## Existing tester reports

At the time of the audit: **3 open, 6 in progress, 1 marked fixed**. Repeat Android screen-fit reports, creator-profile navigation, username/photo editing, community category taps, double-tap likes, and login persistence should be retested. Do not automatically mark these fixed from CI alone.

## Database checks

- Public post/media bucket is present, as is the private tester-screenshot bucket; role-specific storage policies are present.
- Four registered profiles existed; none had a saved avatar_url at audit time. Old storage logs show four rejected uploads with "No content provided". The existing binary upload fix has passed mocked tests, but no later successful avatar save has been confirmed.
- Existing message and follow permissions were checked. Read receipts were added and protected by recipient-only RLS and the UPDATE(read_at) column grant.
- **Critical least-privilege fix:** Authenticated users initially had broad table-level UPDATE, DELETE and TRUNCATE grants on direct_messages. Those have been revoked and checked again. Signed-in users can SELECT, INSERT and UPDATE(read_at), but not UPDATE(body), DELETE or TRUNCATE.
- Additional indexes speed lookups for blocked accounts, comment likes and tester reports. Existing RLS functions were wrapped in SELECT to avoid redundant per-row evaluations.

## Current enhancements

- Inbox unread counts refresh on foreground and at a bounded cadence; account switching clears the badge.
- Opening a conversation marks incoming messages read without altering message text.
- Tester reports no longer force an unnecessary token refresh for ordinary testers.
- Website PWA shell assets are online-first with offline fallback and a bumped cache version.
- Production smoke expectations for the native iOS beta disclaimer and current service worker were repaired.
- New automated static contract tests cover responsive layouts, unread badge paths, read receipts, profile-report authentication and cache freshness.

## Manual follow-ups

1. Have real users retest three Android screen-fit reports with screenshots and device/OS/gesture-navigation info, including a small phone and a tablet.
2. Have testers save a profile image on Android and Safari, then verify the database record and avatar image reload.
3. Test a real two-account conversation, unread badges and reply behavior; do not send messages on behalf of users.
4. Validate Apple signing and TestFlight with the Apple Developer account owner.
5. Enable leaked-password protection in Supabase Auth settings. This cannot be changed with the connected database-only tools. See https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.
6. Consider push notifications, camera/media upload retry UX and actual-device screenshot regression automation after these checks.
