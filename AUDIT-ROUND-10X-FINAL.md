# HOPE 3.5.0 — Deep Pre-Release Audit (10x-style)

Date: 2026-08-24

## Scope
Reviewed backend architecture, PostgreSQL concurrency, payment/outbox/idempotency, authentication/session rotation, storage/S3 upload flows, multipart parsing, observability, Docker/runtime packaging, GitHub Actions, Flutter API wiring, Android release configuration, and regression contracts.

## Fixed in this round

1. Removed double request-metric counting from the HTTP response path.
2. Prevented recursive 401 -> logout -> 401 refresh/logout behavior on the mobile client.
3. Enforced build-time API base URL and HTTPS for release builds.
4. Bounded accepted PBKDF2 parameters to prevent malicious stored hashes from causing excessive CPU work.
5. Made failed payment-release outbox events retryable instead of permanently stuck.
6. Made payment-release provider calls carry an explicit idempotency key.
7. Changed outbox workers to fail/retry when the DB completion transaction does not actually complete.
8. Rejected provider-reference mismatches on already-held payments instead of silently overwriting state.
9. Made `createHold` retry from `HOLD_FAILED` restore the original idempotency identity when available.
10. Validated body-based payment idempotency keys exactly like header keys and rejected header/body disagreement.
11. Mapped evidence storage-reference ownership failures to explicit HTTP 403 responses.
12. Added storage-reference path traversal hardening.
13. Made evidence insertion + job timestamp update a single PostgreSQL transaction with row locking.
14. Added equivalent storage-reference authorization to file-mode development fallback.
15. Fixed mobile evidence to use `storage://...` references after upload.
16. Hardened multipart parsing so parse failures remove temporary files.
17. Added best-effort orphan object cleanup if an upload succeeds but DB registration fails.
18. Added storage delete support for local/S3 implementations.
19. Fixed Android CI smoke to use a debug APK rather than attempting to install an unsigned release APK.
20. Moved Flutter integration tests into the emulator-backed CI step instead of running them without a device.
21. Enforced Flutter lockfile resolution for production APK builds.
22. Serialized Node test execution to avoid shared-PostgreSQL cross-file test races.
23. Kept production Docker image self-contained with `npm ci --omit=dev` and a non-root runtime user.
24. Kept release signing fail-closed and HTTPS-only API configuration for production APKs.

## Evidence from this environment

- Backend JavaScript syntax checks: PASS.
- Shell syntax checks: PASS.
- GitHub Actions YAML parsing: PASS for build-apk, CI, performance, security workflows.
- Regression/static suite: **22/22 PASS**.
- Offline dependency audit snapshot: **0 vulnerabilities** (189 dependency entries reported by the audit cache).
- No PostgreSQL advisory single-writer lock calls remain in backend source.
- No device-less `flutter test integration_test` call remains in CI workflows.

## Runtime limitations

This sandbox does not contain a usable Flutter SDK/Android SDK, Docker runtime, or a networked npm registry. Therefore this environment cannot honestly claim a real APK build, Android emulator run, PostgreSQL service run, MinIO run, or full networked `npm ci`/E2E execution. Those gates remain enforced in GitHub Actions and must be green on the release commit before production release.

## Release conclusion

Source and release contracts are substantially hardened. The remaining release proof is environmental/external: a real CI run with Flutter + Android emulator + PostgreSQL + MinIO + production signing secrets.
