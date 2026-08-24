import crypto from 'node:crypto';

/**
 * Payment provider boundary. The simulator is intentionally explicit and
 * never pretends to be a real PSP. A real adapter can implement the same
 * interface without changing marketplace state-machine code.
 */
export function createPaymentProvider(name = process.env.PAYMENT_PROVIDER || 'simulator') {
  if (name !== 'simulator') throw new Error(`Unsupported PAYMENT_PROVIDER: ${name}`);
  const released = new Set();
  return {
    name,
    async createHold({ paymentId, amount, currency = 'USD', idempotencyKey }) {
      // The simulator models PSP idempotency: the provider reference is a
      // deterministic function of the payment identity, so worker retries
      // never create a second hold. A real adapter must honor the same contract.
      const stableKey = String(idempotencyKey || paymentId);
      const digest = crypto.createHash('sha256').update(stableKey).digest('hex').slice(0, 16);
      return { provider: name, providerRef: `SIM-${paymentId}-${digest}`, status: 'HELD', amount, currency, idempotent: Boolean(idempotencyKey) };
    },
    async releaseHold({ paymentId, providerRef, idempotencyKey }) {
      const stableKey = String(idempotencyKey || paymentId || providerRef);
      const digest = crypto.createHash('sha256').update(stableKey).digest('hex').slice(0, 16);
      const releaseRef = `SIM-REL-${providerRef}-${digest}`;
      const alreadyReleased = released.has(releaseRef);
      released.add(releaseRef);
      return { provider: name, providerRef, status: 'RELEASED', idempotent: alreadyReleased, releaseRef };
    },
  };
}

export const paymentProvider = createPaymentProvider();
