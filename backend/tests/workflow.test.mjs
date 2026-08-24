import assert from 'node:assert/strict';
import test from 'node:test';
import { canTransition, assertTransition } from '../src/workflow.js';

test('job lifecycle accepts supported forward transitions', () => {
  const allowed = [
    ['DRAFT', 'PUBLISHED'], ['PUBLISHED', 'ASSIGNED'], ['ASSIGNED', 'FUNDED'],
    ['FUNDED', 'IN_PROGRESS'], ['IN_PROGRESS', 'DELIVERED'], ['DELIVERED', 'COMPLETED'],
    ['DELIVERED', 'UNDER_REVIEW'], ['UNDER_REVIEW', 'COMPLETED'], ['COMPLETED', 'SETTLED'],
  ];
  for (const [from, to] of allowed) assert.equal(canTransition(from, to), true, `${from} -> ${to}`);
});

test('job lifecycle rejects regressions', () => {
  for (const [from, to] of [['SETTLED', 'IN_PROGRESS'], ['PUBLISHED', 'DRAFT'], ['COMPLETED', 'FUNDED']]) {
    assert.equal(canTransition(from, to), false, `${from} -> ${to}`);
    assert.throws(() => assertTransition(from, to), /Invalid job state transition/);
  }
});
