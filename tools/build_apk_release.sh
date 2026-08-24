#!/usr/bin/env bash
set -euo pipefail

: "${API_BASE_URL:?Set API_BASE_URL, e.g. https://api.example.com/api/v1}"

case "$API_BASE_URL" in
  https://*) ;;
  *) echo 'ERROR: API_BASE_URL must use HTTPS for a production release.' >&2; exit 1 ;;
esac

cd "$(dirname "$0")/.."

# Production signing is explicit. Pilot builds may opt into the existing
# Android/Gradle test-signing path without pretending it is production-signed.
BUILD_PROFILE="${BUILD_PROFILE:-production}"
if [[ "$BUILD_PROFILE" != "production" && "$BUILD_PROFILE" != "pilot" ]]; then
  echo 'ERROR: BUILD_PROFILE must be production or pilot.' >&2
  exit 1
fi

if [[ "$BUILD_PROFILE" == "production" ]]; then
  : "${ANDROID_RELEASE_STORE_FILE:?Set ANDROID_RELEASE_STORE_FILE for a production release}"
  : "${ANDROID_RELEASE_STORE_PASSWORD:?Set ANDROID_RELEASE_STORE_PASSWORD for a production release}"
  : "${ANDROID_RELEASE_KEY_ALIAS:?Set ANDROID_RELEASE_KEY_ALIAS for a production release}"
  : "${ANDROID_RELEASE_KEY_PASSWORD:?Set ANDROID_RELEASE_KEY_PASSWORD for a production release}"
fi

chmod +x android/gradlew
flutter clean
flutter pub get
flutter analyze
flutter test

flutter build apk --release --dart-define=API_BASE_URL="$API_BASE_URL"


mapfile -t APKS < <(find build -type f -name '*.apk' -print | sort)
if [[ "${#APKS[@]}" -eq 0 ]]; then
  echo 'ERROR: Flutter reported success but no APK artifact exists under build/.' >&2
  exit 1
fi

APK="build/app/outputs/flutter-apk/app-release.apk"
if [[ ! -f "$APK" ]]; then
  if [[ "${#APKS[@]}" -eq 1 ]]; then
    APK="${APKS[0]}"
  else
    echo 'ERROR: Multiple APK artifacts exist and the expected universal release APK is missing:' >&2
    printf '  %s\n' "${APKS[@]}" >&2
    exit 1
  fi
fi

if command -v aapt >/dev/null 2>&1; then
  BADGING="$(aapt dump badging "$APK")"
  grep -q "package: name='com.hope.marketplace'" <<<"$BADGING" || { echo 'ERROR: wrong applicationId.' >&2; exit 1; }
fi
if command -v aapt >/dev/null 2>&1; then
  grep -q "versionName='3.5.0'" <<<"$BADGING" || { echo 'ERROR: unexpected versionName.' >&2; exit 1; }
fi

if command -v apksigner >/dev/null 2>&1; then
  apksigner verify --verbose "$APK"
  if [[ "$BUILD_PROFILE" == "production" ]]; then
    APKSIGNER_STATUS="verified-production"
  else
    APKSIGNER_STATUS="verified-pilot"
  fi
elif [[ "$BUILD_PROFILE" == "production" ]]; then
  echo 'ERROR: apksigner is required to verify a production APK signature.' >&2
  exit 1
else
  APKSIGNER_STATUS="not-verified"
  echo 'WARNING: apksigner not available; signature verification not performed.' >&2
fi

if command -v sha256sum >/dev/null 2>&1; then
  SHA256="$(sha256sum "$APK" | awk '{print $1}')"
elif command -v shasum >/dev/null 2>&1; then
  SHA256="$(shasum -a 256 "$APK" | awk '{print $1}')"
else
  SHA256="UNAVAILABLE"
fi

printf '\nRelease artifact\n-----------------\n'
printf 'Profile: %s\n' "$BUILD_PROFILE"
printf 'APK: %s\n' "$APK"
printf 'Size: %s bytes\n' "$(stat -c '%s' "$APK" 2>/dev/null || stat -f '%z' "$APK")"
printf 'SHA-256: %s\n' "$SHA256"
printf 'API_BASE_URL: %s\n' "$API_BASE_URL"
printf 'Signature verification: %s\n' "$APKSIGNER_STATUS"
