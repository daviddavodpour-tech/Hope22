import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const dbText = fs.readFileSync(new URL('../src/db.js', import.meta.url), 'utf8');
test('relational schema declares real tables and foreign keys', () => {
  for (const table of ['users','providers','refresh_tokens','reset_tokens','categories','jobs','offers','payments','evidence','uploads','audit_logs']) assert.match(dbText, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  assert.match(dbText, /REFERENCES users\(id\)/);
  assert.match(dbText, /REFERENCES jobs\(id\)/);
  assert.match(dbText, /payments_idempotency_uq/);
  assert.match(dbText, /id UUID PRIMARY KEY,[^;]+job_id UUID NOT NULL UNIQUE REFERENCES jobs\(id\)/s);
});
test('workflow mutation endpoints use transaction helper', () => {
  const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.ok((app.match(/withTransaction\(/g) || []).length >= 4);
});
