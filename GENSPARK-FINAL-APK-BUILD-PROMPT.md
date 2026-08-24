# HOPE 3.5.0 — Final Genspark APK Build & Release Prompt

## Role
You are the final Build/QA/Release engineer for the attached HOPE 3.5.0 repository.
Your job is to turn this repository into a **real Android APK**, verify it end-to-end, and return the exact artifact, checksum, signing status, and test evidence.

Do not merely explain how to build it. Execute the build in the available environment whenever the required toolchain/credentials are available.

---

## Primary goal
Produce:

`build/app/outputs/flutter-apk/app-release.apk`

for:

- applicationId: `com.hope.marketplace`
- versionName: `3.5.0`
- versionCode: `5`
- minSdk: `30`
- targetSdk: `36`
- compileSdk: `36`
- Java/JDK: `17`
- Flutter: **3.47.1 stable** (3.47.x stable is acceptable only if 3.47.1 is unavailable)

The production API URL must be injected at build time. Never hard-code secrets or a real production URL into source files.

---

## Non-negotiable rules

1. **Do not redesign or rewrite working product logic.** Only fix actual build/test/release blockers.
2. **Do not weaken security checks.** Never remove tests, skip signing verification, or disable release gates just to get green.
3. **Do not invent a successful build.** A step is PASS only if it actually ran and succeeded.
4. **Do not commit or upload production secrets, passwords, tokens, `.env` files, or keystores.**
5. If a tool is missing, classify the step as `BLOCKED` and continue with all independent checks.
6. If network installation fails, retry at most once; then use available cache/offline state and record the blocker.
7. Keep the repository working tree clean except for intentional build artifacts/reports.
8. Prefer root-cause fixes over changing tests to match buggy behavior.
9. Never use a debug keystore for a production release.
10. Do not call an unsigned or test-signed APK a production/publishable artifact.

---

# Phase 1 — Discover the environment

Run once from repository root:

```bash
pwd
flutter --version || true
java -version || true
java -version 2>&1 | grep -q '17' || true
node --version || true
npm --version || true
adb version || true
apksigner version || true
which aapt || true
which aapt2 || true
```

Also inspect:

```bash
sed -n '1,220p' pubspec.yaml
sed -n '1,220p' android/app/build.gradle.kts
sed -n '1,220p' android/ANDROID-CONFIG.md
sed -n '1,260p' tools/build_apk_release.sh
```

Do not reinstall tools that already exist.

---

# Phase 2 — Validate required release inputs

A production build requires:

```text
API_BASE_URL
ANDROID_RELEASE_STORE_FILE
ANDROID_RELEASE_STORE_PASSWORD
ANDROID_RELEASE_KEY_ALIAS
ANDROID_RELEASE_KEY_PASSWORD
```

`API_BASE_URL` MUST begin with:

`https://`

The keystore file must exist and be non-empty.

If release credentials are absent, you may still create a **PILOT / NON-PUBLISHABLE** APK only if the Gradle project supports it, but you MUST label it exactly:

`NON-PUBLISHABLE — RELEASE SIGNING CREDENTIALS MISSING`

Never claim publishability without a real release signature.

---

# Phase 3 — Flutter dependency and quality gate

From repo root:

```bash
chmod +x android/gradlew tools/build_apk_release.sh
flutter pub get --enforce-lockfile
flutter analyze
flutter test --coverage
```

If `flutter pub get` changes the lockfile unexpectedly, stop and inspect before building.

If analyzer/tests fail:

1. classify the failure;
2. fix only real code/config issues;
3. rerun the failed test set;
4. rerun the complete Flutter gate once.

Never delete or skip a failing test.

---

# Phase 4 — Android/Gradle validation

Verify these exact release values in the actual Gradle configuration:

```text
applicationId = com.hope.marketplace
versionName = 3.5.0
versionCode = 5
minSdk = 30
targetSdk = 36
compileSdk = 36
JVM target = 17
```

Then verify the Android wrapper is executable:

```bash
test -x android/gradlew
```

If not:

```bash
chmod +x android/gradlew
```

Do not manually copy APKs between Gradle and Flutter output directories.

---

# Phase 5 — Build the APK

For a production release:

```bash
export BUILD_PROFILE=production
export API_BASE_URL='https://YOUR_REAL_API_HOST/api/v1'
export ANDROID_RELEASE_STORE_FILE='/absolute/path/to/release.jks'
export ANDROID_RELEASE_STORE_PASSWORD='***'
export ANDROID_RELEASE_KEY_ALIAS='***'
export ANDROID_RELEASE_KEY_PASSWORD='***'
./tools/build_apk_release.sh
```

Prefer the project script because it already performs the Flutter build and artifact validation.

If you need to run the Flutter command directly, use:

