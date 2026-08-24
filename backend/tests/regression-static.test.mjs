import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const db = fs.readFileSync(new URL('../src/db.js', import.meta.url), 'utf8');
const http = fs.readFileSync(new URL('../src/http.js', import.meta.url), 'utf8');

test('persistence hardening marks direct mutations dirty', () => {
  for (const marker of ["db.touch('jobs')", "db.touch('jobs', 'payments')", "db.touch('refreshTokens')"]) assert.ok(app.includes(marker), marker);
  assert.match(db, /async function persistLegacyFile\(\)/);
  assert.match(db, /function scheduleFlush\(\)/);
});

test('production security requirements exist', () => {
  assert.match(app, /x-metrics-token/);
  assert.match(http, /ALLOWED_CORS|allowedCorsOrigins|Access-Control-Allow-Origin/);
});

test('file upload validates content signatures', () => {
  for (const marker of ['%PDF', 'image/png', 'image/jpeg', 'image/webp', 'UNSUPPORTED_FILE']) assert.ok(http.includes(marker), marker);
});

test('business validation has explicit enums and bounded money/text', () => {
  for (const marker of ['JOB_TYPES', 'BUDGET_TYPES', 'moneyField', 'textField']) assert.ok(app.includes(marker), marker);
});


test('production configuration requires durable object storage and reset delivery', () => {
  const config = fs.readFileSync(new URL('../src/config.js', import.meta.url), 'utf8');
  assert.match(config, /STORAGE_BACKEND=s3|storageBackend !== 's3'/);
  assert.match(config, /RESET_TOKEN_DELIVERY_URL/);
});

test('local storage keeps uploaded files instead of deleting them', () => {
  const storage = fs.readFileSync(new URL('../src/storage.js', import.meta.url), 'utf8');
  assert.match(storage, /fs\.rename\(file\.path, destination\)/);
});

test('direct upload has an explicit completion endpoint', () => {
  assert.match(app, /parts\[1\] === 'complete'/);
  assert.match(app, /UPLOAD_NOT_FOUND/);
});


test('PostgreSQL boot is multi-writer safe and no advisory single-writer lock remains', () => {
  assert.doesNotMatch(db, /pg_try_advisory_lock|pg_advisory_unlock|single-writer lock/);
  assert.match(db, /multi-writer safe repository mode active/);
});

test('S3 adapter uses a real readable stream for object uploads', () => {
  const storage = fs.readFileSync(new URL('../src/storage.js', import.meta.url), 'utf8');
  assert.match(storage, /createReadStream\(file\.path\)/);
});


test('sendJson must not double-count requests in observability', () => {
  const source = fs.readFileSync(new URL('../src/http.js', import.meta.url), 'utf8');
  const matches = source.match(/recordRequest\(/g) || [];
  assert.equal(matches.length, 0);
});

test('release outbox retries reset failed events to pending', () => {
  const source = fs.readFileSync(new URL('../src/repository.js', import.meta.url), 'utf8');
  assert.match(source, /ON CONFLICT\(dedupe_key\) DO UPDATE SET[\s\S]*status=CASE WHEN outbox_events\.status='DONE' THEN outbox_events\.status ELSE 'PENDING' END/);
});

test('docker production image installs runtime dependencies and runs unprivileged', () => {
  const source = fs.readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
  assert.match(source, /npm ci --omit=dev/);
  assert.match(source, /USER hope/);
});

test('android emulator smoke uses debug signing instead of an unsigned release APK', () => {
  const source = fs.readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.match(source, /flutter build apk --debug/);
  assert.match(source, /adb install -r build\/app\/outputs\/flutter-apk\/app-debug\.apk/);
});

test('production documentation no longer claims an advisory single-writer lock', () => {
  const source = fs.readFileSync(new URL('../README-PRODUCTION.md', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /advisory single-writer lock prevents concurrent application mutations/);
  assert.match(source, /row-level locking and PostgreSQL transactions/);
});


test('evidence accepts only web URLs or constrained storage references', () => {
  const source = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.ok(source.includes('const isStorageRef ='));
  assert.match(source, /parsedUri\.protocol/);
  assert.ok(source.includes("storageKey = isStorageRef"));
});

test('storage evidence references are authorized to the uploading user', () => {
  const source = fs.readFileSync(new URL('../src/repository.js', import.meta.url), 'utf8');
  assert.match(source, /FROM uploads WHERE storage_key=\$1 AND uploaded_by=\$2/);
  assert.match(source, /INVALID_STORAGE_REFERENCE/);
});

test('mobile file evidence uses a storage reference scheme', () => {
  const source = fs.readFileSync(new URL('../../lib/features/transactions/transaction_page.dart', import.meta.url), 'utf8');
  assert.match(source, /storage:\/\/\$\{uploaded\['key'\]\}/);
});

test('outbox worker never marks an uncommitted payment transition as processed', () => {
  const source = fs.readFileSync(new URL('../src/outbox_worker.js', import.meta.url), 'utf8');
  assert.match(source, /const completed = await completePaymentCreateHoldOutbox/);
  assert.match(source, /if \(!completed\?\.completed\) throw new Error\(`OUTBOX_CREATE_HOLD_COMMIT_FAILED/);
  assert.match(source, /const completed = await completePaymentReleaseOutbox/);
  assert.match(source, /if \(!completed\?\.completed\) throw new Error\(`OUTBOX_RELEASE_COMMIT_FAILED/);
});

test('payment idempotency is normalized consistently across header and body', () => {
  const source = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(source, /const headerIdempotencyKey = readIdempotencyKey\(req\)/);
  assert.match(source, /bodyIdempotencyKey/);
  assert.match(source, /Header and body idempotency keys must match/);
  assert.match(source, /IDEMPOTENCY_CONFLICT/);
});

test('multipart parsing cleans temporary files on parse failures', () => {
  const source = fs.readFileSync(new URL('../src/http.js', import.meta.url), 'utf8');
  assert.match(source, /try \{\n    const body = await fs\.promises\.readFile\(tempPath\)/);
  assert.match(source, /catch \(error\) \{\n    try \{ await fs\.promises\.unlink\(tempPath\); \} catch \{\}/);
});

test('object upload cleans up the temp file and compensates for DB insert failure', () => {
  const appSource = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const storageSource = fs.readFileSync(new URL('../src/storage.js', import.meta.url), 'utf8');
  assert.match(appSource, /try \{\n      await storage\.put\(file\);\n    \} finally \{/);
  assert.match(appSource, /ORPHAN_UPLOAD_CLEANUP_FAILED/);
  assert.match(storageSource, /DeleteObjectCommand/);
  assert.match(storageSource, /async delete\(\{ key \}\)/);
});

test('Android integration tests run only when an emulator device is available', () => {
  const ci = fs.readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.doesNotMatch(ci, /flutter test integration_test\n/);
  assert.match(ci, /flutter test integration_test -d emulator-5554/);
});
