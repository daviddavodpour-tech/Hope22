# HOPE-v2-upgraded — Local Verification Report

Date: 2026-08-24

## Executed successfully

- Node.js syntax check for all `backend/src/*.js`: PASS
- Shell syntax checks for `tools/build_apk_release.sh` and `tools/static_audit.sh`: PASS
- JSON parsing for `backend/package.json` and `backend/package-lock.json`: PASS
- YAML parsing for both GitHub Actions workflows: PASS
- `backend/tests/regression-static.test.mjs`: 7/7 PASS
- `backend/tests/relational-schema.test.mjs`: 2/2 PASS
- `backend/tests/route-contract.mjs`: 3/3 PASS
- `backend/tests/workflow.test.mjs`: 2/2 PASS

## Failure found

`backend/tests/repository-contract.test.mjs`: 0/1 PASS.

The assertion expects the exact SQL text `SELECT id FROM jobs WHERE id=$1 FOR UPDATE`, while the implementation uses `SELECT * FROM jobs WHERE id=$1 FOR UPDATE`. The important semantic property—locking the job row with `FOR UPDATE` before state validation—is present in the implementation. This should be treated as a stale/brittle contract assertion and updated to test the semantic lock rather than a specific projection.

## Full backend suite limitation

`npm test` was attempted. Two E2E suites could not start because the local `node_modules` tree was incomplete (`pg/index.js` missing). A fresh `npm ci` was attempted but timed out in this environment. The static suites still ran and produced the results above.

## Android / Flutter limitation

Flutter SDK is not installed in this execution environment. Android Gradle wrapper exists but `android/gradlew` is not executable in the extracted archive (`Permission denied`). Therefore Flutter build, Gradle build, APK installation, ADB smoke testing, and APK signature verification were not falsely marked as passed.

## Resource check

`android/app/src/main/res/xml/network_security_config.xml` EXISTS. No fix is needed for the previously suspected Release-resource issue.
