import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const repo = fs.readFileSync(new URL('../src/repository.js', import.meta.url), 'utf8');
const db = fs.readFileSync(new URL('../src/db.js', import.meta.url), 'utf8');

test('direct upload completion is bound to a per-user, expiring upload intent', () => {
  assert.match(app, /intentDraft=\{[\s\S]*uploadedBy:user\.id/);
  assert.match(app, /process\.env\.DATABASE_URL \? await repo\.createUploadIntent/);
  assert.match(app, /intent\.uploadedBy!==user\.id/);
  assert.match(app, /intent\.contentType!==contentType/);
  assert.match(app, /intent\.expiresAt.*Date\.now/);
  assert.match(repo, /SELECT \* FROM upload_intents WHERE id=\$1 AND storage_key=\$2 FOR UPDATE/);
  assert.match(repo, /DELETE FROM upload_intents WHERE id=\$1/);
  assert.match(db, /CREATE TABLE IF NOT EXISTS upload_intents/);
  assert.match(db, /upload_intents_user_idx/);
});
