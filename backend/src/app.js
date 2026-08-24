import http from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { URL } from 'node:url';
import { config } from './config.js';
import { db, initDatabase, seedBaseData, databaseHealth, withTransaction } from './db.js';
import * as repo from './repository.js';
import { hashPassword, verifyPassword, randomToken, sha256, signAccessToken, verifyAccessToken } from './security.js';
import { HttpError, sendJson, sendError, setCors, readBody, readMultipartSingleFile } from './http.js';
import { requestId, recordRequest, rateLimitAuth, rateLimitGeneral, metricsSnapshot, logEvent } from './observability.js';
import { storage } from './storage.js';
import { processPaymentCreateHoldNow, processPaymentReleaseNow } from './outbox_worker.js';

await initDatabase();
seedBaseData();

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const now = () => new Date().toISOString();

async function deliverPasswordReset({ user, token }) {
  const mode = config.resetDeliveryMode;
  if (mode === 'console') {
    logEvent({ level:'info', action:'PASSWORD_RESET_DELIVERY', userId:user.id, delivery:'console', token });
    return;
  }
  if (mode === 'webhook') {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.resetDeliveryTimeoutMs);
    timeout.unref?.();
    try {
      const response = await fetch(config.resetDeliveryUrl, {
        method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({
          type:'password_reset', userId:user.id, email:user.email, token, expiresInSeconds:config.resetTokenTtlSeconds,
        }), signal:controller.signal,
      });
      if (!response.ok) throw new Error(`Reset delivery returned HTTP ${response.status}`);
      return;
    } finally { clearTimeout(timeout); }
  }
  throw new Error('Unsupported reset delivery mode');
}

const findUser = (id) => db.collection.users.find((u) => u.id === id);
async function getUserById(id) { return process.env.DATABASE_URL ? repo.findUserById(id) : findUser(id); }
async function getUserByEmail(email) { return process.env.DATABASE_URL ? repo.findUserByEmail(email) : db.collection.users.find((u) => u.email === email); }
async function getJob(id) { return process.env.DATABASE_URL ? repo.findJobById(id) : db.collection.jobs.find((j) => j.id === id); }
async function getProvider(userId) { return process.env.DATABASE_URL ? repo.findProviderByUserId(userId) : db.collection.providers.find((p) => p.userId === userId); }
const categoryBy = (id) => db.collection.categories.find((c) => c.id === id || c.slug === id);
const publicUser = (u) => ({ id: u.id, displayName: u.displayName, role: u.role });
const authUserView = (u) => ({ ...publicUser(u), email: u.email });
const categoryView = (id) => categoryBy(id)?.name || id || null;

function requireFields(body, names) {
  for (const name of names) {
    if (body?.[name] === undefined || body?.[name] === null || String(body[name]).trim() === '') {
      throw new HttpError(400, 'VALIDATION_ERROR', `${name} is required`);
    }
  }
}

const JOB_TYPES = new Set(['FIXED', 'HOURLY', 'TASK']);
const BUDGET_TYPES = new Set(['FIXED', 'RANGE']);
function textField(value, field, { min = 1, max = 5000, required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) throw new HttpError(400, 'VALIDATION_ERROR', `${field} is required`);
    return '';
  }
  const text = String(value).trim();
  if (required && !text) throw new HttpError(400, 'VALIDATION_ERROR', `${field} is required`);
  if (text && (text.length < min || text.length > max)) throw new HttpError(400, 'INVALID_FIELD', `${field} must be between ${min} and ${max} characters`);
  return text;
}
function moneyField(value, field) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) throw new HttpError(400, 'INVALID_AMOUNT', `${field} must be between 0 and 1000000000`);
  if (Math.round(amount * 100) !== amount * 100) throw new HttpError(400, 'INVALID_AMOUNT', `${field} must have at most 2 decimal places`);
  return amount;
}
function enumField(value, allowed, field) {
  const normalized = String(value || '').trim().toUpperCase();
  if (!allowed.has(normalized)) throw new HttpError(400, 'INVALID_FIELD', `${field} is invalid`);
  return normalized;
}

function readIdempotencyKey(req) {
  const raw = String(req.headers['idempotency-key'] || '').trim();
  if (!raw) return '';
  if (raw.length > config.maxIdempotencyKeyLength) throw new HttpError(400, 'INVALID_IDEMPOTENCY_KEY', 'Idempotency-Key is too long');
  if (!/^[A-Za-z0-9._~:-]+$/.test(raw)) throw new HttpError(400, 'INVALID_IDEMPOTENCY_KEY', 'Idempotency-Key contains unsupported characters');
  return raw;
}

async function authUser(req) {
  const raw = String(req.headers.authorization || '');
  if (!raw.startsWith('Bearer ')) throw new HttpError(401, 'UNAUTHORIZED', 'Authentication required');
  try {
    const payload = verifyAccessToken(raw.slice(7), config.accessSecret, { issuer: config.accessIssuer, audience: config.accessAudience });
    const user = await getUserById(payload.sub);
    if (!user || user.status !== 'ACTIVE') throw new Error('User not active');
    if (Number(payload.sv || 0) !== Number(user.sessionVersion || 0)) throw new Error('Session revoked');
    return user;
  } catch {
    throw new HttpError(401, 'UNAUTHORIZED', 'Authentication required');
  }
}

async function issueSession(user, familyId = db.id()) {
  const refresh = randomToken(48);
  const token = { id: db.id(), userId: user.id, tokenHash: sha256(refresh), familyId, expiresAt: new Date(Date.now() + config.refreshTtlSeconds * 1000).toISOString(), createdAt: now(), revokedAt: null, replacedBy: null };
  if (process.env.DATABASE_URL) await repo.insertRefreshToken(token); else db.insert('refreshTokens', token);
  return {
    accessToken: signAccessToken({ sub: user.id, role: user.role, sv: Number(user.sessionVersion || 0) }, config.accessSecret, config.accessTtlSeconds, { issuer: config.accessIssuer, audience: config.accessAudience }),
    refreshToken: refresh,
  };
}

// PERF: called per-job when rendering a list. Filtering the whole `offers`
// array inside jobView() for every job makes a listing O(jobs * offers).
// Callers that render a list build one Map<jobId, count> up front (one pass
// over offers) and pass it in; single-job call sites omit it and fall back
// to the old per-call scan, so behavior is unchanged either way.
function buildOfferCountMap() {
  const map = new Map();
  for (const offer of db.collection.offers) map.set(offer.jobId, (map.get(offer.jobId) || 0) + 1);
  return map;
}

