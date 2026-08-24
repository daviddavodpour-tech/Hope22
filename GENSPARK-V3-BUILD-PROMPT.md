# HOPE V3 — Genspark Execution Prompt (Low-Token / Low-Error)

You are the release/build agent for HOPE V3. The repository contains a local execution report from 2026-08-24. **Read that report first and do not repeat tests already marked PASS unless the affected files changed.**

## Goal

Produce a reproducible, verified Release Candidate with the minimum commands and minimum context consumption. Fix real blockers; do not redesign working code.

## Priority order

1. Verify environment once.
2. Run only the required incremental checks.
3. If a dependency/tool is missing, classify the environment block once and use the strongest equivalent checks available.
4. Build and verify the actual artifact.
5. Only then run CI/reproducibility checks.

## First command batch — do not add more before reading the results

```bash
pwd
flutter --version 2>/dev/null || true
dart --version 2>/dev/null || true
java -version 2>&1 | head -3
node --version
command -v adb || true
command -v apksigner || true
command -v aapt || true
```

Then inspect only:
- `V3-EXECUTION-REPORT.md`
- `android/app/build.gradle.kts`
- `android/gradle/wrapper/gradle-wrapper.properties`
- `tools/build_apk_release.sh`
- `.github/workflows/ci.yml`
- `.github/workflows/build-apk.yml`

## Backend verification

If `backend/node_modules` is complete, run exactly:

```bash
npm run check --prefix backend
node --test backend/tests/*.mjs
```

Do **not** run `npm ci` or `npm install` when the required packages already exist.

If `pg`/AWS SDK is missing:
- do not repeatedly retry installation;
- classify it as ENVIRONMENT BLOCK;
- run dependency-free/static tests;
- do not create fake production dependencies in the repository.

For real PostgreSQL validation, prefer the existing CI PostgreSQL service or a local Docker PostgreSQL instance if available.

## Critical SQL checks

When a real PostgreSQL connection is available, specifically test:
- refresh rotation and reuse-family revocation;
- password-reset one-time use and session invalidation;
- job row locking on publish/start/deliver/accept;
- offer acceptance race behavior;
- payment funding idempotency;
- payment release locking;
- upload-intent ownership/expiry/content-type and one-time consumption.

Run the real E2E suite once. Do not reproduce the same failures through multiple equivalent commands.

## Android / Flutter strategy

### If Flutter exists
Run:

```bash
flutter pub get
flutter analyze
flutter test
flutter build apk --release --dart-define=API_BASE_URL="$API_BASE_URL"
```

Only use an HTTPS API URL for a production candidate.

### If Flutter is missing but JDK + Gradle wrapper work
Run only:

```bash
chmod +x android/gradlew
cd android
./gradlew assembleRelease --no-daemon --stacktrace
```

Then locate artifacts:

```bash
find app/build build ../build -type f -name '*.apk' -print 2>/dev/null | sort
```

Do not copy an old APK to the expected Flutter directory just to make Flutter report success.

## Artifact verification

For exactly one selected release APK:

```bash
sha256sum <APK>
apksigner verify --verbose <APK>
```

Also verify:
- applicationId = `com.hope.marketplace`
- minSdk = 30
- targetSdk = 36
- release variant
- expected ABI
- nonzero size

If `apksigner` is unavailable, classify signature verification as BLOCKED. Never claim it is verified.

## Emulator smoke

When an Android emulator is available:

```bash
adb install -r <APK>
adb shell monkey -p com.hope.marketplace 1
adb shell am force-stop com.hope.marketplace
adb shell monkey -p com.hope.marketplace 1
```

Record PASS/FAIL. Do not infer runtime success from build success.

## Token discipline

- Never dump whole files. Read targeted ranges.
- Never repeat a green test.
- Never reinstall dependencies without checking first.
- Never ask the user to choose between obvious technical alternatives.
- Never modify production code to satisfy a brittle/static test.
- Prefer one combined command over many small equivalent commands.
- When a failure is clearly environmental, stop retrying that path and move to the strongest alternative.

## Failure taxonomy

Every failure is exactly one of:

- `REAL BUG`
- `STALE/BRITTLE TEST`
- `ENVIRONMENT BLOCK`
- `TOOLING PATH ISSUE`

Do not turn an environment block into a fake PASS.

## Final response — use exactly this format

```text
BUILD: PASS|FAIL|BLOCKED
BACKEND TESTS: PASS|FAIL|PARTIAL
POSTGRES E2E: PASS|FAIL|BLOCKED
FLUTTER: PASS|FAIL|BLOCKED
APK: <path or NONE>
SHA256: <hash or NONE>
SIGNATURE: VERIFIED|TEST-SIGNED|UNVERIFIED|BLOCKED|NONE
PACKAGE: <applicationId or NONE>
ANDROID INSTALL/SMOKE: PASS|FAIL|BLOCKED
REMAINING: <max 5 items>
```

Never write `Production Ready` unless Flutter build, APK signature verification, installation/smoke, and real PostgreSQL E2E are all verified.
