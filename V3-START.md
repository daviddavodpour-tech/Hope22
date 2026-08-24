# HOPE V3 — Start / Scope

## Baseline

V3 starts from `HOPE-production-v9-sql-repository` after the V2 hardening pass.

## Completed in V3 kickoff

- Fixed brittle PostgreSQL repository contract test to assert row locking semantically.
- Added per-user, expiring `upload_intents` for direct S3 uploads.
- `storage/presign` now creates an upload intent.
- `storage/complete` now rejects unknown, expired, cross-user, and content-type-mismatched intents.
- Completed upload consumes its intent.
- Added static regression coverage for upload-intent ownership/expiry checks.
- Made `android/gradlew` executable in the package.
- Hardened release build script to distinguish production vs pilot signing, discover artifacts safely, verify package ID, verify production signatures when `apksigner` is available, and report SHA-256.

## V3 priorities

1. Replace remaining in-memory PostgreSQL shadow-state dependency on critical reads/writes.
2. Expand authenticated E2E coverage for refresh-token rotation/reuse, password reset, rate limiting, upload authorization, and negative workflow paths.
3. Make OpenAPI match the actual HTTP contract.
4. Add Android/Flutter release smoke verification to CI rather than compile-only validation.
5. Separate payment state-machine simulation from a real payment provider integration boundary.
6. Add observability assertions and structured security regression tests.
