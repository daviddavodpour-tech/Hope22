# HOPE — Android Build Contract

- Flutter: Stable 3.47.x
- JDK: 17
- compileSdk: 36
- targetSdk: 36
- minSdk: 30
- AGP: 8.11.1
- Gradle: 8.14.3
- Kotlin: 2.2.20
- applicationId: `com.hope.marketplace`

## API

Production API is injected at build time only:

```bash
flutter build apk --release --dart-define=API_BASE_URL=https://YOUR_API_HOST/api/v1
```

## Signing

Release signing is externalized. The repository must never contain the production keystore or passwords.

Required environment variables:

- `ANDROID_RELEASE_STORE_FILE`
- `ANDROID_RELEASE_STORE_PASSWORD`
- `ANDROID_RELEASE_KEY_ALIAS`
- `ANDROID_RELEASE_KEY_PASSWORD`

A release build without these values must not be treated as a publishable signed artifact.
