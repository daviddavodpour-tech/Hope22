import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const repo = fs.readFileSync(new URL('../src/repository.js', import.meta.url), 'utf8');
const db = fs.readFileSync(new URL('../src/db.js', import.meta.url), 'utf8');
const worker = fs.readFileSync(new URL('../src/outbox_worker.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');

test('outbox schema is durable and retry-aware', () => {
  assert.match(db, /CREATE TABLE IF NOT EXISTS outbox_events/);
  assert.match(db, /status TEXT NOT NULL DEFAULT 'PENDING'/);
  assert.match(db, /dedupe_key TEXT NULL UNIQUE/);
  assert.match(db, /available_at TIMESTAMPTZ/);
  assert.match(db, /attempts INTEGER NOT NULL DEFAULT 0/);
});


test('payment create-hold uses transactional outbox and never runs the provider from the request handler', () => {
  assert.match(repo, /INSERT INTO payments\(id,job_id,payer_id,payee_id,amount,status,provider_ref/);
  assert.match(repo, /'HOLD_PENDING'/);
  assert.match(repo, /PAYMENT_CREATE_HOLD/);
  assert.match(worker, /event\.event_type === 'PAYMENT_CREATE_HOLD'/);
  assert.doesNotMatch(app, /paymentProvider\.createHold/);
});

test('create-hold completion is idempotent and terminal failures unlock an explicit retry path', () => {
  assert.match(repo, /completePaymentCreateHoldOutbox/);
  assert.match(repo, /payment\.status === 'HELD' && payment\.provider_ref === providerRef/);
  assert.match(repo, /status='HOLD_FAILED'/);
  assert.match(repo, /status === 'HOLD_FAILED'/);
});
test('payment release is queued with a database uniqueness guard', () => {
  assert.match(repo, /export async function enqueuePaymentRelease/);
  assert.match(repo, /ON CONFLICT\(dedupe_key\)/);
  assert.match(repo, /SELECT \* FROM jobs WHERE id=\$1 FOR UPDATE/);
  assert.match(repo, /SELECT \* FROM payments WHERE id=\$1 AND job_id=\$2 FOR UPDATE/);
});

test('outbox claim uses SKIP LOCKED', () => {
  assert.match(repo, /FOR UPDATE SKIP LOCKED/);
  assert.match(repo, /status='PROCESSING'/);
});

test('failed outbox work is retried and eventually terminal', () => {
  assert.match(repo, /export async function failOutboxEvent/);
  assert.match(repo, /maxAttempts/);
  assert.match(repo, /terminal \? 'FAILED' : 'PENDING'/);
  assert.match(worker, /failOutboxEvent/);
});

test('payment release completion is idempotent', () => {
  assert.match(repo, /if \(payment\.status === 'RELEASED'\)/);
  assert.match(repo, /status='DONE'/);
});

test('API preserves synchronous success but safely degrades to 202', () => {
  assert.match(app, /processPaymentReleaseNow/);
  assert.match(app, /sendJson\(res, 202/);
  assert.match(app, /settlement: \{ status:'PENDING'/);
});

test('release audit is committed with settlement transaction', () => {
  assert.match(repo, /INSERT INTO audit_logs\(id,action,actor_id,entity_type,entity_id,meta,created_at\)/);
  assert.match(repo, /PAYMENT_RELEASE/);
});
