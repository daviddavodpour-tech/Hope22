import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';
import { db } from './db.js';

export class HttpError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function sendJson(res, status, data) {
  await db.flush();
  const body = JSON.stringify({ data });
  if (!res.getHeader('X-Request-Id')) res.setHeader('X-Request-Id', crypto.randomUUID());
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

export function sendError(res, error) {
  const status = error instanceof HttpError ? error.status : 500;
  const code = error instanceof HttpError ? error.code : 'INTERNAL_ERROR';
  const message = error instanceof HttpError ? error.message : 'Internal server error';
  const body = JSON.stringify({ error: { code, message, ...(error.details ? { details: error.details } : {}) } });
  if (!res.getHeader('X-Request-Id')) res.setHeader('X-Request-Id', crypto.randomUUID());
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), 'Cache-Control': 'no-store' });
  res.end(body);
}

export function setCors(res, req) {
  const origin = String(req.headers.origin || '');
  if (origin && (config.allowedCorsOrigins.includes('*') || config.allowedCorsOrigins.includes(origin) || process.env.NODE_ENV !== 'production' && config.allowedCorsOrigins.length === 0)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
}

export async function readBody(req, maxBytes = config.maxRequestBytes) {
  const chunks = [];
  let size = 0;
  const declaredLength = Number(req.headers['content-length']);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) throw new HttpError(413, 'BODY_TOO_LARGE', 'Request body is too large');
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new HttpError(413, 'BODY_TOO_LARGE', 'Request body is too large');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks);
  if (!raw.length) return null;
  const type = String(req.headers['content-type'] || '');
  if (type.includes('application/json')) {
    try { return JSON.parse(raw.toString('utf8')); } catch { throw new HttpError(400, 'INVALID_JSON', 'Invalid JSON body'); }
  }
  return raw;
}

export async function readMultipartSingleFile(req) {
  const type = String(req.headers['content-type'] || '');
  const match = type.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!match) throw new HttpError(400, 'INVALID_MULTIPART', 'Multipart boundary is missing');
  const boundary = Buffer.from(`--${match[1] || match[2]}`);
  const declaredLength = Number(req.headers['content-length']);
  if (Number.isFinite(declaredLength) && declaredLength > config.maxUploadBytes + 1024 * 1024) throw new HttpError(413, 'FILE_TOO_LARGE', 'File is too large');
  const tempName = `${crypto.randomUUID()}.upload`;
  await fs.promises.mkdir(config.storageDir, { recursive: true });
  const tempPath = path.join(config.storageDir, `.incoming-${tempName}`);
  const stream = fs.createWriteStream(tempPath, { flags: 'wx' });
  let size = 0;
  try {
    for await (const chunk of req) {
      size += chunk.length;
      if (size > config.maxUploadBytes + 1024 * 1024) {
        stream.destroy();
        throw new HttpError(413, 'FILE_TOO_LARGE', 'File is too large');
      }
      if (!stream.write(chunk)) await new Promise((resolve, reject) => { stream.once('drain', resolve); stream.once('error', reject); });
    }
    await new Promise((resolve, reject) => { stream.end(resolve); stream.once('error', reject); });
  } catch (error) {
    try { stream.destroy(); await fs.promises.unlink(tempPath); } catch {}
    throw error;
  }
  let filePath = null;
  try {
    const body = await fs.promises.readFile(tempPath);
    const start = body.indexOf(boundary);
    if (start < 0) throw new HttpError(400, 'INVALID_MULTIPART', 'Multipart payload is invalid');
    const headerStart = start + boundary.length + 2;
    const headerEnd = body.indexOf(Buffer.from('\r\n\r\n'), headerStart);
    if (headerEnd < 0) throw new HttpError(400, 'INVALID_MULTIPART', 'Multipart headers are invalid');
    const headersText = body.subarray(headerStart, headerEnd).toString('utf8');
    const disposition = headersText.match(/content-disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]*)")?/i);
    if (!disposition || disposition[1] !== 'file' || !disposition[2]) throw new HttpError(400, 'FILE_REQUIRED', 'A file field is required');
    const contentType = headersText.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || 'application/octet-stream';
    const nextBoundary = body.indexOf(Buffer.from(`\r\n${boundary.toString('binary')}`), headerEnd + 4);
    if (nextBoundary < 0) throw new HttpError(400, 'INVALID_MULTIPART', 'Multipart terminator is missing');
    const content = body.subarray(headerEnd + 4, nextBoundary);
    if (!content.length) throw new HttpError(400, 'EMPTY_FILE', 'Uploaded file is empty');
    if (content.length > config.maxUploadBytes) throw new HttpError(413, 'FILE_TOO_LARGE', 'File is too large');
    const declaredType = contentType.toLowerCase();
    const signatureOk = (declaredType === 'application/pdf' && content.subarray(0, 4).toString() === '%PDF') ||
      (declaredType === 'image/png' && content.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
      (declaredType === 'image/jpeg' && content.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) ||
      (declaredType === 'image/webp' && content.subarray(0, 4).toString() === 'RIFF' && content.subarray(8, 12).toString() === 'WEBP') ||
      (declaredType === 'text/plain' && !content.subarray(0, 4096).includes(0));
    if (!['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain'].includes(declaredType) || !signatureOk) {
      throw new HttpError(415, 'UNSUPPORTED_FILE', 'Unsupported or invalid file content');
    }
    const safeName = path.basename(disposition[2]).replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${crypto.randomUUID()}-${safeName}`;
    filePath = path.join(config.storageDir, key);
    await fs.promises.writeFile(filePath, content, { flag: 'wx' });
    return { key, filename: safeName, contentType, size: content.length, path: tempPath };
  } catch (error) {
    try { await fs.promises.unlink(tempPath); } catch {}
    if (filePath) { try { await fs.promises.unlink(filePath); } catch {} }
    throw error;
  }
}
