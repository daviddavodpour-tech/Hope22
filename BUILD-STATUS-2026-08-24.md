# HOPE 3.5.0 — Build & APK Readiness Status

## Verified in this environment

- Backend syntax check: PASS
- Backend fast suite: PASS (29/29)
- Backend contract suite: PASS (20/20)
- Backup contract: PASS (3/3)
- Offline dependency audit available in the bundled cache: 0 vulnerabilities reported
- Android package ID source: `com.hope.marketplace`
- Android minSdk: 30
- Android targetSdk: 36
- Android compileSdk: 36
- Android JDK target: 17
- Flutter release version: `3.5.0+1`, Android versionName `3.5.0`, versionCode `5`
- Production signing: fail-closed; no keystore is bundled
- Production API URL: supplied only through `--dart-define` / CI secret and production requires HTTPS
- Release network security: cleartext disabled

## Not executable in this container

The execution container does not have Flutter SDK, Android SDK/ADB, or a production signing keystore. Network access is also unavailable, so the Flutter SDK and missing npm artifacts cannot be installed here.

Therefore this environment cannot truthfully claim:

- `flutter analyze` PASS
- `flutter test` PASS
- `flutter build apk --release` PASS
- emulator smoke PASS
- production APK signature PASS

## Production build path

Use `.github/workflows/build-apk.yml` with the following GitHub Secrets:

- `API_BASE_URL` — production HTTPS API base URL
- `ANDROID_RELEASE_KEYSTORE_BASE64` — base64 encoded production `.jks`
- `ANDROID_RELEASE_STORE_PASSWORD`
- `ANDROID_RELEASE_KEY_ALIAS`
- `ANDROID_RELEASE_KEY_PASSWORD`

The production workflow fails closed when any signing prerequisite is missing. It produces the APK artifact only after Flutter analyze/tests, release build and APK signature verification succeed.
