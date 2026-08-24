# HOPE Marketplace

Current backend release: **3.5.0**.

This round adds durable payment-release outbox processing and removes several PostgreSQL read paths from the legacy in-memory snapshot. See `ARCHITECTURE-ROUND-3.2.md`.

# HOPE — Android Build Package

## Build Contract
- Flutter 3.47.x stable
- Android compileSdk 36
- targetSdk 36
- minSdk 30
- JDK 17
- AGP 8.11.1
- Gradle 8.14.3
- Kotlin 2.2.20
- applicationId: com.hope.marketplace
- label: HOPE

## API configuration
The mobile API base URL is supplied only at build time (debug builds may also override it in code for local emulator tests):

```bash
flutter build apk --release --dart-define=API_BASE_URL=https://YOUR_API_HOST/api/v1
```

The source uses `String.fromEnvironment('API_BASE_URL')`; no production URL is hard-coded.

## Feature inventory — Backend
Auth/RBAC, Users, Providers, Organizations, Categories, Skills, Jobs, Offers, Agreements, Payments, Payouts, Execution, Evidence, Reviews, Reputation/Work Score, Disputes, Messaging, Notifications, Risk, KYC, Matching, Pricing, Admin, Analytics, Audit.

## Feature inventory — Mobile
Login, Register, Password Reset, Session restore, Job listing, Job detail, Create Job, Offers, Transactions/Agreement/Funding/Start/Evidence/Deliver/Accept/Settlement/Review states, Evidence picker/upload, Profile, Transactions list, Secure token storage, API client via API_BASE_URL, notification abstraction, upload retry queue.

## Feature inventory — Web
Buyer authentication, Provider authentication, Buyer dashboard, Provider dashboard, Job creation/publishing, Job listing/detail, Offers, Admin access shell.

## Build steps
1. Use Flutter 3.47.1 stable and JDK 17.
2. Run `flutter clean`.
3. Run `flutter pub get`.
4. Run `flutter analyze`.
5. Run `flutter test`.
6. For a production release, configure a real release keystore and build through `tools/build_apk_release.sh` with `BUILD_PROFILE=production`.
7. Confirm the generated APK passes `apksigner verify` and record the SHA-256 in the release report.

## Signing
Production release signing is required and is intentionally fail-closed. The repository does not contain a production keystore. Configure the GitHub Actions secrets described in `RELEASE-APK-CONTRACT.md` before creating a production APK. Pilot/local builds may use a separate non-production keystore, but must never be treated as a store-ready artifact.


## FEATURE INVENTORY
- Auth: login, registration, password reset UI, secure session restore/logout
- Marketplace: job listing, job detail, create job
- Offers: offer creation, offer list, accept offer
- Transactions: agreement, funding, start, evidence, delivery, acceptance, settlement, review state model
- Profile: provider/buyer profile surface
- Networking: API client using --dart-define=API_BASE_URL
- HOPE branding: minimal RTL-first mobile UI
- Android: Flutter embedding v2, API 36, target 36, min 30

## Final UI update
- Material 3 visual system with light and dark themes.
- Runtime dark-mode switch under Profile.
- Consistent cards, controls, navigation bar, FAB, typography, spacing, and status colors.
- RTL-first presentation maintained.
- Test imports aligned with package name `hope_mobile`.

## Validation note
The source package has been reviewed and patched in this environment as of 2026-08-23 (see BUILD-SOURCE-FILELIST.txt). Flutter SDK is not installed in the execution container, so `flutter analyze`, `flutter test`, and APK compilation could not be executed here. Run those three commands in a Flutter 3.47.x environment before release.

## Patch log (2026-08-23, round 1)
- Added `analysis_options.yaml` (flutter_lints now actually active) and `.gitignore`.
- Rewrote `test/api_client_test.dart`: no longer asserts a hard-coded default base URL; documents the `--dart-define` contract and covers URL injection (emulator pattern).
- Added debug-only `android/app/src/debug/res/xml/network_security_config.xml`: cleartext HTTP allowed only for `10.0.2.2`/`localhost` in debug builds; release builds keep cleartext fully blocked.
- Added request timeouts to `ApiClient`: 20s for GET/POST/PUT/PATCH/DELETE JSON requests, 60s for multipart file uploads (larger, since evidence files can be sizeable — an earlier draft of this note incorrectly said 5s).
- Fixed Flutter version inconsistency in `android/ANDROID-CONFIG.md` (3.36.0 → 3.47.0).

