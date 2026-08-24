# HOPE 3.5.0 — Genspark Start Here

این آرشیو **نسخه نهایی audited پروژه HOPE** است و هدف این handoff ساخت APK واقعی Android است.

## فایل اصلی برای Genspark

به‌ترتیب این فایل‌ها را مرجع قرار بده:

1. `GENSPARK-FINAL-APK-BUILD-PROMPT.md` ← **پرامپت اصلی و کامل**
2. `RELEASE-APK-CONTRACT.md` ← معیارهای قطعی release
3. `ANDROID-BUILD-CONTRACT.md` ← قرارداد Android/Gradle
4. `tools/build_apk_release.sh` ← entrypoint استاندارد build
5. `BUILD-STATUS-2026-08-24.md` ← وضعیت قبلی و محدودیت‌های شناخته‌شده

## اطلاعات مهم پروژه

- App: HOPE
- applicationId: `com.hope.marketplace`
- versionName: `3.5.0`
- versionCode: `5`
- Flutter: `3.47.1` stable
- Java/JDK: `17`
- compileSdk: `36`
- targetSdk: `36`
- minSdk: `30`

## برای production APK

Genspark باید این مقادیر را از Secret/Environment دریافت کند و هرگز داخل repo ننویسد:

- `API_BASE_URL` — باید HTTPS باشد
- `ANDROID_RELEASE_STORE_FILE`
- `ANDROID_RELEASE_STORE_PASSWORD`
- `ANDROID_RELEASE_KEY_ALIAS`
- `ANDROID_RELEASE_KEY_PASSWORD`

اگر signing secret وجود نداشت، خروجی باید `NOT READY / NON-PUBLISHABLE` گزارش شود؛ یک APK تستی را production فرض نکند.

## خروجی مورد انتظار

`build/app/outputs/flutter-apk/app-release.apk`

همراه با SHA-256 و گزارش کامل verification.
