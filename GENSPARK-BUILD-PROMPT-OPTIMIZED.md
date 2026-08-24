# Genspark — HOPE Final QA / Build / Release Prompt (Token-Optimized)

## مأموریت
تو مسئول نهایی QA، Build و Release پروژه HOPE هستی. هدف این نیست که فقط APK بسازی؛ باید با کمترین رفت‌وبرگشت و کمترین مصرف توکن، **ریشه مشکل را پیدا کنی، تست‌های ممکن را اجرا کنی، فقط خطاهای واقعی را اصلاح کنی، Release artifact را verify کنی و یک گزارش قابل اثبات تحویل بدهی.**

این پروژه محدودیت محیطی دارد. هرگز به دلیل نبودن یک ابزار، کل کار را متوقف نکن. ابتدا قابلیت‌های محیط را کشف کن، سپس بهترین تست/Build معادل را اجرا کن و موردی را که واقعاً ممکن نیست با برچسب `BLOCKED` ثبت کن.

---

## قوانین مصرف توکن و جلوگیری از خطا

1. **اول تشخیص، بعد تغییر.** قبل از نصب یا rebuild وضعیت ابزارها و فایل‌ها را در حداکثر یک pass بررسی کن.
2. نسخه ابزارها را فقط یک بار گزارش کن؛ دوباره تکرار نکن.
3. از نصب مجدد dependencyها یا SDKهایی که وجود دارند خودداری کن.
4. اگر یک install/network command timeout شد، آن را پشت سر هم تکرار نکن. علت را ثبت کن و از cache/offline/گزینه معادل استفاده کن.
5. اگر یک تست fail شد، اول failure را طبقه‌بندی کن: `REAL BUG`، `STALE TEST`، `ENVIRONMENT BLOCKED` یا `TOOLING ISSUE`.
6. برای `STALE TEST` کد محصول را خراب نکن؛ خود assertion تست را با رفتار واقعی و امن پروژه هم‌راستا کن و همان تست را دوباره اجرا کن.
7. برای `TOOLING ISSUE` اول کم‌هزینه‌ترین اصلاح را انجام بده؛ مثلاً permission، path یا working directory.
8. Buildهای تکراری بی‌دلیل نگیر. پس از هر تغییر، فقط تست/Build لازم برای همان تغییر و سپس یک full verification نهایی اجرا شود.
9. artifact قدیمی را با artifact جدید اشتباه نگیر؛ timestamp و SHA-256 را ثبت کن.
10. هیچ test یا security check را برای سبز شدن pipeline حذف/skip/disable نکن.
11. هر چیزی که واقعاً اجرا و verify نشده را `NOT VERIFIED` یا `BLOCKED` اعلام کن؛ هرگز PASS فرض نکن.
12. از من سؤال تأیید نکن مگر credential یا دسترسی واقعاً لازم و غیرقابل‌جایگزین باشد.

---

## وضعیت و نکات شناخته‌شده این نسخه

قبل از شروع، این موارد را در نظر بگیر:

- `android/app/src/main/res/xml/network_security_config.xml` وجود دارد؛ این مورد را دوباره به‌عنوان خطای Release مطرح نکن.
- `android/gradlew` ممکن است executable نباشد. ابتدا permission را بررسی کن و در صورت نیاز فقط `chmod +x android/gradlew` انجام بده.
- اجرای مستقیم Gradle از داخل `android/` معمولاً artifact را در `android/app/build/...` می‌گذارد، در حالی که Flutter CLI انتظار مسیر `build/app/...` را دارد. این **به‌تنهایی bug نیست**. اول working directory و command را تشخیص بده؛ APK را دستی جابه‌جا نکن.
- یک regression test فعلی در `backend/tests/repository-contract.test.mjs` عبارت `SELECT id FROM jobs ... FOR UPDATE` را انتظار دارد، در حالی که implementation فعلی `SELECT * FROM jobs ... FOR UPDATE` دارد. این تست در صورت تأیید منطق قفل، یک **STALE TEST** است، نه دلیل تخریب implementation.
- اگر `npm ci` به دلیل شبکه timeout شد، dependency installation را بی‌نهایت تکرار نکن.

---

# فاز 1 — Discovery یک‌باره

از root پروژه اجرا کن:

```bash
pwd
flutter --version || true
java -version || true
node --version || true
npm --version || true
ls -l android/gradlew || true
find . -maxdepth 4 -type f \( -name '*.apk' -o -name '*.aab' \) -print
```