## Patch log (2026-08-23, round 2 — code review pass)
- `login_page.dart`: removed a stray `Navigator.pop(context)` after a successful login. `LoginPage` is shown as the app's root screen (`AppRouter`'s `home`), never pushed, so there was nothing to pop — this threw a "Navigator.pop() called without a route to pop" assertion right after every successful login. `AppRouter` already reacts to `AuthController` and swaps to `HomePage` on its own.
- `api_client.dart`: added `onUnauthorized` callback, invoked on any authenticated request that comes back HTTP 401. A refresh token was stored but no refresh flow existed, so an expired access token previously left the user stuck with every authenticated screen silently failing. `main.dart` now wires this to `AuthController.logout()`, sending the user back to the login screen. Also added `PUT`/`PATCH`/`DELETE` support (previously only `GET`/`POST` were implemented).
- `transactions_page.dart`: replaced an unguarded `(snap.data as List?)?.cast<Map>()` with a defensive shape check — a non-list, non-null response from `/jobs/mine` would have thrown a `TypeError` during build instead of rendering the existing error state. Also stopped an uncaught pull-to-refresh error from surfacing as an unhandled exception.
- `transaction_page.dart`: evidence-file uploads now go through `UploadQueue.uploadNowWithRetry` (3 attempts with backoff) instead of a single direct `ApiClient.uploadFile` call — the queue class existed and was instantiated but was never actually called, so uploads had no retry despite the README claiming one. Also guarded `tx['job']` against a non-Map value before casting.
- `evidence_picker.dart`: replaced `result?.files.single` (throws if the picker ever returns 0 or >1 files) with a safe first-element lookup.
- `login_page.dart` / `register_page.dart`: added minimal empty-field/short-password validation before hitting the API, instead of sending blank or too-short values to the backend.
- Android launcher icon: `mipmap-anydpi-v26/ic_launcher.xml` was a raw `<vector>`, not a proper `<adaptive-icon>`, so most launchers rendered it unmasked instead of adapting it to the device's icon shape. Replaced with a real adaptive icon (separate background/foreground layers) and removed an unused, visually inconsistent second icon that lived at `drawable/ic_launcher.xml` and was never referenced by the manifest.

## Patch log (2026-08-23, round 3 — stability pass)
- `home_page.dart`: changed bottom-tab construction to lazy/cached tabs. The app now constructs only the active tab on first use while preserving each visited tab instance, instead of eagerly creating all four tabs on login.
- `home_page.dart`: removed the embedded second `JobsPage` from the home feed. The home screen now links to the dedicated Jobs tab, eliminating the duplicate `/jobs` request caused by the previous nested page.
- `create_job_validator.dart`: added client-side validation for required fields, description length, numeric budgets, budget ordering, positive duration, and acceptance criteria.
- `create_job_page.dart`: uses validated numeric values, checks that job creation returns an id before publishing, and surfaces validation errors without making an API request.
- `test/create_job_validator_test.dart`: added unit coverage for valid input, reversed budgets, and invalid duration.

## Known remaining gaps (not fixed in this pass — flagging for the next round)
- No token-refresh flow: `refreshToken` is stored but unused; on 401 the app now logs the user out rather than silently retrying with a refreshed token. Implementing a real refresh flow needs the backend's refresh-token contract.
- `IndexedStack` in `HomePage` builds all four tabs immediately on login, and the home tab additionally embeds a second, separate `JobsPage` instance — so `GET /jobs` currently fires twice, plus `/jobs/mine` and `/providers/me`, all before the user has switched tabs. Works correctly, just wasteful.
- No client-side validation on `CreateJobPage` (empty title, non-numeric budgets, etc. are sent to the backend as-is).



