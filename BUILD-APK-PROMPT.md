# HOPE — Prompt آماده برای ساخت APK

این پروژه یک اپ Flutter به نام HOPE است. هدف، ساخت APK Release سالم و قابل نصب است.

## پرامپت پیشنهادی

تو مسئول Build و Release پروژه Flutter «HOPE» هستی. سورس کامل پروژه در اختیار توست. بدون تغییر دادن منطق کسب‌وکار یا طراحی UI، این مراحل را دقیق انجام بده:

1. Flutter Stable 3.47.0 یا نسخه patch بالاتر از همین شاخه Stable را استفاده کن.
2. Java/JDK 17 را فعال کن.
3. داخل ریشه پروژه اجرا کن:
   - `flutter clean`
   - `flutter pub get`
   - `flutter analyze`
   - `flutter test`
4. اگر هر خطای analyzer یا test وجود داشت، قبل از build آن را رفع کن و دوباره تمام تست‌ها را اجرا کن.
5. مطمئن شو `API_BASE_URL` با URL واقعی API تنظیم شده است. برای production از HTTPS استفاده کن:
   `--dart-define=API_BASE_URL=https://YOUR_API_HOST/api/v1`
6. برای release از debug keystore استفاده نکن. یکی از این متغیرهای محیطی باید برای signing واقعی تنظیم شده باشد:
   - `ANDROID_RELEASE_STORE_FILE`
   - `ANDROID_RELEASE_STORE_PASSWORD`
   - `ANDROID_RELEASE_KEY_ALIAS`
   - `ANDROID_RELEASE_KEY_PASSWORD`
7. سپس اجرا کن:
   `flutter build apk --release --dart-define=API_BASE_URL=https://YOUR_API_HOST/api/v1`
8. بعد از build، وجود فایل `build/app/outputs/flutter-apk/app-release.apk` را بررسی کن.
9. APK را با `apkanalyzer` یا `aapt dump badging` بررسی کن و مطمئن شو:
   - package = `com.hope.marketplace`
   - targetSdk = 36
   - minSdk = 30
   - release build است.
10. SHA-256 فایل APK را تولید کن و در گزارش release ثبت کن.
11. اگر signing credentials وجود ندارد، build را به‌عنوان «unsigned release» یا «release قابل انتشار نیست» گزارش کن و هرگز آن را signed فرض نکن.
12. در پایان یک گزارش کوتاه بده که شامل این موارد باشد:
   - Flutter version
   - Java version
   - analyzer result
   - test result
   - API_BASE_URL
   - signing status
   - APK path
   - APK SHA-256

## قوانین مهم

- URL واقعی production را داخل سورس hard-code نکن.
- secret، keystore، password، token یا `.env` واقعی را داخل repository قرار نده.
- debug HTTP فقط برای emulator/local development مجاز است؛ release باید HTTPS باشد.
- هیچ خطای build/test را نادیده نگیر.
- در صورت اختلاف بین فایل‌های راهنما و تنظیمات Gradle، تنظیمات واقعی پروژه را مرجع قرار بده و مستندات را با آن هماهنگ کن.
