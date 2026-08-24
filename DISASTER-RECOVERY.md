# Disaster Recovery

## Recovery objectives
- RPO target: 24h minimum with daily PostgreSQL logical backups; production may tighten this using WAL/PITR.
- RTO target: 60 minutes for API/database restoration.

## Procedure
1. Stop writes or place API behind maintenance protection.
2. Restore latest verified `pg_dump` with `scripts/restore.sh` into a clean PostgreSQL instance.
3. Run `npm run migrate` to apply forward-compatible schema changes.
4. Validate `/health` and `/ready`.
5. Validate outbox pending/failed events and re-enable workers.
6. Reattach S3 credentials/bucket and verify object access.

## Verification
Backups must be tested periodically in an isolated database; a backup file existing on disk is not considered proof of recoverability.