همچنین این‌ها را فقط یک بار بررسی کن:

- `pubspec.yaml`
- `backend/package.json`
- `android/app/build.gradle.kts`
- `.github/workflows/ci.yml`
- `.github/workflows/build-apk.yml`

اگر ابزار لازم وجود دارد، **نصب نکن**؛ مستقیم استفاده کن.

---

# فاز 2 — Permission و Wrapper

اگر:

```bash
test -x android/gradlew
```

ناموفق بود:

```bash
chmod +x android/gradlew
```

دوباره فقط یک بار verify کن.

---

# فاز 3 — تست کامل Backend

از `backend/`:

### 3.1 Dependency

ابتدا وجود `node_modules` و completeness آن را بررسی کن. اگر سالم است reinstall نکن.

اگر ناقص است فقط یک بار:

```bash
npm ci --no-audit --no-fund
```

اگر timeout/network failure شد:

- آن را `ENVIRONMENT BLOCKED` ثبت کن.
- dependencyها را بی‌نهایت تکرار نکن.
- تست‌های builtin/static را که بدون dependency قابل اجرا هستند ادامه بده.

### 3.2 Syntax

تمام فایل‌های Backend:

```bash
for f in src/*.js; do node --check "$f"; done
```

### 3.3 Test suite

ابتدا:

```bash
npm test
```

سپس در صورت وجود script:

```bash
npm run test:e2e
npm run check
```

### 3.4 تست‌های قرارداد/استاتیک

اگر `npm test` به خاطر dependency یا یک test نامرتبط متوقف شد، این‌ها را جداگانه اجرا کن:

```bash
node --test tests/regression-static.test.mjs
node --test tests/relational-schema.test.mjs
node --test tests/repository-contract.test.mjs
node --test tests/route-contract.mjs
node --test tests/workflow.test.mjs
```

### 3.5 طبقه‌بندی failure

اگر `repository-contract.test.mjs` به دلیل تفاوت `SELECT id` و `SELECT *` fail شد:

1. implementation را بررسی کن.
2. مطمئن شو `FOR UPDATE` و ترتیب lock-before-check حفظ شده است.
3. اگر منطق درست است، فقط assertion تست را اصلاح کن تا semantic behavior را بررسی کند.
4. همان test را دوباره اجرا کن.

---

# فاز 4 — Static / Security Audit

بدون ابزار اضافی، این موارد را بررسی کن:

```bash
bash -n tools/build_apk_release.sh
bash -n tools/static_audit.sh
```

و:

```bash
rg -n 'TODO|FIXME|print\(|debugPrint\(|catch \(_\)' lib test backend/src
```

موارد `catch (_)`, log و TODO را فقط گزارش نکن؛ بررسی کن آیا در مسیرهای حساس باعث swallowing error می‌شوند. فقط مورد واقعی را اصلاح کن.

بررسی کن:

- secrets در repo
- hard-coded production credentials
- debug signing در release
- HTTP در Production
- API_BASE_URL hard-coded
- storage persistence
- password reset delivery
- upload validation
- idempotency
- auth/session handling

---

# فاز 5 — Flutter QA

اگر Flutter در محیط وجود دارد:

```bash
flutter pub get
flutter analyze
flutter test
```

بعد از هر failure فقط همان بخش را اصلاح و targeted rerun کن.

سپس یک بار full verification مجدد بگیر.

اگر Flutter وجود ندارد:

- آن را بدون دلیل و بدون access به SDK بزرگ install نکن.
- وضعیت را `BLOCKED: Flutter SDK unavailable` ثبت کن.
- به تست‌های قابل‌اجرای Android/Gradle/Static ادامه بده.

---

# فاز 6 — Android / Gradle

## 6.1 تشخیص output path

از root:

```bash
find . -type f -name '*.apk' -print
find build android/app/build -type f -name '*.apk' -print 2>/dev/null || true
```

اگر artifact قبلی وجود دارد، timestamp و hash آن را ثبت کن و آن را artifact جدید فرض نکن.

## 6.2 Gradle build

ابتدا از `android/` یا با wrapper root-compatible:

```bash
./android/gradlew -p android assembleRelease
```

اگر wrapper فقط از داخل `android/` قابل استفاده است:

```bash
cd android
./gradlew assembleRelease
```

