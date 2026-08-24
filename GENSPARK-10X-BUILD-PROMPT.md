# HOPE 3.1 — Genspark Build / Verify Prompt (Token-Efficient)

## Mission

Build and verify the current HOPE source as a **3.1.0 Release Candidate**. Do not redesign the product, rewrite working code, or repeat tests whose result is already recorded and whose inputs have not changed.

## Environment constraints

Work within the tools and SDKs actually available. When a required tool is missing:

1. Do not install repeatedly.
2. Do not loop on the same failed command.
3. Run all tool-independent checks first.
4. Mark the blocked check exactly `BLOCKED — <reason>`.
5. Continue with the strongest valid fallback.

## Token discipline

Use this order and stop repeating successful stages:

1. Read `10X-UPGRADE-REPORT.md`.
2. Run `npm run check` and `npm run test:fast` only once initially.
3. Run full `npm test` only if dependencies are complete.
4. Run Flutter/Android checks only after Flutter exists.
5. If the failure is path/configuration-related, inspect the actual artifact path before rebuilding.
6. Never run `npm ci`, `flutter pub get`, or a clean Android build twice unless the first run changed the dependency/configuration state.
7. Never disable a test to obtain green.

## Required verification

### Backend
- `npm ci` when dependency installation is needed.
- `npm run check`
- `npm run test:fast`
- `npm test`
- real PostgreSQL service + E2E suite
- migration/schema initialization
- `/health` and `/ready`
- dependency audit

### Security
Verify, not merely inspect:
- JWT issuer/audience/iat/jti
- session-version revocation
- refresh rotation and reuse-family revocation
- password reset one-time use + session invalidation
- rate limits
- explicit production CORS
- request size/timeouts
- security headers
- upload ownership + intent expiry
- direct S3 magic-byte validation
- idempotency-key conflict behavior

### Android
Only after Flutter is available:

```bash
chmod +x android/gradlew
flutter clean
flutter pub get
flutter analyze
flutter test
flutter build apk --release --dart-define=API_BASE_URL="$API_BASE_URL"
```

Then find the actual artifact:

```bash
find . -type f -name '*.apk' -print
```

Do not assume `build/app/outputs/flutter-apk/app-release.apk` until it is confirmed.

Verify:
- file exists
- applicationId = `com.hope.marketplace`
- release variant
- versionName/versionCode
- ABI
- signature via `apksigner verify --verbose`
- SHA-256
- installation on emulator/device
- launch and basic smoke test

### Release signing
- `BUILD_PROFILE=pilot`: test signing is acceptable, but label it TEST-SIGNED.
- `BUILD_PROFILE=production`: all `ANDROID_RELEASE_*` variables must exist and `apksigner` verification must pass.
- Never silently treat an unsigned APK as production.

## Failure classification

Every failure must be classified as exactly one of:

- `CODE BUG`
- `TEST BUG / STALE TEST`
- `ENVIRONMENT BLOCKED`
- `CONFIGURATION BUG`
- `DEPENDENCY FAILURE`
- `RELEASE ARTIFACT FAILURE`

Fix `CODE BUG` and `CONFIGURATION BUG` in source. For stale tests, update the test to assert semantics, not an implementation string. For environment blockers, do not fabricate success.

## Final report

Return only:

```text
STATUS
BACKEND: PASS/FAIL/BLOCKED
FLUTTER: PASS/FAIL/BLOCKED
ANDROID: PASS/FAIL/BLOCKED
E2E_POSTGRES: PASS/FAIL/BLOCKED
SECURITY: PASS/FAIL/BLOCKED
APK_PATH: ...
APK_SHA256: ...
APPLICATION_ID: ...
SIGNING: ...
SMOKE_TEST: ...
BLOCKERS: ...
CHANGED_FILES: ...
```

The goal is a reproducible, verifiable release candidate — not merely a successful compile.


## Incremental 3.2 build instructions — do not redo completed work

The repository is now at backend version 3.2.0. Treat the current source and the accompanying architecture report as the baseline.

### Token-efficient execution rules
- Start with `git diff`/file timestamps or a manifest hash and inspect only files changed since the last baseline.
- Do NOT reinstall dependencies unless `node_modules` is absent/incomplete or lockfile changed. If a package is missing, run exactly one `npm ci --ignore-scripts`; do not repeat it after a timeout.
- Do NOT rerun static tests that already passed if their source inputs are unchanged. Run the new outbox/read-path tests plus the full fast suite once.
- Do NOT modify Android/Flutter files until the backend and environment checks are green.
- Never claim PASS for PostgreSQL/S3/Flutter/Android unless the real dependency/runtime was actually available and the test executed.
- Prefer root-cause fixes over copying artifacts, disabling tests, changing assertions to fit the implementation, or weakening security checks.

### Required 3.2 verification
1. Verify `backend/package.json` and `backend/package-lock.json` both report 3.2.0.
2. Run all fast tests including `tests/outbox-contract.test.mjs`.
3. Run full `npm test` once. If it is blocked by missing `pg` or registry/network, record the exact blocker and continue with static/contract tests; do not loop.
4. When PostgreSQL is available, run the real outbox flow twice concurrently and verify one durable settlement, one DONE outbox record, no duplicate payment release, and correct audit entry.
5. When Flutter/Android is available, only then run the Release build and APK verification.
6. Preserve the current HTTP 200 success path for immediate release completion and HTTP 202 fallback for queued completion.
