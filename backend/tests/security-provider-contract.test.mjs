import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../src/outbox_worker.js',import.meta.url),'utf8');
const provider=fs.readFileSync(new URL('../src/payment_provider.js',import.meta.url),'utf8');
const config=fs.readFileSync(new URL('../src/config.js',import.meta.url),'utf8');

 test('payment state machine uses an explicit provider boundary',()=>{
  assert.match(worker,/paymentProvider\.createHold/);
  assert.match(provider,/createHold/);
  assert.match(provider,/releaseHold/);
  assert.match(config,/PAYMENT_CURRENCY/);
 });
 test('security-sensitive endpoints stay fail-closed',()=>{
  assert.match(app,/REFRESH_REUSE_DETECTED/);
  assert.match(app,/RESET_DELIVERY_UNAVAILABLE/);
  assert.match(app,/UPLOAD_INTENT_REQUIRED/);
  assert.match(app,/CONTENT_TYPE_MISMATCH/);
  assert.match(app,/x-metrics-token/);
 });
