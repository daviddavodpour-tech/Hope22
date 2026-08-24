import crypto from 'node:crypto';
import { config } from './config.js';
const metrics = { requests: 0, errors4xx: 0, errors5xx: 0, authRateLimited: 0, requestDurationMsTotal: 0, requestDurationMsMax: 0, requestDurationBuckets: { lt50:0, lt100:0, lt250:0, lt500:0, gte500:0 }, routeStats: new Map(), outboxProcessed: 0, outboxFailed: 0, startedAt: Date.now() };
const authWindows = new Map();
const requestWindows = new Map();
function clientKey(req) {
  if (config.trustProxy) {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (forwarded) return forwarded;
  }
  return req.socket.remoteAddress || 'unknown';
}
function consume(windowMap, req, limit, windowMs) {
  const key = clientKey(req);
  const now = Date.now();
  const current = windowMap.get(key) || { startedAt: now, count: 0 };
  if (now - current.startedAt >= windowMs) { current.startedAt = now; current.count = 0; }
  current.count += 1;
  windowMap.set(key, current);
  if (windowMap.size > 10000) {
    for (const [k, v] of windowMap) if (now - v.startedAt >= windowMs) windowMap.delete(k);
  }
  return current.count <= limit;
}
export function requestId(req) {
  const incoming = String(req.headers['x-request-id'] || '').trim();
  return /^[A-Za-z0-9._:-]{1,128}$/.test(incoming) ? incoming : crypto.randomUUID();
}
export function recordRequest(status, durationMs = 0, route = 'unknown') {
  metrics.requests += 1;
  if (status >= 400 && status < 500) metrics.errors4xx += 1;
  if (status >= 500) metrics.errors5xx += 1;
  const duration = Math.max(0, Number(durationMs) || 0);
  metrics.requestDurationMsTotal += duration;
  metrics.requestDurationMsMax = Math.max(metrics.requestDurationMsMax, duration);
  if (duration < 50) metrics.requestDurationBuckets.lt50 += 1;
  else if (duration < 100) metrics.requestDurationBuckets.lt100 += 1;
  else if (duration < 250) metrics.requestDurationBuckets.lt250 += 1;
  else if (duration < 500) metrics.requestDurationBuckets.lt500 += 1;
  else metrics.requestDurationBuckets.gte500 += 1;
  const current = metrics.routeStats.get(route) || {requests:0,errors:0,totalMs:0,maxMs:0};
  current.requests += 1; current.errors += status >= 400 ? 1 : 0; current.totalMs += duration; current.maxMs = Math.max(current.maxMs, duration);
  metrics.routeStats.set(route, current);
}
export function rateLimitAuth(req, limit, windowMs) {
  const ok = consume(authWindows, req, limit, windowMs);
  if (!ok) metrics.authRateLimited += 1;
  return ok;
}
export function rateLimitGeneral(req, limit, windowMs) {
  return consume(requestWindows, req, limit, windowMs);
}
export function recordOutboxProcessed() { metrics.outboxProcessed += 1; }
export function recordOutboxFailed() { metrics.outboxFailed += 1; }
export function metricsSnapshot() {
  const uptimeSeconds = Math.floor((Date.now() - metrics.startedAt) / 1000);
  const routes = Object.fromEntries([...metrics.routeStats.entries()].sort((a,b)=>b[1].requests-a[1].requests).slice(0,100).map(([route,v])=>[route,{...v,avgMs:v.requests?Number((v.totalMs/v.requests).toFixed(2)):0}]));
  const {routeStats, ...scalar} = metrics;
  return { ...scalar, routes, requestDurationMsAvg: metrics.requests ? Number((metrics.requestDurationMsTotal / metrics.requests).toFixed(2)) : 0 };
}
export function logEvent(event) { process.stdout.write(JSON.stringify({ time: new Date().toISOString(), ...event }) + '\n'); }
