import crypto from 'node:crypto';
import { promisify } from 'node:util';

const b64 = (value) => Buffer.from(value).toString('base64url');
const fromB64 = (value) => Buffer.from(value, 'base64url');
const pbkdf2Async = promisify(crypto.pbkdf2);
const PBKDF2_ITERATIONS = 310_000;
const MAX_PBKDF2_ITERATIONS = 310_000;
const MIN_PBKDF2_ITERATIONS = 100_000;

// PERF: pbkdf2Sync blocks the single Node event-loop thread for the full
// duration of the hash (hundreds of ms at 310k rounds). On a single-CPU host
// that means every concurrent request stalls behind a login/register call.
// crypto.pbkdf2 (async) hands the work to libuv's threadpool instead, so the
// event loop keeps serving other requests while a password hash runs. Same
// algorithm, cost factor, and encoded format -- purely non-blocking now.
export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const hash = (await pbkdf2Async(password, salt, PBKDF2_ITERATIONS, 32, 'sha256')).toString('base64url');
  return `pbkdf2$310000$${salt}$${hash}`;
}

export async function verifyPassword(password, encoded) {
  try {
    const [scheme, iterations, salt, expected] = String(encoded).split('$');
    const rounds = Number(iterations);
    if (scheme !== 'pbkdf2' || !Number.isSafeInteger(rounds) || rounds < MIN_PBKDF2_ITERATIONS || rounds > MAX_PBKDF2_ITERATIONS || !salt || !expected) return false;
    const actual = (await pbkdf2Async(password, salt, rounds, 32, 'sha256')).toString('base64url');
    const a = Buffer.from(actual);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function signAccessToken(payload, secret, ttlSeconds, { issuer = 'hope-api', audience = 'hope-mobile' } = {}) {
  const header = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = b64(JSON.stringify({ ...payload, jti: payload.jti || crypto.randomUUID(), iat: now, exp: now + ttlSeconds, iss: issuer, aud: audience }));
  const unsigned = `${header}.${body}`;
  const sig = crypto.createHmac('sha256', secret).update(unsigned).digest('base64url');
  return `${unsigned}.${sig}`;
}

export function verifyAccessToken(token, secret, { issuer = 'hope-api', audience = 'hope-mobile', maxBytes = 8192 } = {}) {
  if (Buffer.byteLength(String(token || ''), 'utf8') > maxBytes) throw new Error('Invalid token');
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const unsigned = `${parts[0]}.${parts[1]}`;
  const expected = crypto.createHmac('sha256', secret).update(unsigned).digest('base64url');
  const provided = Buffer.from(parts[2]);
  const expectedBuf = Buffer.from(expected);
  if (provided.length !== expectedBuf.length || !crypto.timingSafeEqual(expectedBuf, provided)) throw new Error('Invalid signature');
  let payload;
  try { payload = JSON.parse(fromB64(parts[1]).toString('utf8')); } catch { throw new Error('Invalid token'); }
  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp <= now || !payload.iat || payload.iat > now + 30) throw new Error('Token expired/invalid');
  if (payload.iss !== issuer || payload.aud !== audience || !payload.sub || !payload.jti) throw new Error('Token claims invalid');
  return payload;
}