function jobView(job, viewerId, offerCountByJob) {
  const owner = findUser(job.ownerId);
  const provider = job.providerId ? findUser(job.providerId) : null;
  const offerCount = offerCountByJob
    ? (offerCountByJob.get(job.id) || 0)
    : db.collection.offers.filter((o) => o.jobId === job.id).length;
  return {
    id: job.id, title: job.title, description: job.description, categoryId: job.categoryId,
    category: categoryView(job.categoryId), jobType: job.jobType, budgetType: job.budgetType,
    budgetMin: job.budgetMin, budgetMax: job.budgetMax, duration: job.duration,
    acceptanceCriteria: job.acceptanceCriteria, status: job.status, ownerId: job.ownerId,
    providerId: job.providerId, owner: owner ? publicUser(owner) : null,
    provider: provider ? publicUser(provider) : null, offerCount,
    city: job.city || null, createdAt: job.createdAt, updatedAt: job.updatedAt,
    isOwner: job.ownerId === viewerId,
  };
}

function paymentView(payment, job) {
  if (!payment) return { status: 'NO_TRANSACTION', paymentStatus: 'UNFUNDED', amount: null, providerRef: null, job: jobView(job, null) };
  return {
    id: payment.id, status: payment.status, paymentStatus: payment.status,
    amount: payment.amount, providerRef: payment.providerRef, job: jobView(job, null),
    createdAt: payment.createdAt, updatedAt: payment.updatedAt,
  };
}

function relatedJob(userId, job) {
  return job.ownerId === userId || job.providerId === userId;
}

function enforceJobState(job, expected) {
  // `expected` is the set of CURRENT statuses this action is allowed to run
  // from (a precondition check) -- it is not the transition target, so this
  // must be a membership check against job.status, not assertTransition()
  // (which answers a different question: "can X become Y", which is already
  // enforced separately wherever job.status is actually reassigned).
  if (!expected.includes(job.status)) {
    throw new HttpError(409, 'INVALID_STATE', `Job is ${job.status}; expected one of ${expected.join(', ')}`);
  }
}

async function createAudit(action, actorId, entityType, entityId, meta = {}) {
  const audit = { id: db.id(), action, actorId, entityType, entityId, meta, createdAt: now() };
  if (process.env.DATABASE_URL) return repo.insertAudit(audit);
  return db.insert('audit', audit);
}

export async function handle(req, res) {
  const startedAt = process.hrtime.bigint();
  const rid = requestId(req);
  res.setHeader('X-Request-Id', rid);
  setCors(res, req);
  const originalEnd = res.end.bind(res);
  let recorded = false;
  const finishRecord = (statusCode) => {
    if (recorded) return;
    recorded = true;
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    recordRequest(statusCode, durationMs, `${req.method} ${url.pathname}`);
  };
  res.end = ((chunk, encoding, callback) => {
    finishRecord(res.statusCode || 200);
    return originalEnd(chunk, encoding, callback);
  });
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/metrics') {
    if (config.metricsToken && req.headers['x-metrics-token'] !== config.metricsToken) {
      const metricsError = new HttpError(401, 'UNAUTHORIZED', 'Authentication required');
      return sendError(res, metricsError);
    }
    const body = JSON.stringify(metricsSnapshot());
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(body);
  }
  if (url.pathname.startsWith('/api/v1/auth/') && !rateLimitAuth(req, config.authRateLimitMax, config.rateLimitWindowMs)) {
    const body = JSON.stringify({ error: { code: 'RATE_LIMITED', message: 'Too many authentication requests' } });
    res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8', 'Retry-After': String(Math.ceil(config.rateLimitWindowMs / 1000)), 'Cache-Control': 'no-store' });
    return res.end(body);
  }
  if (!url.pathname.startsWith('/health') && !url.pathname.startsWith('/metrics') && !rateLimitGeneral(req, config.generalRateLimitMax, config.generalRateLimitWindowMs)) {
    res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8', 'Retry-After': String(Math.ceil(config.generalRateLimitWindowMs / 1000)), 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } }));
  }
  const parts = url.pathname.replace(/^\/api\/v1\/?/, '').split('/').filter(Boolean);
  try {
    if (url.pathname === '/health' || url.pathname === '/api/v1/health') {
      const database = await databaseHealth();
      const healthy = database.status === 'ok';
      return sendJson(res, healthy ? 200 : 503, { status: healthy ? 'ok' : 'degraded', service: 'hope-api', version: process.env.HOPE_VERSION || '3.5.0', database, time: now() });
    }
    if (url.pathname === '/ready' || url.pathname === '/api/v1/ready') {
      const database = await databaseHealth();
      const ready = database.status === 'ok';
      return sendJson(res, ready ? 200 : 503, { ready, service: 'hope-api', database, time: now() });
    }
    if (parts[0] === 'auth') return await authRoutes(req, res, parts);
    if (parts[0] === 'providers') return await providerRoutes(req, res, parts);
    if (parts[0] === 'jobs') return await jobRoutes(req, res, parts);
    if (parts[0] === 'offers') return await offerRoutes(req, res, parts);
    if (parts[0] === 'payments') return await paymentRoutes(req, res, parts);
    if (parts[0] === 'storage') return await storageRoutes(req, res, parts);
    if (parts[0] === 'categories') return await categoryRoutes(req, res, parts);
    throw new HttpError(404, 'NOT_FOUND', 'Route not found');
  } catch (error) {
    const status = error?.status || 500;
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    logEvent({ level: status >= 500 ? 'error' : 'warn', requestId: rid, method: req.method, path: url.pathname, status, durationMs: Number(durationMs.toFixed(2)), code: error?.code || 'INTERNAL_ERROR', message: error?.message || 'Internal server error' });
    sendError(res, error);
  } finally {
    try { await db.flush(); } catch (persistError) { console.error('[db] persistence flush failed:', persistError); }
  }
}

