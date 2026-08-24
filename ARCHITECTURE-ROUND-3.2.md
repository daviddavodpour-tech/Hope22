# HOPE 3.2.0 — Production Architecture Upgrade

## Completed in this round

### 1. Durable payment release outbox
- Added `outbox_events` PostgreSQL table with unique dedupe key, retry attempts, leases, backoff, terminal failure and timestamps.
- Payment release is first persisted as a durable intent in the same SQL transaction that validates ownership/state.
- Worker claims with `FOR UPDATE SKIP LOCKED`, making multiple worker instances safe.
- Provider release is idempotency-aware. A provider success followed by process crash can be retried without double settlement.
- API preserves fast success when the worker finishes immediately; otherwise returns HTTP 202 with a durable outbox event id.
- Settlement audit is committed atomically with payment/job finalization.

### 2. PostgreSQL read-path hardening
The following production read paths now query PostgreSQL directly instead of relying on the in-memory snapshot when `DATABASE_URL` is configured:
- category list
- public job list
- current user's job list
- job offer list
- category existence validation on job creation
- owner/provider display data and offer counts for these list endpoints

This reduces stale-read risk and makes horizontal scaling materially safer.

### 3. Consistency fixes
- Removed redundant job-state guard.
- Removed unnecessary synchronization of repository results back into the in-memory PostgreSQL snapshot after offer acceptance.
- PostgreSQL remains the source of truth for the affected paths.

## Verification
- Backend JavaScript syntax: PASS
- Shell syntax: PASS
- Contract/static/security/workflow/relational/outbox tests: 34/34 PASS
- Full `npm test`: partially blocked by the supplied environment because `node_modules/pg/index.js` is missing/corrupt; this is a dependency-installation issue, not a test assertion failure. `npm ci --ignore-scripts` timed out in this environment.
- Flutter/Android/PostgreSQL/S3 live integration: not executable in this environment and intentionally not marked PASS.

## Remaining architectural work
1. Remove the legacy PostgreSQL single-writer advisory lock after every remaining mutation is fully repository-backed.
2. Replace the remaining synchronous payment `createHold` side-effect with the same durable outbox/idempotency boundary when a real PSP adapter is introduced.
3. Add PostgreSQL/S3 integration tests to CI and real Android emulator smoke tests.
4. Add observability dashboards/alerts for `outbox_events` stuck in PROCESSING/FAILED.
