# HOPE Release Gate

The release gate requires all three lanes to pass:

1. **Backend**: static contracts, repository/security/workflow tests, PostgreSQL E2E, and real S3-compatible MinIO integration.
2. **Flutter**: `flutter analyze`, widget/unit tests with coverage, and release APK build.
3. **Android smoke**: install the release APK on an Android 36 emulator, launch it twice, and verify the HOPE package is active.

A separate `release-gate` job depends on all three lanes. No release artifact is considered green when any lane fails.

## Local verification

```bash
cd backend
npm ci
npm run test:fast
npm run test:contract
npm run test:e2e
npm run test:s3

cd ..
flutter pub get
flutter analyze
flutter test --coverage
flutter build apk --release --dart-define=API_BASE_URL=https://YOUR_API_HOST/api/v1
```

The CI workflow remains the authoritative environment for the real PostgreSQL, MinIO, and Android emulator checks.