## Patch log (2026-08-23, round 4 — backend logic fix, verified against a live run)
- **Critical:** `backend/src/app.js`'s `enforceJobState()` was calling `assertTransition(job.status, expected)` (a "can `status` become one of `expected`?" check) where it actually needed a "is `job.status` currently one of `expected`?" membership check. Because almost none of the job statuses are self-transitions in `workflow.js`'s state graph, this rejected nearly every legitimate lifecycle action with `409 INVALID_STATE` — publishing a freshly created job, submitting/accepting offers on a published job, starting a funded job, submitting evidence or delivering an in-progress job, and releasing payment on a completed job all failed. Confirmed live: after installing stub `pg`/`@aws-sdk` packages (no `DATABASE_URL`/S3 configured, so the real ones aren't needed to boot) and running the actual `node:http` server, `backend/tests/e2e-flow.test.mjs`'s full marketplace flow failed at the very first step (`POST /jobs/:id/publish` returned 409 instead of 200). Fixed `enforceJobState` to do the membership check directly; re-ran the full backend suite (`node --test tests/*.mjs`) and the entire flow now passes end-to-end. Added a follow-up negative-path check (publish-before-... , double-publish, premature start/deliver) confirming invalid/out-of-order actions are still correctly rejected.
- `backend/src/app.js` `POST /payments/fund/:jobId`: the already-funded / idempotency-key check ran *after* `enforceJobState`, so a legitimate retry of a successful fund request (same `Idempotency-Key`, sent after the job had already moved to `FUNDED`) was rejected with 409 instead of returning the original payment — this surfaced only once the `enforceJobState` fix above let the first fund request through. Reordered so the idempotency/already-funded check runs first.
- `backend/tests/route-contract.mjs` had three stale source-text "safety marker" checks that never matched the actual code (`parts[1] === 'accept'` vs. the real `parts[2] === 'accept'`; `parts[1] === 'me'` vs. the real negated guard `parts[1] !== 'me'`; and a leftover `'assertTransition'` marker after the fix above removed that import). Updated all three to match the real source.
- `.gitignore` had no `node_modules` entry despite `backend/` being a real Node project with its own `package.json`. Added.
- Full backend suite (`node --test tests/*.mjs`) now passes: 9/9, including the live end-to-end marketplace flow. `node --check` is clean on every backend source and test file. Flutter/Dart could still not be executed in this environment (no SDK, no network) — run `flutter analyze && flutter test` yourself before shipping, per the validation note above.

## CI workflow (2026-08-23)
- Added `.github/workflows/build-apk.yml`: builds the release APK on GitHub Actions (Flutter 3.47.x + JDK 17 + AGP 8.11.1 + Gradle 8.14.3 + Kotlin 2.2.20). Trigger: manual or tag push `v*`.
- Before building, set repository secret `API_BASE_URL` to your production API URL.
- Local build commands (Flutter 3.47.x+, JDK 17):
```bash
flutter clean && flutter pub get
flutter analyze && flutter test
flutter build apk --release --dart-define=API_BASE_URL=https://YOUR_API_HOST/api/v1
```


## Backend

The repository now includes a self-contained API under `backend/`. It implements the mobile contract end-to-end: authentication with rotating refresh tokens, users/providers, categories, jobs, offers + acceptance, funding, execution state transitions, evidence, file uploads, payment release/settlement, password-reset requests/confirmation, and audit logging.

Run locally:

```bash
cd backend
cp .env.example .env
node src/migrate.js
node src/server.js
```

Android emulator:

```bash
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1
```

For production, change both token secrets and deploy behind HTTPS. The bundled datastore is single-instance/zero-dependency for development and pilot use; a PostgreSQL adapter should be used before horizontal scaling.

## Stability / CI guardrails

This revision keeps the existing Flutter API contract and introduces an isolated job-state transition guard in `backend/src/workflow.js`. Existing route behavior is preserved; the guard only rejects lifecycle regressions that were previously possible through future endpoint changes.

Every branch and pull request runs backend syntax/tests plus Flutter analyze/test/release build in `.github/workflows/ci.yml`. The production APK workflow also falls back to a non-routable placeholder API URL when the repository secret is not configured, so a missing secret does not masquerade as a source/build failure.

## Authentication behavior
- The app now opens directly in guest mode; an account is optional for browsing published work.
- Account-required actions (creating jobs, sending offers, viewing private transactions, profile data) prompt for login instead of blocking entry to the app.
- Successful registration and login persist the session before the authenticated state is published.
- Backend registration returns a consistent `EMAIL_IN_USE` response for duplicate emails, including PostgreSQL uniqueness races.


## Production hardening update (2026-08)
The backend was hardened to require durable S3 storage in production, fail closed when password-reset delivery is not configured, retain local uploaded files correctly, and verify direct S3 uploads before persisting upload metadata.

## V3 kickoff (2026-08-24)
- Direct S3 upload completion now requires a server-created, user-bound, expiring upload intent and consumes it after completion.
- Repository contract test now asserts semantic row locking instead of brittle SQL projection text.
- Release helper now distinguishes `production` from `pilot`, verifies the APK package id, verifies production signatures when `apksigner` is available, discovers nonstandard artifact paths safely, and emits SHA-256.
- `android/gradlew` is executable in the distributed package.
- See `V3-START.md` and `GENSPARK-V3-BUILD-PROMPT.md` for the current V3 scope and low-token build procedure.
