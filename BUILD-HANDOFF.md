# HOPE — Build Handoff

## Android toolchain

- Flutter: Stable 3.47.x
- JDK: 17
- compileSdk: 36
- targetSdk: 36
- minSdk: 30
- AGP: 8.11.1
- Gradle: 8.14.3
- Kotlin: 2.2.20
- applicationId: `com.hope.marketplace`

## Release build

Production API URL must be supplied at build time:

```bash
flutter build apk --release --dart-define=API_BASE_URL=https://YOUR_API_HOST/api/v1
```

For a signed release also export:

```text
ANDROID_RELEASE_STORE_FILE
ANDROID_RELEASE_STORE_PASSWORD
ANDROID_RELEASE_KEY_ALIAS
ANDROID_RELEASE_KEY_PASSWORD
```

The repository does not contain a production keystore.

## Recommended command

```bash
export API_BASE_URL=https://YOUR_API_HOST/api/v1
export ANDROID_RELEASE_STORE_FILE=/absolute/path/to/release.jks
export ANDROID_RELEASE_STORE_PASSWORD='...'
export ANDROID_RELEASE_KEY_ALIAS='...'
export ANDROID_RELEASE_KEY_PASSWORD='...'
./tools/build_apk_release.sh
```

## Validation

```bash
flutter clean
flutter pub get
flutter analyze
flutter test
```

Backend:

```bash
cd backend
npm ci
npm run check
npm test
```

See `BUILD-APK-PROMPT.md` for an AI/agent-ready build prompt and `RELEASE-CHECKLIST.md` for the release gate.
