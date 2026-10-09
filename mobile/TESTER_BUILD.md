# ReconFeed tester build

## Android
The GitHub Actions workflow `.github/workflows/build-android-testers.yml` starts an EAS preview APK build when mobile app files change on `main`, or when manually dispatched from GitHub Actions.

Repository secret required:
- `EXPO_TOKEN`: an Expo access token for the Expo account configured as `Azzholejr06`.

After a successful workflow run, open the linked EAS build page in the job logs to retrieve the APK install link.

## iPhone
iOS distribution is not included in the Android APK workflow. For device testing, configure Apple signing and use EAS internal distribution with registered device UDIDs, or configure App Store Connect/TestFlight. An Apple Developer membership is generally required for these distribution options.

## Backend readiness
A successful APK build only proves the binary built. Configure the public Supabase URL and anon/publishable key for the mobile build and test account signup, feed reads, uploads, posts, likes, follows, and comments before inviting testers to rely on live data. Never put a Supabase service-role key in the mobile app.
