# HOPE production handoff

## Data
PostgreSQL uses real relational tables with foreign keys, unique constraints and payment idempotency constraints. The API retains its existing JSON response contract so the Flutter client does not need a breaking change.

## Transactions
Offer acceptance, funding, refresh rotation and settlement run through the transaction helper. Repository transactions use row-level locking and PostgreSQL transactions; the old process-wide advisory single-writer lock is intentionally removed so multiple API replicas can mutate concurrently.

## Operations
- `GET /health` and `/api/v1/health` expose database status.
- `GET /metrics` exposes lightweight counters.
- `X-Request-Id` is returned on responses.
- Authentication endpoints have a process-local rate limit; put a shared rate limiter at the edge before horizontal scaling.
- `scripts/backup.sh` creates pg_dump custom-format backups; `scripts/restore.sh` restores them.

## Object storage
Production requires S3-compatible object storage so uploads survive container replacement and horizontal scaling. Local storage remains available only for development/test mode.

## Validation gates
`npm run check && npm test` must pass before deployment. CI should additionally run the Flutter analyze/test/build jobs against the same commit.

## Object storage
Set `STORAGE_BACKEND=s3` with `S3_BUCKET`, `S3_REGION` and optional `S3_ENDPOINT` for S3-compatible object storage. Existing `/storage/upload` remains compatible; `/storage/presign` adds a presigned PUT path for clients that want direct uploads.


## 2026-08 production hardening

- Production now requires `STORAGE_BACKEND=s3` so uploaded evidence survives container replacement.
- Password reset delivery is explicit: set `RESET_TOKEN_DELIVERY_MODE=webhook` and an HTTPS `RESET_TOKEN_DELIVERY_URL`. The API posts the one-time reset token to that delivery service and fails closed if delivery is unavailable.
- Direct S3 uploads now use `/storage/presign` followed by `/storage/complete`; completion verifies the object with `HEAD` before recording it in the uploads table.
- Local multipart uploads are retained in `STORAGE_DIR` instead of being discarded after the request.
