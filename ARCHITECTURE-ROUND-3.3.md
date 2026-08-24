# HOPE Architecture Round 3.3 — Scale / Reliability Upgrade

Implemented in this package:

1. **Removed PostgreSQL single-writer advisory lock**
   - Startup no longer acquires `pg_try_advisory_lock`.
   - Startup connection is released back to the pool.
   - Repository-backed mutations remain protected with PostgreSQL transactions and row locks.

2. **Moved payment `createHold` onto the durable outbox boundary**
   - Funding transaction writes `payments(status=HOLD_PENDING)` and `PAYMENT_CREATE_HOLD` outbox event atomically.
   - The request handler no longer calls the provider directly in PostgreSQL mode.
   - Worker performs `createHold` and commits provider reference + `HELD` state atomically with outbox completion.
   - Provider contract is idempotent across worker retries.
   - Terminal outbox failure becomes `HOLD_FAILED`, and a subsequent funding request can safely requeue the same hold.
   - Release flow remains on the existing `PAYMENT_RELEASE` outbox path.

3. **Added real S3-compatible CI integration**
   - CI starts MinIO beside the real PostgreSQL service.
   - New integration test performs bucket creation, upload, HEAD, content-signature validation, and presigning against the live S3 endpoint.
   - Fixed the S3 upload implementation to use a real `fs.createReadStream` for `PutObject`.

4. **Additional hardening/tests**
   - Added static guard against reintroducing the advisory lock.
   - Added contract tests for `PAYMENT_CREATE_HOLD`, idempotent completion, retry, and terminal failure.
   - Added dedicated `npm run test:s3` CI test.

## Verification performed in this environment

- JavaScript syntax check: passed for all backend source/test files.
- `npm run test:fast`: **29/29 passed**.
- `node --test tests/outbox-contract.test.mjs`: **9/9 passed**.
- Source scans: no advisory-lock calls remain in `backend/src`; no direct `paymentProvider.createHold` call remains in `backend/src/app.js`.
- `tools/static_audit.sh`: completed; dependency audit reported **0 vulnerabilities** in the available audit data.

## Environment limitation

The sandbox does not provide Docker or Flutter, and dependency installation could not be completed here. Therefore the live PostgreSQL + MinIO integration suite, full Node E2E suite, Flutter tests, APK build, and Android emulator smoke cannot honestly be marked as executed locally. They are wired into `.github/workflows/ci.yml` for execution in CI.
