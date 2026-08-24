# HOPE 3.5.0 Release Confidence

## Production gate
- Backend: PostgreSQL 16, migration, full E2E, S3/MinIO, contract, security audit.
- Mobile: analyze, widget tests, integration test surface, release APK, Android emulator smoke.
- Security: npm audit (high+), CodeQL, SBOM artifact, production env invariants.
- Operations: request latency metrics, route-level stats, outbox counters, health/readiness, backup/restore contracts.
- Performance: concurrent health probe gate and repeatable CI workflow.

## Required evidence before 95/100 release approval
1. One green GitHub Actions `HOPE CI` run on the release commit.
2. One green `HOPE Security` run with no high/critical audit findings.
3. One green `HOPE Performance` run.
4. Successful APK install + emulator smoke.
5. Production rehearsal of `backup.sh` followed by `restore.sh` in an isolated database.

A passing artifact build alone is not considered production evidence.
