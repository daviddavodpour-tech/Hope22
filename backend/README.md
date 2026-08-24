# HOPE API

Self-contained backend matching the current Flutter client contract.

## Run locally

```bash
cp .env.example .env
node src/migrate.js
node src/server.js
```

Health: `GET http://localhost:3000/api/v1/health`

Set Flutter base URL for Android emulator:

```bash
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1
```

## Implemented modules

Auth/register/login/logout/refresh, password-reset request, provider profile, categories, jobs, offers + acceptance, funding, execution state transitions, evidence metadata, multipart file upload, payment release/settlement, audit trail, JSON persistence, security headers/CORS and upload limits.

## State machine

`DRAFT -> PUBLISHED -> ASSIGNED -> FUNDED -> IN_PROGRESS -> DELIVERED -> COMPLETED -> SETTLED`.

Payment state: `HELD -> RELEASE_PENDING -> RELEASED`.

For compatibility with the current mobile UI, `/payments/fund/:jobId` will select the lowest pending offer when the job has not yet been assigned. A future UI can use `POST /offers/:offerId/accept` explicitly before funding.

## Security

Passwords use PBKDF2-SHA256; access tokens are short-lived signed JWT-compatible tokens; refresh tokens are random, hashed, rotated and revoked on use; production secrets are mandatory; upload size is capped.

The built-in JSON datastore is intentionally zero-dependency for local/mobile testing. For multi-instance production deployment, replace `src/db.js` with a PostgreSQL adapter before scaling horizontally.


## Production readiness

- PostgreSQL is the durable store when `DATABASE_URL` is set.
- The API acquires a PostgreSQL advisory writer lock to prevent two active writers from corrupting the snapshot state.
- Mutations are flushed before request handling finishes; a persistence error is logged and should be monitored as an operational failure.
- `/health` and `/api/v1/health` check database availability and return HTTP 503 when PostgreSQL is unavailable.
- Use HTTPS at the edge, rotate `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET`, and provision PostgreSQL backups/PITR before production launch.


## v9 SQL repository

The API keeps the existing HTTP contract but moves critical mutations to SQL repositories with PostgreSQL transactions and row-level locks. The compatibility state layer remains only to avoid breaking the current Flutter contract while the remaining non-critical reads are migrated incrementally.

Critical paths now using the SQL repository include registration, job creation, offer creation/acceptance, funding, and payment release. CI must run the full suite with PostgreSQL before production deployment.