```bash
flutter build apk --release --dart-define=API_BASE_URL="$API_BASE_URL"
```

Do NOT print secret values into logs.

---

# Phase 6 — Verify the actual APK artifact

Locate the artifact:

```bash
find build -type f -name '*.apk' -print
```

Expected universal artifact:

`build/app/outputs/flutter-apk/app-release.apk`

Verify file exists and is non-empty:

```bash
test -s build/app/outputs/flutter-apk/app-release.apk
```

Verify APK metadata with `aapt`/`apkanalyzer` when available:

```bash
aapt dump badging build/app/outputs/flutter-apk/app-release.apk
```

Confirm:

- package = `com.hope.marketplace`
- versionName = `3.5.0`
- versionCode = `5`
- target/min SDK match the project contract
- release variant is used

---

# Phase 7 — Verify signing

For production:

```bash
apksigner verify --verbose build/app/outputs/flutter-apk/app-release.apk
```

This MUST pass.

Also inspect signer information when available:

```bash
apksigner verify --print-certs build/app/outputs/flutter-apk/app-release.apk
```

The artifact is not publishable if `apksigner` fails or if the APK is debug-signed.

---

# Phase 8 — Verify on an Android emulator/device

If ADB/emulator is available:

```bash
adb devices
adb install -r build/app/outputs/flutter-apk/app-release.apk
adb shell am force-stop com.hope.marketplace
adb shell monkey -p com.hope.marketplace 1
sleep 3
adb shell pidof com.hope.marketplace
```

Then run the repository's integration test:

```bash
flutter test integration_test/app_smoke_test.dart
```

The app must launch successfully and remain running.

Do not skip emulator testing just because the APK installs successfully.

---

# Phase 9 — APK integrity evidence

Calculate SHA-256:

```bash
sha256sum build/app/outputs/flutter-apk/app-release.apk
```

Record:

- exact APK path
- APK size
- SHA-256
- signer status
- package ID
- versionName/versionCode
- API base URL host (never secret values)
- Flutter/JDK versions
- analyzer result
- Flutter test result
- emulator smoke result

---

# Phase 10 — Optional backend/runtime verification

The APK can be built without starting the backend, but if PostgreSQL/S3/backend services are available, run the repository's existing integration/contract checks as well.

Do not modify backend behavior just to make an APK build pass.

---

# Phase 11 — Final acceptance criteria

The release is **PRODUCTION READY** only when all are true:

- Flutter 3.47.1 stable (or explicitly documented 3.47.x patch)
- JDK 17
- `flutter analyze` PASS
- `flutter test --coverage` PASS
- APK build PASS
- APK exists and is non-empty
- package = `com.hope.marketplace`
- version = `3.5.0+1`
- production signing verified with `apksigner`
- production `API_BASE_URL` is HTTPS
- emulator/device install PASS
- app launch PASS
- integration smoke PASS
- SHA-256 recorded
- no production secrets committed into the repository

If any one of these fails, final status MUST be `NOT READY` or `BLOCKED`, not `READY`.

---

# Final response format

Return a concise evidence report in exactly this shape:

```text
HOPE 3.5.0 APK RELEASE REPORT

STATUS: READY / NOT READY / BLOCKED

Flutter: <version>
JDK: <version>
Android SDK: <version>

Analyzer: PASS/FAIL/BLOCKED
Flutter tests: PASS/FAIL/BLOCKED
APK build: PASS/FAIL/BLOCKED
APK path: <exact path or NONE>
APK size: <bytes or NONE>
Package: <value>
Version: <value>
Signing: PRODUCTION VERIFIED / PILOT / UNSIGNED / BLOCKED
API transport: HTTPS / INVALID / BLOCKED
Emulator install: PASS/FAIL/BLOCKED
Emulator launch: PASS/FAIL/BLOCKED
Integration smoke: PASS/FAIL/BLOCKED
SHA-256: <hash or NONE>

FIXES APPLIED:
- <only actual fixes made>

BLOCKERS:
- <only real blockers; write NONE when none exist>

ARTIFACTS:
- APK: <path>
- Report: <path>
```

Do not claim anything that was not actually executed and verified.

## Important source-specific notes

- The Android package is `com.hope.marketplace`.
- `android/app/src/main/kotlin/com/hope/marketplace/MainActivity.kt` is already present; do not create a duplicate Activity.
- Release cleartext HTTP is intentionally disabled. Do not loosen this for production.
- Production signing is intentionally fail-closed.
- `tools/build_apk_release.sh` is the canonical local release entrypoint.
- `RELEASE-APK-CONTRACT.md` and `ANDROID-BUILD-CONTRACT.md` define the expected release contract.
- Existing backend and security hardening must be preserved.
