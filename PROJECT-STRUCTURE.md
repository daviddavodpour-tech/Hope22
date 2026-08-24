# HOPE — Project Structure

- `lib/` — Flutter mobile application
- `android/` — Android/Gradle project
- `backend/` — Node.js API, database/repository, tests and OpenAPI
- `data/` — development datastore seed/state file; do not use as production DB
- `test/` — Flutter unit/widget tests
- `tools/` — local audit/build helper scripts
- `.github/workflows/` — CI and APK build workflow

Important files:

- `pubspec.yaml` — Flutter dependencies and SDK contract
- `android/app/build.gradle.kts` — Android app/build/signing configuration
- `android/settings.gradle.kts` — AGP/Kotlin plugin versions
- `android/gradle/wrapper/gradle-wrapper.properties` — Gradle distribution
- `backend/package.json` — backend scripts/dependencies
- `backend/.env.example` — backend configuration template
- `BUILD-APK-PROMPT.md` — ready-to-use APK build prompt
- `RELEASE-CHECKLIST.md` — release validation checklist
- `ANDROID-BUILD-CONTRACT.md` — Android build contract
- `FULL-AUDIT-REPORT.md` — technical audit history
- `UI-UPGRADE-ROUND.md` — UI upgrade notes
