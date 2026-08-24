# HOPE — GitHub APK Build

This package is arranged so the Flutter project is at the repository root.

## GitHub Actions

The workflow is:

`/.github/workflows/build-apk.yml`

It uses Flutter 3.47.1 and Java 17, runs `flutter pub get`, builds a debug APK, verifies the artifact, and uploads the APK to the workflow run as an Artifact.

## Important

For the first GitHub upload, upload the **contents of this ZIP** so that `pubspec.yaml`, `android/`, `lib/`, and `.github/` are directly in the repository root.

The workflow currently builds a **debug APK**. A production/release APK should be configured separately with the project's Android signing secrets and the real HTTPS `API_BASE_URL`.
