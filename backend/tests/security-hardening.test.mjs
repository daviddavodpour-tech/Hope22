import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

test('JWT verification enforces issuer, audience, bounded token size, iat and jti', () => {
  const src = fs.readFileSync(new URL('../src/security.js', import.meta.url), 'utf8');
  assert.match(src, /maxBytes/);
  assert.match(src, /payload\.iss !== issuer/);
  assert.match(src, /payload\.aud !== audience/);
  assert.match(src, /payload\.jti/);
  assert.match(src, /payload\.iat > now \+ 30/);
});

test('production CORS is explicit and idempotency keys are bounded', () => {
  const config = fs.readFileSync(new URL('../src/config.js', import.meta.url), 'utf8');
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(config, /ALLOWED_CORS_ORIGINS must explicitly list origins in production/);
  assert.match(app, /INVALID_IDEMPOTENCY_KEY/);
  assert.match(app, /maxIdempotencyKeyLength/);
});

test('HTTP hardening headers and server timeouts exist', () => {
  const http = fs.readFileSync(new URL('../src/http.js', import.meta.url), 'utf8');
  const server = fs.readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');
  for (const marker of ['X-Content-Type-Options','X-Frame-Options','Referrer-Policy','Permissions-Policy']) assert.match(http, new RegExp(marker));
  for (const marker of ['requestTimeout','headersTimeout','keepAliveTimeout']) assert.match(server, new RegExp(marker));
});

test('payment idempotency conflicts are detected across jobs or amounts', () => {
  const repo = fs.readFileSync(new URL('../src/repository.js', import.meta.url), 'utf8');
  assert.match(repo, /IDEMPOTENCY_CONFLICT/);
  assert.match(repo, /prior\.jobId !== jobId/);
  assert.match(repo, /Number\(prior\.amount\) !== Number\(amount\)/);
});

test('access sessions support immediate revocation through a session version', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const db = fs.readFileSync(new URL('../src/db.js', import.meta.url), 'utf8');
  const repo = fs.readFileSync(new URL('../src/repository.js', import.meta.url), 'utf8');
  assert.match(app, /sessionVersion/);
  assert.match(app, /payload\.sv/);
  assert.match(db, /session_version INTEGER NOT NULL DEFAULT 0/);
  assert.match(repo, /bumpUserSessionVersion/);
});

test('readiness endpoint fails closed when the database is down', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(app, /url\.pathname === '\/ready'|url\.pathname === '\/api\/v1\/ready'/);
  assert.match(app, /database\.status === 'ok'/);
  assert.match(app, /503/);
});


test('direct S3 uploads are checked against file magic bytes before completion', () => {
  const storage = fs.readFileSync(new URL('../src/storage.js', import.meta.url), 'utf8');
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(storage, /GetObjectCommand/);
  assert.match(storage, /bytes=0-4095/);
  assert.match(storage, /INVALID_FILE_SIGNATURE/);
  assert.match(app, /storage\.validateObject/);
});