**فقط یکی از این مسیرها را بر اساس ساختار واقعی انتخاب کن.**

موفقیت Gradle را با خروجی واقعی `BUILD SUCCESSFUL` اثبات کن.

## 6.3 Flutter build

اگر Flutter در محیط موجود است:

```bash
cd <repo-root>
flutter build apk --release --dart-define=API_BASE_URL=<configured-url>
```

در صورت وجود flavor/variant همان variant واقعی پروژه را استفاده کن.

اگر Flutter artifact را در مسیر مورد انتظار پیدا نکرد ولی Gradle artifact ساخته است:

- path/working-directory/variant/output configuration را بررسی کن.
- root cause را اصلاح کن.
- APK را صرفاً برای ساکت کردن Flutter به مسیر دیگری copy نکن.

---

# فاز 7 — APK Verification

برای **همان APK جدید**:

```bash
find . -type f -name '*.apk' -printf '%TY-%Tm-%Td %TH:%TM:%TS %s %p\n'
sha256sum <APK>
```

سپس با ابزار موجود:

```bash
apkanalyzer manifest application-id <APK>
apksigner verify --verbose <APK>
```

بررسی کن:

- applicationId = `com.hope.marketplace`
- release variant
- versionCode / versionName
- ABI
- permissions
- launcher activity
- network security config
- signature

اگر ابزار `apkanalyzer` یا `apksigner` موجود نیست، جایگزین محلی موجود را استفاده کن و وضعیت را دقیق ثبت کن.

---

# فاز 8 — Install / Smoke Test

اگر ADB/device/emulator موجود است:

```bash
adb install -r <APK>
adb shell monkey -p com.hope.marketplace 1
```

سپس smoke test:

- startup
- login/register
- logout/session restore
- home/navigation
- jobs
- create job validation
- offer/accept flow
- payment state flow در حد backend فعلی
- evidence/upload entry
- password reset entry
- network error handling

در صورت crash:

```bash
adb logcat
```

و فقط stack trace مرتبط را بررسی کن.

---

# فاز 9 — CI فقط بعد از local success

تا وقتی local build سالم نشده، CI را راه‌حل مشکل ندان.

پس از موفقیت local:

- CI versions را با local هماهنگ کن.
- cache را فعال کن.
- `flutter analyze` و `flutter test` را نگه دار.
- backend tests را نگه دار.
- APK artifact upload شود.
- SHA-256 تولید شود.
- در CI نیز package ID و signature verify شود.

CI نباید تستی را حذف کند فقط برای اینکه pipeline سبز شود.

---

# فاز 10 — Release Gate

فقط وقتی artifact را Release Candidate اعلام کن که همه موارد قابل‌اجرا PASS باشند:

```text
[PASS] Backend syntax
[PASS] Backend tests
[PASS] Backend static/contract tests
[PASS] Flutter analyze
[PASS] Flutter tests
[PASS] Gradle release build
[PASS] Flutter release build
[PASS] APK exists
[PASS] Correct applicationId
[PASS] Signature verification
[PASS] SHA-256
[PASS] Install
[PASS] Launch
[PASS] Smoke test
```

موارد غیرقابل‌اجرا:

```text
[BLOCKED] <item>
Reason: <exact environment limitation>
```

---

# گزارش نهایی — فقط یک بار و بدون تکرار جزئیات

```text
BUILD STATUS
Gradle: PASS/FAIL/BLOCKED
Flutter: PASS/FAIL/BLOCKED

TESTS
Backend: X passed / Y failed / Z blocked
Flutter: X passed / Y failed / Z blocked
Static/Security: PASS/FAIL

APK
Path:
Size:
SHA-256:
ApplicationId:
Version:
ABI:

SIGNING
Type:
Verification:

INSTALL
PASS/FAIL/BLOCKED

SMOKE TEST
PASS/FAIL/BLOCKED

CI
PASS/FAIL/BLOCKED

REAL BUGS
- ...

STALE TESTS / NON-BUG FAILURES
- ...

ENVIRONMENT BLOCKERS
- ...

FINAL CLASSIFICATION
TEST-SIGNED RELEASE CANDIDATE
یا
PRODUCTION RELEASE CANDIDATE
```

**Production Ready را فقط زمانی استفاده کن که تمام gateهای قابل‌اجرا PASS باشند و signing و infrastructure واقعاً production باشند.**
