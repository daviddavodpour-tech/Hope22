import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const repo = fs.readFileSync(new URL('../src/repository.js', import.meta.url), 'utf8');

test('critical repository mutations use PostgreSQL transactions and row locks', () => {
  assert.match(repo, /export async function acceptOffer[\s\S]*SELECT \* FROM jobs WHERE id=\$1 FOR UPDATE/);
  assert.match(repo, /export async function fundJobAtomic[\s\S]*SELECT \* FROM jobs WHERE id=\$1 FOR UPDATE/);
  assert.match(repo, /fundJobAtomic[\s\S]*UPDATE offers SET status='ACCEPTED'/);
  assert.match(repo, /export async function releasePaymentAtomic[\s\S]*SELECT \* FROM jobs WHERE id=\$1 FOR UPDATE/);
  assert.match(repo, /ON CONFLICT|idempotency_key/);
});
