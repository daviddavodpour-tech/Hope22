import path from 'node:path';

export const config = {
  host: process.env.HOST || '0.0.0.0',
  port: Number(process.env.PORT || 3000),
  dataFile: process.env.DATA_FILE || path.resolve('data/hope.json'),
  storageDir: process.env.STORAGE_DIR || path.resolve('storage'),
  accessSecret: process.env.ACCESS_TOKEN_SECRET || 'change-this-access-secret',
  refreshSecret: process.env.REFRESH_TOKEN_SECRET || 'change-this-refresh-secret',
  accessTtlSeconds: Number(process.env.ACCESS_TOKEN_TTL || 900),
  accessIssuer: process.env.ACCESS_TOKEN_ISSUER || 'hope-api',
  accessAudience: process.env.ACCESS_TOKEN_AUDIENCE || 'hope-mobile',
  maxRequestBytes: Number(process.env.MAX_REQUEST_BYTES || 1024 * 1024),
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS || 30000),
  headersTimeoutMs: Number(process.env.HEADERS_TIMEOUT_MS || 15000),
  keepAliveTimeoutMs: Number(process.env.KEEP_ALIVE_TIMEOUT_MS || 5000),
  refreshTtlSeconds: Number(process.env.REFRESH_TOKEN_TTL || 60 * 60 * 24 * 30),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES || 10 * 1024 * 1024),
  databaseUrl: process.env.DATABASE_URL || '',
  pgPoolMax: Number(process.env.PG_POOL_MAX || 10),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
  authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX || 10),
  trustProxy: process.env.TRUST_PROXY === 'true',
  allowedCorsOrigins: String(process.env.ALLOWED_CORS_ORIGINS || '').split(',').map((v) => v.trim()).filter(Boolean),
  metricsToken: process.env.METRICS_TOKEN || '',
  generalRateLimitWindowMs: Number(process.env.GENERAL_RATE_LIMIT_WINDOW_MS || 60000),
  generalRateLimitMax: Number(process.env.GENERAL_RATE_LIMIT_MAX || 120),
  resetTokenTtlSeconds: Number(process.env.RESET_TOKEN_TTL || 900),
  exposeResetTokenInDevelopment: process.env.EXPOSE_RESET_TOKEN_IN_DEVELOPMENT === 'true',
  paymentCurrency: process.env.PAYMENT_CURRENCY || 'USD',
  outboxPollMs: Number(process.env.OUTBOX_POLL_MS || 1000),
  outboxMaxAttempts: Number(process.env.OUTBOX_MAX_ATTEMPTS || 8),
  outboxLeaseSeconds: Number(process.env.OUTBOX_LEASE_SECONDS || 60),
  resetDeliveryMode: process.env.RESET_TOKEN_DELIVERY_MODE || 'console',
  resetDeliveryUrl: process.env.RESET_TOKEN_DELIVERY_URL || '',
  resetDeliveryTimeoutMs: Number(process.env.RESET_TOKEN_DELIVERY_TIMEOUT_MS || 5000),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || '',
  storageBackend: process.env.STORAGE_BACKEND || 'local',
  s3Bucket: process.env.S3_BUCKET || '',
  s3Region: process.env.S3_REGION || 'us-east-1',
  s3Endpoint: process.env.S3_ENDPOINT || '',
  s3ForcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  s3Prefix: process.env.S3_PREFIX || 'uploads',
  uploadIntentTtlSeconds: Number(process.env.UPLOAD_INTENT_TTL_SECONDS || 300),
  maxIdempotencyKeyLength: Number(process.env.MAX_IDEMPOTENCY_KEY_LENGTH || 200),
};

if (process.env.NODE_ENV === 'production') {
  if (config.accessSecret.startsWith('change-this') || config.refreshSecret.startsWith('change-this')) {
    throw new Error('ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must be set in production');
  }
  if (!config.databaseUrl) throw new Error('DATABASE_URL must be set in production');
  if (!config.publicBaseUrl.startsWith('https://')) throw new Error('PUBLIC_BASE_URL must use HTTPS in production');
  if (!config.metricsToken) throw new Error('METRICS_TOKEN must be set in production');
  if (!config.allowedCorsOrigins.length || config.allowedCorsOrigins.includes('*')) throw new Error('ALLOWED_CORS_ORIGINS must explicitly list origins in production');
  if (config.storageBackend !== 's3') throw new Error('STORAGE_BACKEND=s3 is required in production');
  if (!config.s3Bucket) throw new Error('S3_BUCKET must be set in production');
  if (!['webhook'].includes(config.resetDeliveryMode)) throw new Error('RESET_TOKEN_DELIVERY_MODE=webhook is required in production');
  if (!config.resetDeliveryUrl.startsWith('https://')) throw new Error('RESET_TOKEN_DELIVERY_URL must use HTTPS in production');
}
