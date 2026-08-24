# HOPE 3.5.0 APK Release Contract

A production APK is considered releasable only when all of the following are true:

- Flutter 3.47.1 (stable) and JDK 17 are used.
- `API_BASE_URL` is supplied through CI secrets and starts with `https://`.
- A real Android release keystore is supplied through `ANDROID_RELEASE_KEYSTORE_BASE64`.
- Store/key passwords and alias are supplied through GitHub Secrets.
- `flutter analyze` and `flutter test` pass.
- `flutter build apk --release` succeeds.
- `apksigner verify` succeeds on the resulting APK.
- Package is `com.hope.marketplace`.
- Version is `3.5.0` / versionCode `5`.
- APK SHA-256 is recorded by the build report.

The production workflow intentionally fails closed when any signing secret is absent. It must never produce an artifact that is mistaken for a production-signed release.
