# HOPE — Complete Project Package

این آرشیو نسخه مرتب و یکپارچه پروژه HOPE است و شامل کل سورس Flutter، Android، Backend، تست‌ها و مستندات Build است.

## سریع‌ترین مسیر ساخت APK

1. Flutter Stable 3.47.x و JDK 17 نصب کنید.
2. `flutter pub get`
3. `flutter analyze`
4. `flutter test`
5. متغیر `API_BASE_URL` را روی API واقعی production تنظیم کنید.
6. برای release signing واقعی، متغیرهای `ANDROID_RELEASE_*` را تنظیم کنید.
7. اجرا کنید:

```bash
./tools/build_apk_release.sh
```

یا مطابق `BUILD-APK-PROMPT.md` عمل کنید.

## نکته

این پکیج هیچ production secret، keystore واقعی یا `.env` واقعی ندارد. `backend/.env.example` فقط template تنظیمات است.

برای اجرای backend تولیدی قبل از انتشار، PostgreSQL واقعی، storage مناسب، HTTPS، secretهای تصادفی و تنظیمات CORS/rate-limit را در staging تست کنید.

## Genspark handoff

برای تبدیل این archive به APK واقعی، از فایل `GENSPARK-FINAL-APK-BUILD-PROMPT.md` استفاده کنید. این prompt دقیقاً برای همین نسخه 3.5.0 نوشته شده و build، test، signing، emulator smoke و SHA-256 را به‌صورت مرحله‌ای verify می‌کند.
