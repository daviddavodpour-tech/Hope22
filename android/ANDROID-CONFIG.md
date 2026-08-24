# HOPE Android 36 configuration
## Fixed build contract
- Flutter baseline: `3.47.0` stable
- Android `compileSdk = 36`
- Android `targetSdk = 36`
- Android `minSdk = 30`
- Java/JVM target `17`
- Android Gradle Plugin `8.11.1`
- Kotlin Gradle Plugin `2.2.20`
- Gradle wrapper: `8.14.3`;
  The project is pinned to the versions declared in `android/settings.gradle.kts`.
- API base URL is supplied only at build time via `--dart-define=API_BASE_URL=...`

## Important
The project intentionally does **not** define custom ABI filters. Flutter configures the release ABI set itself in recent versions.
`android/local.properties` is generated locally and is never committed (see `.gitignore`).
The production APK must use a real release keystore supplied outside the repository.

## Device support policy
The pilot intentionally targets modern Android smartphones only. `minSdk = 30` means Android 11/API 30 and newer; `targetSdk = 36` targets Android 16 behavior.

## Local development vs production network policy
- **Debug builds** allow cleartext HTTP only to `10.0.2.2` (Android emulator host) and `localhost`
  via `src/debug/res/xml/network_security_config.xml`. This overlay is not packaged into release builds.
- **Release builds** block all cleartext traffic (`src/main/res/xml/network_security_config.xml`).
  A production backend must be served over HTTPS.

Release signing: the build no longer falls back to a debug keystore. Supply `ANDROID_RELEASE_STORE_FILE`, `ANDROID_RELEASE_STORE_PASSWORD`, `ANDROID_RELEASE_KEY_ALIAS`, and `ANDROID_RELEASE_KEY_PASSWORD` for a signed release. Without them, Gradle may produce an unsigned release artifact rather than a misleading debug-signed artifact.
