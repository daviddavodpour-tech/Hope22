import test from 'node:test';
import assert from 'node:assert/strict';
import { requestId, recordRequest, metricsSnapshot, recordOutboxProcessed, recordOutboxFailed } from '../src/observability.js';

test('request ids reject unbounded or unsafe caller-controlled values', () => {
  assert.match(requestId({ headers: { 'x-request-id': 'mobile-42_ok' } }), /^mobile-42_ok$/);
  const generated = requestId({ headers: { 'x-request-id': 'x'.repeat(129) } });
  assert.doesNotMatch(generated, /^x+$/);
});

test('metrics expose latency and outbox counters', () => {
  const before = metricsSnapshot();
  recordRequest(200, 12.5);
  recordRequest(503, 30);
  recordOutboxProcessed();
  recordOutboxFailed();
  const after = metricsSnapshot();
  assert.equal(after.requests, before.requests + 2);
  assert.ok(after.requestDurationMsAvg > 0);
  assert.ok(after.requestDurationMsMax >= 30);
  assert.equal(after.outboxProcessed, before.outboxProcessed + 1);
  assert.equal(after.outboxFailed, before.outboxFailed + 1);
});
