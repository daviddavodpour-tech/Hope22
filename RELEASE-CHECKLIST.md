# HOPE 3.5.0 Release Checklist

## Automated gates
- [ ] `npm ci` succeeds from a clean checkout.
- [ ] PostgreSQL 16 migration + full backend test suite passes.
- [ ] MinIO S3 integration passes (upload/head/signature validation).
- [ ] Performance smoke passes under 100 concurrent health probes.
- [ ] `npm audit --audit-level=high` has no high/critical findings.
- [ ] Flutter analyze, widget tests, and integration test pass.
- [ ] Release APK builds successfully.
- [ ] Android API 36 emulator installs, launches, force-stops, and relaunches the release APK.
- [ ] Security workflow passes CodeQL and publishes the SBOM.

## Operational gates
- [ ] `/health` reports database `ok`.
- [ ] `/ready` reports `ready=true`.
- [ ] `/metrics` is protected by `METRICS_TOKEN`.
- [ ] Database backup produced with `scripts/backup.sh`.
- [ ] Backup restored successfully into an isolated PostgreSQL instance using `scripts/restore.sh`.
- [ ] Outbox pending/failed counts are reviewed before production cutover.

## Rollback
- Keep previous container image and APK artifact available.
- Revert application deployment independently from database migration where possible.
- Never destroy the previous PostgreSQL backup before post-deploy verification completes.
