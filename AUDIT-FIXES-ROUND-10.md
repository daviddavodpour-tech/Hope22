# HOPE — audit/fix pass

This source package is based on the previous fixed V1 source and includes a further deep bug-fix pass.

## Fixed in this pass

- Guest-first entry remains enabled; account is no longer required to open the app.
- Added an explicit “continue as guest” action to the login screen.
- Invalid/incomplete stored sessions are cleared during startup restore instead of leaving stale tokens behind.
- Concurrent access-token refresh requests now share one in-flight refresh operation instead of causing false logout races.
- Public job listings can only expose `PUBLISHED` jobs to anonymous clients.
- Private job details cannot be fetched anonymously or by unrelated users.
- Login now rejects disabled/non-active accounts before issuing tokens.
- Public job owner/provider objects no longer expose account email addresses.
- PostgreSQL funding no longer mutates in-memory offer/job state before the SQL transaction succeeds.
- PostgreSQL funding atomically accepts the selected offer, rejects competing pending offers, creates the payment, and updates the job.
- Password-reset requests no longer print reset tokens into application logs.
- Added regression tests covering privacy of public job responses and disabled-account login.

## Validation

Backend test suite: **11/11 passing**.

Node syntax checks: passing for the server, app, DB, HTTP and observability modules.

A real Flutter APK build was not run in this environment because the Flutter SDK is not installed in the available runtime. The source remains configured for the documented Flutter/Android toolchain build.

## Important build note

The API endpoint is injected at build time; do not build a production APK without a real API endpoint:

```bash
flutter build apk --release --dart-define=API_BASE_URL=https://YOUR_API_HOST/api/v1
```

For local Android emulator testing only:

```bash
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1
```
