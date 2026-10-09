# ReconFeed tester build

## Android
The installable Android beta is built by GitHub Actions using Expo prebuild and Gradle, so it does not consume Expo's hosted EAS build quota.

Workflow: `.github/workflows/build-android-apk.yml`
- It runs when mobile files change on `main`, or can be started manually from GitHub Actions.
- On success, download `ReconFeed-beta.apk` from the run's **Artifacts** section (artifact name: `ReconFeed-Android-Beta-APK`) or from the prerelease attached to that run.
- The APK is a beta build for testing, not a Google Play release.

The separate `build-android-testers.yml` workflow uses hosted EAS Build and requires the `EXPO_TOKEN` repository secret for Expo account `Azzholejr06`.

## iPhone
iOS distribution is not included in the Android APK workflow. For device testing, configure Apple signing and use EAS internal distribution with registered device UDIDs, or configure App Store Connect/TestFlight. An Apple Developer membership is generally required for these distribution options.

## Backend readiness
A successful APK build only proves the binary built. Configure the public Supabase URL and anon/publishable key for the mobile build and test account signup, feed reads, uploads, posts, likes, follows, and comments before inviting testers to rely on live data. Never put a Supabase service-role key in the mobile app.
