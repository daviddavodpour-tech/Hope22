export const JOB_STATES = Object.freeze({
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  ASSIGNED: 'ASSIGNED',
  FUNDED: 'FUNDED',
  IN_PROGRESS: 'IN_PROGRESS',
  DELIVERED: 'DELIVERED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  COMPLETED: 'COMPLETED',
  SETTLED: 'SETTLED',
});

const transitions = new Map([
  ['DRAFT', new Set(['PUBLISHED'])],
  ['PUBLISHED', new Set(['ASSIGNED', 'FUNDED'])],
  ['ASSIGNED', new Set(['FUNDED'])],
  ['FUNDED', new Set(['IN_PROGRESS'])],
  ['IN_PROGRESS', new Set(['DELIVERED'])],
  ['DELIVERED', new Set(['COMPLETED', 'UNDER_REVIEW'])],
  ['UNDER_REVIEW', new Set(['COMPLETED'])],
  ['COMPLETED', new Set(['SETTLED'])],
  ['SETTLED', new Set([])],
]);

export function canTransition(from, to) {
  return transitions.get(from)?.has(to) ?? false;
}

export function assertTransition(from, allowedTargets) {
  const targets = Array.isArray(allowedTargets) ? allowedTargets : [allowedTargets];
  if (!targets.some((target) => canTransition(from, target))) {
    const error = new Error(`Invalid job state transition from ${from} to ${targets.join(', ')}`);
    error.code = 'INVALID_JOB_STATE';
    error.status = 409;
    throw error;
  }
  return true;
}
