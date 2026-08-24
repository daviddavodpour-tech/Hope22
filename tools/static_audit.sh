#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo '[1] Dart risky catches / prints'
grep -RInE 'catch \(_\)|print\(|debugPrint\(' lib || true

echo '[2] Android release signing'
grep -n 'signingConfig\|minSdk\|targetSdk\|compileSdk' android/app/build.gradle.kts

echo '[3] API base URL'
grep -RIn 'API_BASE_URL' lib android README.md ANDROID-BUILD-CONTRACT.md || true

echo '[4] Backend syntax'
for f in backend/src/*.js; do node --check "$f"; done

echo '[5] Dependency audit (offline cache if available)'
(cd backend && npm audit --offline --json)
