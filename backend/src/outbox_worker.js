import { config } from './config.js';
import { claimOutboxEvent, completePaymentCreateHoldOutbox, completePaymentReleaseOutbox, failOutboxEvent } from './repository.js';
import { paymentProvider } from './payment_provider.js';
import { logEvent, recordOutboxFailed, recordOutboxProcessed } from './observability.js';

let stopped = false;
let timer = null;
let busy = false;

async function processOne() {
  if (busy || stopped) return false;
  busy = true;
  try {
    const event = await claimOutboxEvent(config.outboxLeaseSeconds);
    if (!event) return false;
    try {
      const payload = event.payload || {};
      if (event.event_type === 'PAYMENT_CREATE_HOLD') {
        const result = await paymentProvider.createHold({ paymentId: payload.paymentId, amount: payload.amount, currency: payload.currency, idempotencyKey: payload.idempotencyKey });
        if (result.status !== 'HELD' || !result.providerRef) throw new Error('PAYMENT_PROVIDER_UNCONFIRMED');
        const completed = await completePaymentCreateHoldOutbox({ eventId:event.id, jobId:payload.jobId, paymentId:payload.paymentId, providerRef:result.providerRef, actorId:payload.ownerId });
        if (!completed?.completed) throw new Error(`OUTBOX_CREATE_HOLD_COMMIT_FAILED:${completed?.reason || 'UNKNOWN'}`);
        recordOutboxProcessed();
        logEvent({ level:'info', action:'OUTBOX_PROCESSED', eventId:event.id, eventType:event.event_type });
      } else if (event.event_type === 'PAYMENT_RELEASE') {
        const result = await paymentProvider.releaseHold({ paymentId: payload.paymentId, providerRef: payload.providerRef, idempotencyKey: payload.idempotencyKey || `payment-release:${payload.paymentId}` });
        if (result.status !== 'RELEASED') throw new Error('PAYMENT_PROVIDER_UNCONFIRMED');
        const completed = await completePaymentReleaseOutbox({ eventId:event.id, jobId:payload.jobId, paymentId:payload.paymentId, actorId:payload.ownerId });
        if (!completed?.completed) throw new Error(`OUTBOX_RELEASE_COMMIT_FAILED:${completed?.reason || 'UNKNOWN'}`);
        recordOutboxProcessed();
        logEvent({ level:'info', action:'OUTBOX_PROCESSED', eventId:event.id, eventType:event.event_type });
      } else {
        throw new Error(`UNSUPPORTED_OUTBOX_EVENT:${event.event_type}`);
      }
    } catch (error) {
      recordOutboxFailed();
      logEvent({ level:'warn', action:'OUTBOX_FAILED', eventId:event.id, eventType:event.event_type, error:error?.message || String(error) });
      await failOutboxEvent({ eventId:event.id, error:error.message || error, maxAttempts:config.outboxMaxAttempts });
    }
    return true;
  } finally {
    busy = false;
  }
}

export function startOutboxWorker() {
  if (!process.env.DATABASE_URL) return { stop() {} };
  stopped = false;
  const tick = async () => {
    if (stopped) return;
    try { await processOne(); } catch (error) { console.error('[outbox] worker error:', error.message); }
    timer = setTimeout(tick, config.outboxPollMs);
    timer.unref?.();
  };
  timer = setTimeout(tick, 0);
  timer.unref?.();
  return { stop() { stopped = true; if (timer) clearTimeout(timer); } };
}

export async function processPaymentReleaseNow() {
  return processOne();
}

export async function processPaymentCreateHoldNow() {
  return processOne();
}