async function authRoutes(req, res, parts) {
  const route = parts.slice(1).join('/');
  if (req.method === 'POST' && route === 'register') {
    const body = await readBody(req);
    requireFields(body, ['email', 'password', 'displayName']);
    const email = String(body.email).trim().toLowerCase();
    if (email.length > 254 || !emailRe.test(email)) throw new HttpError(400, 'INVALID_EMAIL', 'Email is invalid');
    if (String(body.password).length < 8) throw new HttpError(400, 'WEAK_PASSWORD', 'Password must be at least 8 characters');
    if (await getUserByEmail(email)) throw new HttpError(409, 'EMAIL_IN_USE', 'An account with this email already exists');
    const userDraft = { id: db.id(), email, passwordHash: await hashPassword(String(body.password)), displayName: String(body.displayName).trim(), role: 'USER', status: 'ACTIVE', sessionVersion: 0, createdAt: now() };
    const providerDraft = { id: db.id(), userId: userDraft.id, providerType: 'INDIVIDUAL', capacity: 'OPEN', verificationStatus: 'UNVERIFIED', createdAt: now(), updatedAt: now() };
    let user;
    try {
      user = process.env.DATABASE_URL
          ? await repo.createUserWithProvider(userDraft, providerDraft)
          : db.insert('users', userDraft);
    } catch (error) {
      if (error?.code === '23505' || error?.constraint === 'users_email_key') {
        throw new HttpError(409, 'EMAIL_IN_USE', 'An account with this email already exists');
      }
      throw error;
    }
    if (!process.env.DATABASE_URL) db.insert('providers', providerDraft);
    else { db.collection.users.push(user); db.collection.providers.push(providerDraft); }
    const session = await issueSession(user);
    await createAudit('AUTH_REGISTER', user.id, 'user', user.id);
    return sendJson(res, 201, { ...session, user: authUserView(user) });
  }
  if (req.method === 'POST' && route === 'login') {
    const body = await readBody(req);
    requireFields(body, ['email', 'password']);
    const email = String(body.email).trim().toLowerCase();
    if (email.length > 254 || !emailRe.test(email)) throw new HttpError(400, 'INVALID_EMAIL', 'Email is invalid');
    const user = await getUserByEmail(email);
    if (!user || user.status !== 'ACTIVE' || !(await verifyPassword(String(body.password), user.passwordHash))) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
    const session = await issueSession(user);
    await createAudit('AUTH_LOGIN', user.id, 'user', user.id);
    return sendJson(res, 200, { ...session, user: authUserView(user) });
  }
  if (req.method === 'POST' && route === 'refresh') {
    const body = await readBody(req);
    requireFields(body, ['refreshToken']);
    const presentedHash = sha256(String(body.refreshToken));
    if (process.env.DATABASE_URL) {
      const refresh = randomToken(48);
      const nextToken = { id:db.id(), tokenHash:sha256(refresh), familyId:db.id(), expiresAt:new Date(Date.now()+config.refreshTtlSeconds*1000).toISOString(), createdAt:now() };
      const existing = await repo.findRefreshTokenByHash(presentedHash);
      if (!existing || new Date(existing.expiresAt).getTime() <= Date.now()) throw new HttpError(401,'INVALID_REFRESH_TOKEN','Refresh token is invalid or expired');
      nextToken.familyId = existing.familyId;
      const rotated = await repo.rotateRefreshToken(presentedHash,nextToken,existing.familyId);
      if (rotated.kind === 'reuse') throw new HttpError(401,'REFRESH_REUSE_DETECTED','Refresh token reuse detected; session family revoked');
      if (rotated.kind !== 'ok' || rotated.user.status !== 'ACTIVE') throw new HttpError(401,'INVALID_REFRESH_TOKEN','Refresh token is invalid');
      const issued = { accessToken:signAccessToken({sub:rotated.user.id,role:rotated.user.role,sv:Number(rotated.user.sessionVersion || 0)},config.accessSecret,config.accessTtlSeconds,{issuer:config.accessIssuer,audience:config.accessAudience}), refreshToken:refresh };
      return sendJson(res,200,{...issued,user:authUserView(rotated.user)});
    }
    const item = db.collection.refreshTokens.find((t) => t.tokenHash === presentedHash);
    if (!item || new Date(item.expiresAt).getTime() <= Date.now()) throw new HttpError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired');
    if (item.revokedAt) {
      for (const token of db.collection.refreshTokens.filter((t) => t.familyId === item.familyId && !t.revokedAt)) token.revokedAt = now();
      db.touch('refreshTokens'); await db.save();
      throw new HttpError(401, 'REFRESH_REUSE_DETECTED', 'Refresh token reuse detected; session family revoked');
    }
    const next = await withTransaction(async () => {
      const current = db.collection.refreshTokens.find((t) => t.id === item.id);
      if (!current || current.revokedAt) throw new HttpError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid');
      const user = findUser(current.userId);
      if (!user || user.status !== 'ACTIVE') throw new HttpError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid');
      const issued = await issueSession(user, current.familyId); current.revokedAt = now(); current.replacedBy = sha256(issued.refreshToken); db.touch('refreshTokens'); return { issued, user };
    });
    return sendJson(res, 200, { ...next.issued, user: authUserView(next.user) });
  }
  if (req.method === 'POST' && route === 'logout') {
    const user = await authUser(req);
    if (process.env.DATABASE_URL) { await repo.revokeUserRefreshTokens(user.id); await repo.bumpUserSessionVersion(user.id); }
    else { user.sessionVersion = Number(user.sessionVersion || 0) + 1; db.touch('users');  for (const token of db.collection.refreshTokens.filter((t) => t.userId === user.id && !t.revokedAt)) token.revokedAt = now(); db.touch('refreshTokens'); db.save(); }
    await createAudit('AUTH_LOGOUT', user.id, 'user', user.id);
    return sendJson(res, 200, { ok: true });
  }
  if (req.method === 'POST' && route === 'password-reset/confirm') {
    const body = await readBody(req);
    requireFields(body, ['token', 'password']);
    if (String(body.password).length < 8) throw new HttpError(400, 'WEAK_PASSWORD', 'Password must be at least 8 characters');
    if (process.env.DATABASE_URL) {
      const candidate = await repo.findResetTokenForUse(sha256(String(body.token)));
      if (!candidate || candidate.user.status !== 'ACTIVE') throw new HttpError(400,'INVALID_RESET_TOKEN','Reset token is invalid or expired');
      const ok = await repo.consumeResetTokenAndChangePassword(candidate.token.id,candidate.user.id,await hashPassword(String(body.password)));
      if (!ok) throw new HttpError(400,'INVALID_RESET_TOKEN','Reset token is invalid or already used');
      await repo.bumpUserSessionVersion(candidate.user.id);
      await createAudit('AUTH_PASSWORD_RESET', candidate.user.id, 'user', candidate.user.id);
      return sendJson(res,200,{ok:true});
    }
    const reset = db.collection.resetTokens.find((t) => t.tokenHash === sha256(String(body.token)) && !t.usedAt && new Date(t.expiresAt).getTime() > Date.now());
    if (!reset) throw new HttpError(400, 'INVALID_RESET_TOKEN', 'Reset token is invalid or expired');
    const user = findUser(reset.userId);
    if (!user || user.status !== 'ACTIVE') throw new HttpError(400, 'INVALID_RESET_TOKEN', 'Reset token is invalid');
    user.passwordHash = await hashPassword(String(body.password)); user.sessionVersion = Number(user.sessionVersion || 0) + 1; reset.usedAt = now();
    for (const token of db.collection.refreshTokens.filter((t) => t.userId === user.id && !t.revokedAt)) token.revokedAt = now();
    db.touch('users', 'refreshTokens', 'resetTokens'); db.save(); await createAudit('AUTH_PASSWORD_RESET', user.id, 'user', user.id);
    return sendJson(res, 200, { ok: true });
  }
  if (req.method === 'POST' && route === 'password-reset/request') {
    const body = await readBody(req);
    requireFields(body, ['email']);
    const user = await getUserByEmail(String(body.email).trim().toLowerCase());
    const generic = { ok: true, message: 'If the account exists, a reset request has been created.' };
    if (!user) return sendJson(res, 202, generic);
    const token = randomToken(32);
    const resetDraft = { id: db.id(), userId: user.id, tokenHash: sha256(token), familyId:db.id(), expiresAt: new Date(Date.now() + config.resetTokenTtlSeconds * 1000).toISOString(), usedAt: null, createdAt: now() };
    if (process.env.DATABASE_URL) await repo.insertResetToken(resetDraft); else db.insert('resetTokens', resetDraft);
    try {
      await deliverPasswordReset({ user, token });
    } catch (error) {
      if (!process.env.DATABASE_URL) { const created = db.collection.resetTokens.find((t) => t.tokenHash === sha256(token)); if (created) { created.usedAt = now(); db.touch('resetTokens'); } }
      logEvent({ level:'error', action:'PASSWORD_RESET_DELIVERY_FAILED', userId:user.id, message:error.message });
      throw new HttpError(503, 'RESET_DELIVERY_UNAVAILABLE', 'Password reset delivery is temporarily unavailable');
    }
    logEvent({ level: 'info', action: 'PASSWORD_RESET_REQUESTED', userId: user.id });
    return sendJson(res, 202, config.exposeResetTokenInDevelopment && process.env.NODE_ENV !== 'production' ? { ...generic, resetToken: token } : generic);
  }
  throw new HttpError(404, 'NOT_FOUND', 'Auth route not found');
}

