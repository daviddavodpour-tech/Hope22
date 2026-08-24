import assert from 'node:assert/strict';
import test from 'node:test';
import { signAccessToken, verifyAccessToken } from '../src/security.js';

test('JWT accepts valid claims and rejects issuer/audience mismatch', () => {
  const token = signAccessToken({sub:'user-1', role:'USER', sv:0}, 'secret', 60, {issuer:'hope', audience:'mobile'});
  const payload = verifyAccessToken(token, 'secret', {issuer:'hope', audience:'mobile'});
  assert.equal(payload.sub, 'user-1');
  assert.equal(payload.jti.length > 0, true);
  assert.throws(() => verifyAccessToken(token, 'secret', {issuer:'other', audience:'mobile'}), /claims invalid/);
  assert.throws(() => verifyAccessToken(token, 'secret', {issuer:'hope', audience:'other'}), /claims invalid/);
});

test('JWT rejects tampering and oversized input', () => {
  const token = signAccessToken({sub:'user-1', role:'USER', sv:0}, 'secret', 60);
  const tampered = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`;
  assert.throws(() => verifyAccessToken(tampered, 'secret'), /signature/);
  assert.throws(() => verifyAccessToken('x'.repeat(9000), 'secret'), /Invalid token/);
});
