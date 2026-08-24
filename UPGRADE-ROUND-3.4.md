# HOPE Upgrade Round 3.4 — Release + UX + Observability

## What changed

### UI / UX
- Added `AnimatedEntrance` for progressive visual hierarchy and smoother first-render transitions.
- Added `PressableScale` with semantic button labels and tactile press feedback.
- Increased minimum interactive target sizes for text/icon buttons to improve accessibility.
- Added explicit page transition behavior in the theme.
- Fixed the jobs search filter affordance: it no longer renders a non-functional filter button unless a real callback is supplied.
- Added widget coverage for premium UI components and semantic interaction.

### Backend observability
- Request IDs now reject unsafe/unbounded caller-controlled values.
- Request latency is tracked as total, average, and max duration.
- Outbox processed/failed counters are exposed in `/metrics`.
- Outbox success/failure events are structured-logged with event IDs.
- Health version is aligned to the current 3.3/3.4 release line.

### Release gate / CI
- Added workflow concurrency and read-only repository permissions.
- Added the new contract lane to CI.
- Flutter coverage is collected during CI tests.
- Android smoke now verifies that the HOPE package is the active application after launch/relaunch.
- Added a dedicated `release-gate` job depending on backend, Flutter, and Android smoke lanes.
- Added `CI-RELEASE-GATE.md` with the authoritative local verification commands.
- Aligned `backend/package.json` and `backend/package-lock.json` to version `3.3.0`.

## Validation in this sandbox

- Backend JavaScript syntax: PASS.
- Backend contract/static suite: **20/20 PASS**.
- Static audit: PASS; offline dependency audit reported **0 vulnerabilities**.
- Full backend test command was attempted but cannot complete in this sandbox because the archive does not contain installed runtime dependencies (`pg`, AWS SDK) and this environment does not provide the dependency install/runtime stack needed for the full PostgreSQL/S3 E2E run.
- Flutter SDK is not installed in this sandbox, so `flutter analyze`, widget tests, APK build, and emulator execution are intentionally delegated to the CI release gate.