async function providerRoutes(req, res, parts) {
  if (req.method !== 'GET' || parts[1] !== 'me') throw new HttpError(404, 'NOT_FOUND', 'Provider route not found');
  const user = await authUser(req);
  let provider = await getProvider(user.id);
  if (!provider) { const draft={ id: db.id(), userId: user.id, providerType:'INDIVIDUAL', capacity:'OPEN', verificationStatus:'UNVERIFIED', createdAt:now(), updatedAt:now() }; provider = process.env.DATABASE_URL ? await repo.upsertProvider(draft) : db.insert('providers', draft); }
  return sendJson(res, 200, { ...provider, user: publicUser(user) });
}

async function categoryRoutes(req, res) {
  if (req.method !== 'GET') throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  if (process.env.DATABASE_URL) return sendJson(res, 200, (await repo.listCategories()).map((c) => ({ id: c.id, slug: c.slug, name: c.name })));
  return sendJson(res, 200, db.collection.categories.map((c) => ({ id: c.id, slug: c.slug, name: c.name })));
}

async function jobRoutes(req, res, parts) {
  const user = req.headers.authorization ? await authUser(req) : null;
  if (req.method === 'GET' && parts.length === 1) {
    const status = new URL(req.url, `http://${req.headers.host || 'localhost'}`).searchParams.get('status') || 'PUBLISHED';
    if (status !== 'PUBLISHED' && !user) {
      throw new HttpError(401, 'UNAUTHORIZED', 'Authentication required to view private job states');
    }
    if (process.env.DATABASE_URL) {
      const rows = await repo.listJobViews({ status, userId: status === 'PUBLISHED' ? null : user?.id });
      return sendJson(res, 200, rows.map(({job,category,owner,provider,offerCount}) => ({
        ...jobView(job, user?.id, new Map([[job.id, offerCount]])), category, owner, provider, offerCount
      })));
    }
    const jobs = db.collection.jobs.filter((j) => {
      if (j.status !== status) return false;
      if (status === 'PUBLISHED') return true;
      return user?.id === j.ownerId || user?.id === j.providerId;
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const offerCountByJob = buildOfferCountMap();
    return sendJson(res, 200, jobs.map((j) => jobView(j, user?.id, offerCountByJob)));
  }
  if (req.method === 'POST' && parts.length === 1) {
    const me = await authUser(req);
    const body = await readBody(req);
    requireFields(body, ['title', 'description', 'categoryId', 'jobType', 'budgetType', 'budgetMin', 'budgetMax', 'duration', 'acceptanceCriteria']);
    const title = textField(body.title, 'title', { min: 2, max: 160, required: true });
    const description = textField(body.description, 'description', { min: 2, max: 8000, required: true });
    const acceptanceCriteria = textField(body.acceptanceCriteria, 'acceptanceCriteria', { min: 2, max: 5000, required: true });
    const jobType = enumField(body.jobType, JOB_TYPES, 'jobType');
    const budgetType = enumField(body.budgetType, BUDGET_TYPES, 'budgetType');
    const budgetMin = moneyField(body.budgetMin, 'budgetMin');
    const budgetMax = moneyField(body.budgetMax, 'budgetMax');
    const duration = Number(body.duration);
    if (!Number.isInteger(duration) || duration <= 0 || duration > 36500) throw new HttpError(400, 'INVALID_DURATION', 'Duration must be a positive integer within range');
    if (budgetMin > budgetMax) throw new HttpError(400, 'INVALID_BUDGET', 'Maximum budget must be greater than or equal to minimum budget');
    const categoryExists = process.env.DATABASE_URL ? await repo.findCategoryByIdOrSlug(String(body.categoryId)) : categoryBy(String(body.categoryId));
    if (!categoryExists) throw new HttpError(400, 'INVALID_CATEGORY', 'Category does not exist');
    const draft = {
      id: db.id(), ownerId: me.id, providerId: null, title, description,
      categoryId: String(body.categoryId), jobType, budgetType, budgetMin, budgetMax, duration,
      acceptanceCriteria, status: 'DRAFT', city: body.city ? textField(body.city, 'city', { min: 1, max: 120 }) : null,
      createdAt: now(), updatedAt: now(), publishedAt: null,
    };
    const created = process.env.DATABASE_URL ? await repo.insertJob(draft) : db.insert('jobs', draft);
    await createAudit('JOB_CREATE', me.id, 'job', created.id);
    return sendJson(res, 201, jobView(created, me.id));
  }
  if (req.method === 'GET' && parts[1] === 'mine') {
    const me = await authUser(req);
    if (process.env.DATABASE_URL) {
      const rows = await repo.listMyJobViews(me.id);
      return sendJson(res, 200, rows.map(({job,category,owner,provider,offerCount,payment}) => ({
        ...jobView(job, me.id, new Map([[job.id, offerCount]])), category, owner, provider, offerCount,
        transaction: payment ? paymentView(payment, job) : null,
      })));
    }
    const jobs = db.collection.jobs.filter((j) => relatedJob(me.id, j)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const offerCountByJob = buildOfferCountMap();
    return sendJson(res, 200, jobs.map((job) => {
      const payment = db.collection.payments.find((p) => p.jobId === job.id);
      return { ...jobView(job, me.id, offerCountByJob), transaction: payment ? paymentView(payment, job) : null };
    }));
  }
  if (parts.length < 2) throw new HttpError(404, 'NOT_FOUND', 'Job route not found');
  const jobId = parts[1];
  const job = await getJob(jobId);
  if (!job) throw new HttpError(404, 'JOB_NOT_FOUND', 'Job not found');
  if (req.method === 'GET' && parts.length === 2) {
    if (job.status !== 'PUBLISHED' && (!user || (job.ownerId !== user.id && job.providerId !== user.id))) {
      throw new HttpError(404, 'JOB_NOT_FOUND', 'Job not found');
    }
    return sendJson(res, 200, jobView(job, user?.id));
  }
  if (req.method === 'POST' && parts[2] === 'publish') {
    const me = await authUser(req);
    if (job.ownerId !== me.id) throw new HttpError(403, 'FORBIDDEN', 'Only the owner can publish this job');
    enforceJobState(job, ['DRAFT']);
    const updatedJob = process.env.DATABASE_URL ? await repo.updateJobSimple(job.id,['DRAFT'],{status:'PUBLISHED',publishedAt:now(),updatedAt:now()}) : (job.status='PUBLISHED',job.publishedAt=now(),job.updatedAt=now(),db.touch('jobs'),db.save(),job);
    await createAudit('JOB_PUBLISH', me.id, 'job', job.id); return sendJson(res, 200, jobView(updatedJob, me.id));
  }
  if (req.method === 'POST' && parts[2] === 'start') {
    const me = await authUser(req);
    if (job.providerId !== me.id) throw new HttpError(403, 'FORBIDDEN', 'Only the assigned provider can start this job');
    enforceJobState(job, ['FUNDED']);
    const payment = process.env.DATABASE_URL ? await repo.findPaymentByJob(job.id) : db.collection.payments.find((p) => p.jobId === job.id);
    if (!payment || payment.status !== 'HELD') throw new HttpError(409, 'PAYMENT_REQUIRED', 'Job must be funded before starting');
    const updatedJob = process.env.DATABASE_URL ? await repo.updateJobSimple(job.id,['FUNDED'],{status:'IN_PROGRESS',updatedAt:now()}) : (job.status='IN_PROGRESS',job.updatedAt=now(),db.touch('jobs'),db.save(),job);
    await createAudit('JOB_START', me.id, 'job', job.id); return sendJson(res, 200, jobView(updatedJob, me.id));
  }
  if (req.method === 'POST' && parts[2] === 'deliver') {
    const me = await authUser(req);
    if (job.providerId !== me.id) throw new HttpError(403, 'FORBIDDEN', 'Only the assigned provider can deliver');
    enforceJobState(job, ['IN_PROGRESS']);
    const updatedJob = process.env.DATABASE_URL ? await repo.updateJobSimple(job.id,['IN_PROGRESS'],{status:'DELIVERED',updatedAt:now()}) : (job.status='DELIVERED',job.updatedAt=now(),db.touch('jobs'),db.save(),job);
    await createAudit('JOB_DELIVER', me.id, 'job', job.id); return sendJson(res, 200, jobView(updatedJob, me.id));
  }
  if (req.method === 'POST' && parts[2] === 'accept') {
    const me = await authUser(req);
    if (job.ownerId !== me.id) throw new HttpError(403, 'FORBIDDEN', 'Only the owner can accept delivery');
    enforceJobState(job, ['DELIVERED', 'UNDER_REVIEW']);
    const payment = process.env.DATABASE_URL ? await repo.findPaymentByJob(job.id) : db.collection.payments.find((p) => p.jobId === job.id);
    if (!payment || payment.status !== 'HELD') throw new HttpError(409, 'PAYMENT_REQUIRED', 'Payment is not held');
    if (process.env.DATABASE_URL) { const result = await repo.transitionJobWithPayment(job.id,['DELIVERED','UNDER_REVIEW'],{status:'COMPLETED',updatedAt:now()},'HELD'); await createAudit('JOB_ACCEPT', me.id, 'job', job.id); return sendJson(res,200,jobView(result.job,me.id)); }
    job.status = 'COMPLETED'; job.updatedAt = now(); payment.status = 'RELEASE_PENDING'; payment.updatedAt = now(); db.touch('jobs', 'payments'); db.save(); await createAudit('JOB_ACCEPT', me.id, 'job', job.id); return sendJson(res, 200, jobView(job, me.id));
  }
  if (req.method === 'POST' && parts[2] === 'evidence') {
    const me = await authUser(req);
    if (job.providerId !== me.id) throw new HttpError(403, 'FORBIDDEN', 'Only the assigned provider can submit evidence');
    enforceJobState(job, ['IN_PROGRESS']);
    const body = await readBody(req);
    requireFields(body, ['uri']);
    let uri = String(body.uri).trim();
    const isStorageRef = /^storage:\/\/[A-Za-z0-9._~:/%-]+$/.test(uri);
    if (!isStorageRef) {
      let parsedUri; try { parsedUri = new URL(uri); } catch { throw new HttpError(400, 'INVALID_EVIDENCE_URI', 'Evidence URI is invalid'); }
      if (!['https:', 'http:'].includes(parsedUri.protocol)) throw new HttpError(400, 'INVALID_EVIDENCE_URI', 'Evidence URI must use HTTP or HTTPS');
    }
    if (uri.length > 2048) throw new HttpError(400, 'INVALID_EVIDENCE_URI', 'Evidence URI is too long');
    const notes = textField(body.notes, 'notes', { min: 0, max: 2000 });
    const type = textField(body.type || 'DELIVERY_LINK', 'type', { min: 2, max: 80, required: true });
    const storageKey = isStorageRef ? uri.slice('storage://'.length) : null;
    if (storageKey && (storageKey.includes('..') || storageKey.startsWith('/') || storageKey.includes('\\'))) {
      throw new HttpError(400, 'INVALID_EVIDENCE_URI', 'Storage reference is invalid');
    }
    const evidenceDraft = { id: db.id(), jobId: job.id, submittedBy: me.id, uri, storageKey, notes, type, createdAt: now() };
    let evidence;
    if (process.env.DATABASE_URL) {
      try {
        evidence = await repo.insertEvidenceAndTouchJob(evidenceDraft);
      } catch (error) {
        if (error?.code === 'INVALID_STORAGE_REFERENCE') throw new HttpError(403, 'INVALID_STORAGE_REFERENCE', 'Storage reference does not belong to this user');
        if (error?.code === 'INVALID_STATE') throw new HttpError(409, 'INVALID_STATE', 'Job is no longer accepting evidence');
        throw error;
      }
    } else {
      if (storageKey && !db.collection.uploads.some((u) => u.storageKey === storageKey && u.uploadedBy === me.id)) {
        throw new HttpError(403, 'INVALID_STORAGE_REFERENCE', 'Storage reference does not belong to this user');
      }
      evidence = db.insert('evidence', evidenceDraft); job.updatedAt=evidenceDraft.createdAt; db.touch('jobs'); await db.save();
    }
    if (!evidence) throw new HttpError(409, 'INVALID_STATE', 'Job is no longer accepting evidence');
    await createAudit('EVIDENCE_CREATE', me.id, 'evidence', evidence.id, { jobId: job.id }); return sendJson(res, 201, evidence);
  }
  if (req.method === 'GET' && parts[2] === 'offers') {
    const me = await authUser(req);
    if (job.ownerId !== me.id) throw new HttpError(403, 'FORBIDDEN', 'Only the owner can view offers');
    if (process.env.DATABASE_URL) return sendJson(res, 200, await repo.listOfferViewsForJob(job.id));
    const offers = db.collection.offers.filter((o) => o.jobId === job.id).map((o) => ({ ...o, provider: publicUser(findUser(o.providerId)) }));
    return sendJson(res, 200, offers);
  }
  throw new HttpError(404, 'NOT_FOUND', 'Job route not found');
}

async function offerRoutes(req, res, parts) {
  if (req.method === 'POST' && parts.length === 1) {
    const me = await authUser(req); const body = await readBody(req); requireFields(body, ['jobId', 'price']);
    const job = await getJob(String(body.jobId)); if (!job) throw new HttpError(404, 'JOB_NOT_FOUND', 'Job not found');
    if (job.ownerId === me.id) throw new HttpError(403, 'FORBIDDEN', 'Owners cannot submit offers to their own job');
    enforceJobState(job, ['PUBLISHED']);
    const price = moneyField(body.price, 'price');
    const message = body.message ? textField(body.message, 'message', { min: 1, max: 4000 }) : '';
    const existing = process.env.DATABASE_URL ? await repo.findPendingOffer(job.id,me.id) : db.collection.offers.find((o) => o.jobId === job.id && o.providerId === me.id && o.status === 'PENDING');
    if (existing) throw new HttpError(409, 'OFFER_EXISTS', 'You already have a pending offer for this job');
    const offerDraft = { id: db.id(), jobId: job.id, providerId: me.id, price, message, status: 'PENDING', createdAt: now(), updatedAt: now() };
    const offer = process.env.DATABASE_URL ? await repo.insertOffer(offerDraft) : db.insert('offers', offerDraft);
    await createAudit('OFFER_CREATE', me.id, 'offer', offer.id, { jobId: job.id }); return sendJson(res, 201, offer);
  }
  if (req.method === 'POST' && parts[2] === 'accept') {
    const me = await authUser(req); const offer = process.env.DATABASE_URL ? await repo.findOfferById(parts[1]) : db.collection.offers.find((o) => o.id === parts[1]); if (!offer) throw new HttpError(404, 'OFFER_NOT_FOUND', 'Offer not found');
    const job = await getJob(offer.jobId); if (!job || job.ownerId !== me.id) throw new HttpError(403, 'FORBIDDEN', 'Only the job owner can accept an offer');
    enforceJobState(job, ['PUBLISHED']);
    if (process.env.DATABASE_URL) {
      const result = await repo.acceptOffer(offer.id, me.id);
      if (!result) throw new HttpError(404, 'OFFER_NOT_FOUND', 'Offer not found');
      await createAudit('OFFER_ACCEPT', me.id, 'offer', offer.id, { jobId: job.id });
      return sendJson(res, 200, { offer: result.offer, job: jobView(result.job, me.id) });
    }
    await withTransaction(async () => {
      offer.status = 'ACCEPTED'; offer.updatedAt = now(); job.providerId = offer.providerId; job.status = 'ASSIGNED'; job.updatedAt = now();
      for (const other of db.collection.offers.filter((o) => o.jobId === job.id && o.id !== offer.id && o.status === 'PENDING')) { other.status = 'REJECTED'; other.updatedAt = now(); }
      db.touch('offers', 'jobs');
      await createAudit('OFFER_ACCEPT', me.id, 'offer', offer.id, { jobId: job.id });
    });
    return sendJson(res, 200, { offer, job: jobView(job, me.id) });
  }
  throw new HttpError(404, 'NOT_FOUND', 'Offer route not found');
}

async function paymentRoutes(req, res, parts) {
  if (req.method === 'GET' && parts[1] === 'jobs' && parts[2]) {
    const me = await authUser(req); const job = await getJob(parts[2]); if (!job) throw new HttpError(404, 'JOB_NOT_FOUND', 'Job not found');
    if (!relatedJob(me.id, job)) throw new HttpError(403, 'FORBIDDEN', 'You are not a participant in this job');
    const payment = process.env.DATABASE_URL ? await repo.findPaymentByJob(job.id) : db.collection.payments.find((p) => p.jobId === job.id); return sendJson(res, 200, paymentView(payment, job));
  }
  if (req.method === 'POST' && parts[1] === 'fund' && parts[2]) {
    const me = await authUser(req); const body = await readBody(req); const job = await getJob(parts[2]); if (!job) throw new HttpError(404, 'JOB_NOT_FOUND', 'Job not found');
    if (job.ownerId !== me.id) throw new HttpError(403, 'FORBIDDEN', 'Only the owner can fund a job');
    // Check for an already-completed fund (repeat request / retried idempotency
    // key) BEFORE the state guard: by the time a retry arrives the job is no
    // longer PUBLISHED/ASSIGNED (it's already FUNDED), so enforceJobState would
    // otherwise reject the retry with 409 instead of returning the original
    // payment, defeating the point of the idempotency key.
    const headerIdempotencyKey = readIdempotencyKey(req);
    const bodyIdempotencyKey = String(body?.idempotencyKey || '').trim();
    if (bodyIdempotencyKey && bodyIdempotencyKey.length > config.maxIdempotencyKeyLength) throw new HttpError(400, 'INVALID_IDEMPOTENCY_KEY', 'Idempotency-Key is too long');
    if (bodyIdempotencyKey && !/^[A-Za-z0-9._~:-]+$/.test(bodyIdempotencyKey)) throw new HttpError(400, 'INVALID_IDEMPOTENCY_KEY', 'Idempotency-Key contains unsupported characters');
    if (headerIdempotencyKey && bodyIdempotencyKey && headerIdempotencyKey !== bodyIdempotencyKey) throw new HttpError(400, 'INVALID_IDEMPOTENCY_KEY', 'Header and body idempotency keys must match');
    const idempotencyKey = headerIdempotencyKey || bodyIdempotencyKey;
    if (process.env.DATABASE_URL) {
      const existing = await repo.findPaymentByJob(job.id);
      if (existing) {
        if (idempotencyKey && existing.idempotencyKey && existing.idempotencyKey !== idempotencyKey) throw new HttpError(409, 'PAYMENT_ALREADY_EXISTS', 'A payment already exists for this job');
        if (existing.status === 'HELD' || existing.status === 'RELEASE_PENDING' || existing.status === 'RELEASED') return sendJson(res,200,paymentView(existing,job));
        if (existing.status === 'HOLD_PENDING') return sendJson(res,202,{...paymentView(existing,job), settlement:{status:'PENDING',outboxEventId:null}});
        if (existing.status !== 'HOLD_FAILED') throw new HttpError(409,'INVALID_PAYMENT_STATE','Payment cannot be funded from its current state');
      }
    } else {
      const existing = db.collection.payments.find((p)=>p.jobId===job.id);
      if(existing) return sendJson(res,200,paymentView(existing,job));
      if(idempotencyKey){const prior=db.collection.payments.find((p)=>p.payerId===me.id&&p.idempotencyKey===idempotencyKey); if(prior) return sendJson(res,200,paymentView(prior,job));}
    }
    const existingPayment = process.env.DATABASE_URL ? await repo.findPaymentByJob(job.id) : null;
    enforceJobState(job, existingPayment?.status === 'HOLD_FAILED' ? ['FUNDED'] : ['PUBLISHED', 'ASSIGNED']);
    let providerId = job.providerId;
    let chosenOfferId = null;
    if (!providerId) {
      const chosen = process.env.DATABASE_URL ? (await repo.listOffersForJob(job.id)).filter((o)=>o.status==='PENDING').sort((a,b)=>a.price-b.price)[0] : db.collection.offers.filter((o) => o.jobId === job.id && o.status === 'PENDING').sort((a, b) => a.price - b.price)[0];
      if (!chosen) throw new HttpError(409, 'PROVIDER_REQUIRED', 'Accept an offer before funding the job');
      chosenOfferId = chosen.id; providerId = chosen.providerId;
    }
    if (!providerId) throw new HttpError(409, 'PROVIDER_REQUIRED', 'A provider is required before funding');
    const amount = Number(job.budgetMax || job.budgetMin); if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(400, 'INVALID_AMOUNT', 'Job budget is invalid');
    const createdAt = now();
    const paymentId = db.id();
    let funded;
    try {
      funded = process.env.DATABASE_URL ? await repo.fundJobAtomic({ jobId:job.id, payerId:me.id, payeeId:providerId, offerId: chosenOfferId, amount, id:paymentId, idempotencyKey, createdAt }) : await withTransaction(async () => {
      // File-mode development fallback remains synchronous; production is PostgreSQL + outbox.
      const created = db.insert('payments', { id: paymentId, jobId: job.id, payerId: me.id, payeeId: providerId, amount, status: 'HELD', providerRef: `LOCAL-${paymentId}`, idempotencyKey, createdAt, updatedAt: createdAt });
      job.status = 'FUNDED'; job.updatedAt = createdAt; db.touch('jobs'); return { payment:created, job };
      });
    } catch (error) {
      if (error?.code === 'PAYMENT_ALREADY_EXISTS') throw new HttpError(409, 'PAYMENT_ALREADY_EXISTS', 'A payment already exists for this job');
      if (error?.code === 'IDEMPOTENCY_CONFLICT') throw new HttpError(409, 'IDEMPOTENCY_CONFLICT', 'Idempotency key was already used for different payment parameters');
      if (error?.code === 'INVALID_OFFER_STATE') throw new HttpError(409, 'INVALID_OFFER_STATE', 'The selected offer is no longer available');
      if (error?.code === 'INVALID_STATE') throw new HttpError(409, 'INVALID_STATE', 'Job state changed while funding');
      throw error;
    }
    if (!funded) throw new HttpError(404, 'JOB_NOT_FOUND', 'Job not found');
    const payment = funded.payment;
    const finalJob = funded.job;
    if (process.env.DATABASE_URL) {
      try { await processPaymentCreateHoldNow(); } catch (error) { logEvent({ level:'warn', action:'PAYMENT_CREATE_HOLD_WORKER_TRIGGER_FAILED', paymentId:payment.id, error:error.message }); }
      const refreshed = await repo.findPaymentByJob(job.id);
      const refreshedJob = await repo.findJobById(job.id);
      if (refreshed?.status === 'HELD') return sendJson(res, funded.created ? 201 : 200, paymentView(refreshed, refreshedJob));
      return sendJson(res, funded.created ? 202 : 202, { ...paymentView(refreshed || payment, refreshedJob || finalJob), settlement:{status:'PENDING',outboxEventId:funded.outboxEvent?.id || null} });
    }
    await createAudit('PAYMENT_FUND', me.id, 'payment', payment.id, { jobId: job.id });
    return sendJson(res, 201, paymentView(payment, finalJob));
  }
  if (req.method === 'POST' && parts[1] === 'release' && parts[2]) {
    const me = await authUser(req); const job = await getJob(parts[2]); if (!job) throw new HttpError(404, 'JOB_NOT_FOUND', 'Job not found');
    if (job.ownerId !== me.id) throw new HttpError(403, 'FORBIDDEN', 'Only the owner can release payment');
    enforceJobState(job, ['COMPLETED']);
    const payment = process.env.DATABASE_URL ? await repo.findPaymentByJob(job.id) : db.collection.payments.find((p) => p.jobId === job.id); if (!payment || payment.status !== 'RELEASE_PENDING') throw new HttpError(409, 'INVALID_PAYMENT_STATE', 'Payment is not ready for release');
    if (process.env.DATABASE_URL) {
      const event = await repo.enqueuePaymentRelease({ jobId:job.id, ownerId:me.id, paymentId:payment.id, dedupeKey:`PAYMENT_RELEASE:${payment.id}` });
      try { await processPaymentReleaseNow(); } catch (error) { logEvent({ level:'warn', action:'PAYMENT_RELEASE_WORKER_TRIGGER_FAILED', paymentId:payment.id, error:error.message }); }
      const refreshed = await repo.findPaymentByJob(job.id);
      const finalJob = await repo.findJobById(job.id);
      if (refreshed?.status === 'RELEASED') return sendJson(res, 200, paymentView(refreshed, finalJob));
      return sendJson(res, 202, { ...paymentView(refreshed, finalJob), settlement: { status:'PENDING', outboxEventId:event?.id || null } });
    }
    await withTransaction(async () => {
      payment.status = 'RELEASED'; payment.updatedAt = now(); job.status = 'SETTLED'; job.updatedAt = now(); db.touch('payments', 'jobs');
      await createAudit('PAYMENT_RELEASE', me.id, 'payment', payment.id, { jobId: job.id });
    });
    return sendJson(res, 200, paymentView(payment, job));
  }
  throw new HttpError(404, 'NOT_FOUND', 'Payment route not found');
}

async function storageRoutes(req, res, parts) {
  const user = await authUser(req);
  if (req.method === 'POST' && parts[1] === 'upload') {
    const file = await readMultipartSingleFile(req);
    try {
      await storage.put(file);
    } finally {
      try { await fs.promises.unlink(file.path); } catch {}
    }
    const data = { key: file.key, filename: file.filename, contentType: file.contentType, size: file.size, uploadedBy: user.id, createdAt: now() };
    const uploadDraft={ id:db.id(), storageKey:file.key, uploadedBy:user.id, contentType:file.contentType, size:file.size, createdAt:now() };
    try {
      if(process.env.DATABASE_URL) await repo.insertUpload(uploadDraft); else db.insert('uploads', uploadDraft);
    } catch (error) {
      try { await storage.delete({ key:file.key }); } catch (cleanupError) { logEvent({ level:'error', action:'ORPHAN_UPLOAD_CLEANUP_FAILED', key:file.key, message:cleanupError?.message || String(cleanupError) }); }
      throw error;
    }
    return sendJson(res, 201, data);
  }
  if (req.method === 'POST' && parts[1] === 'presign') {
    const body = await readBody(req); requireFields(body, ['filename','contentType']);
    const contentType = String(body.contentType).trim().toLowerCase();
    if (!['application/pdf','image/png','image/jpeg','image/webp','text/plain'].includes(contentType)) throw new HttpError(415, 'UNSUPPORTED_FILE', 'Unsupported content type');
    const safeName = path.basename(String(body.filename)).replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${config.s3Prefix}/${crypto.randomUUID()}-${safeName}`;
    try {
      const result = await storage.presignPut({ key, contentType, expiresIn:300 });
      const intentDraft={id:db.id(),storageKey:key,uploadedBy:user.id,contentType,expiresAt:new Date(Date.now()+300*1000).toISOString(),createdAt:now()};
      const intent = process.env.DATABASE_URL ? await repo.createUploadIntent(intentDraft) : db.insert('uploadIntents', intentDraft);
      return sendJson(res, 200, { ...result, intentId:intent.id, uploadedBy:user.id });
    } catch (error) {
      if (error?.message === 'DIRECT_UPLOAD_UNSUPPORTED') throw new HttpError(409, 'DIRECT_UPLOAD_UNSUPPORTED', 'Direct upload requires S3-compatible storage');
      throw error;
    }
  }
  if (req.method === 'POST' && parts[1] === 'complete') {
    const body = await readBody(req); requireFields(body, ['key','filename','contentType']);
    const key = String(body.key).trim();
    const contentType = String(body.contentType).trim().toLowerCase();
    if (!key || key.includes('..') || key.includes('\\')) throw new HttpError(400, 'INVALID_STORAGE_KEY', 'Invalid storage key');
    if (!['application/pdf','image/png','image/jpeg','image/webp','text/plain'].includes(contentType)) throw new HttpError(415, 'UNSUPPORTED_FILE', 'Unsupported content type');
    let head;
    try { head = await storage.head({ key }); } catch { throw new HttpError(404, 'UPLOAD_NOT_FOUND', 'Uploaded object was not found'); }
    if (head.contentType && head.contentType !== contentType) throw new HttpError(415, 'CONTENT_TYPE_MISMATCH', 'Uploaded content type does not match the declared type');
    if (!head.size || head.size > config.maxUploadBytes) throw new HttpError(413, 'FILE_TOO_LARGE', 'File is too large');
    try { await storage.validateObject({ key, contentType }); }
    catch (error) { if (error?.message === 'DIRECT_UPLOAD_UNSUPPORTED') throw new HttpError(409, 'DIRECT_UPLOAD_UNSUPPORTED', 'Direct upload requires S3-compatible storage'); if (error?.code === 'INVALID_FILE_SIGNATURE') throw new HttpError(415, 'UNSUPPORTED_FILE', 'Uploaded file content does not match the declared type'); throw error; }
    const filename = path.basename(String(body.filename)).replace(/[^a-zA-Z0-9._-]/g, '_');
    if (process.env.DATABASE_URL) {
      const existing = await repo.findUploadByKey(key);
      if (existing) { if(existing.uploadedBy!==user.id) throw new HttpError(403,'FORBIDDEN','Upload belongs to another user'); return sendJson(res,200,{id:existing.id,key,filename,contentType:existing.contentType,size:existing.size,uploadedBy:existing.uploadedBy,createdAt:existing.createdAt}); }
      const intent = await repo.findUploadIntentForUpdate(key);
      if (!intent) throw new HttpError(403,'UPLOAD_INTENT_REQUIRED','Upload was not reserved by this API');
      if (intent.uploadedBy!==user.id) throw new HttpError(403,'FORBIDDEN','Upload intent belongs to another user');
      if (new Date(intent.expiresAt).getTime()<=Date.now()) throw new HttpError(410,'UPLOAD_INTENT_EXPIRED','Upload intent has expired');
      if (intent.contentType!==contentType) throw new HttpError(415,'CONTENT_TYPE_MISMATCH','Content type does not match the upload intent');
      let completed; try { completed=await repo.completeUploadAtomic({intentId:intent.id,key,userId:user.id,contentType,size:head.size,createdAt:now()}); } catch(e){ if(e.code==='INVALID_UPLOAD_INTENT') throw new HttpError(403,'INVALID_UPLOAD_INTENT','Upload intent is invalid or expired'); throw e; }
      const created=completed.upload; return sendJson(res,completed.existing?200:201,{id:created.id,key,filename,contentType,size:created.size,uploadedBy:created.uploadedBy,createdAt:created.createdAt});
    }
    const existing = db.collection.uploads.find((x) => x.storageKey === key);
    if (existing) { if (existing.uploadedBy !== user.id) throw new HttpError(403, 'FORBIDDEN', 'Upload belongs to another user'); return sendJson(res, 200, existing); }
    const intent = db.collection.uploadIntents.find((x) => x.storageKey === key);
    if (!intent) throw new HttpError(403, 'UPLOAD_INTENT_REQUIRED', 'Upload was not reserved by this API');
    if (intent.uploadedBy !== user.id) throw new HttpError(403, 'FORBIDDEN', 'Upload intent belongs to another user');
    if (new Date(intent.expiresAt).getTime() <= Date.now()) throw new HttpError(410, 'UPLOAD_INTENT_EXPIRED', 'Upload intent has expired');
    if (intent.contentType !== contentType) throw new HttpError(415, 'CONTENT_TYPE_MISMATCH', 'Content type does not match the upload intent');
    const created = db.insert('uploads', { id:db.id(), storageKey:key, uploadedBy:user.id, contentType, size:head.size, createdAt:now() });
    db.collection.uploadIntents = db.collection.uploadIntents.filter((x) => x.storageKey !== key); db.touch('uploadIntents');
    return sendJson(res, 201, { id:created.id, key, filename, contentType, size:head.size, uploadedBy:user.id, createdAt:created.createdAt });
  }
  throw new HttpError(404, 'NOT_FOUND', 'Storage route not found');
}

export function createServer() { return http.createServer(handle); }
