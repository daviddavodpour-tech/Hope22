import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;
const collections = ['users','providers','refreshTokens','resetTokens','categories','jobs','offers','payments','evidence','uploads','uploadIntents','audit'];
const tableMap = {
  users: 'users', providers: 'providers', refreshTokens: 'refresh_tokens', resetTokens: 'reset_tokens',
  categories: 'categories', jobs: 'jobs', offers: 'offers', payments: 'payments', evidence: 'evidence',
  uploads: 'uploads', uploadIntents: 'upload_intents', audit: 'audit_logs',
};
const empty = Object.fromEntries(collections.map((name) => [name, []]));
fs.mkdirSync(config.storageDir, { recursive: true });
const pool = config.databaseUrl ? new Pool({ connectionString: config.databaseUrl, max: Number(config.pgPoolMax || 10), idleTimeoutMillis: 30000 }) : null;
let state = structuredClone(empty);
let initialized = false;
let flushChain = Promise.resolve();
let txDepth = 0;
let dirty = new Set();
let transactionChain = Promise.resolve();

function legacyLoad() {
  if (!config.dataFile || !fs.existsSync(config.dataFile)) return structuredClone(empty);
  try { return { ...structuredClone(empty), ...JSON.parse(fs.readFileSync(config.dataFile, 'utf8')) }; }
  catch (error) { throw new Error(`Cannot read legacy data: ${error.message}`); }
}

const tableColumns = {
  users: ['email','password_hash','display_name','role','status','session_version','created_at'],
  providers: ['user_id','provider_type','capacity','verification_status','created_at','updated_at'],
  refresh_tokens: ['user_id','token_hash','family_id','expires_at','created_at','revoked_at','replaced_by'],
  reset_tokens: ['user_id','token_hash','family_id','expires_at','used_at','created_at'],
  categories: ['slug','name','created_at'],
  jobs: ['owner_id','provider_id','title','description','category_id','job_type','budget_type','budget_min','budget_max','duration','acceptance_criteria','status','city','created_at','updated_at','published_at'],
  offers: ['job_id','provider_id','price','message','status','created_at','updated_at'],
  payments: ['job_id','payer_id','payee_id','amount','status','provider_ref','idempotency_key','created_at','updated_at'],
  evidence: ['job_id','submitted_by','uri','notes','type','created_at'],
  uploads: ['storage_key','uploaded_by','content_type','size','created_at'],
  upload_intents: ['storage_key','uploaded_by','content_type','expires_at','created_at'],
  audit_logs: ['action','actor_id','entity_type','entity_id','meta','created_at'],
};

function toDbRow(collection, row) {
  switch (collection) {
    case 'users': return [row.id,row.email,row.passwordHash,row.displayName,row.role,row.status,row.sessionVersion || 0,row.createdAt];
    case 'providers': return [row.id,row.userId,row.providerType,row.capacity,row.verificationStatus,row.createdAt,row.updatedAt];
    case 'refreshTokens': return [row.id,row.userId,row.tokenHash,row.familyId,row.expiresAt,row.createdAt,row.revokedAt,row.replacedBy];
    case 'resetTokens': return [row.id,row.userId,row.tokenHash,row.familyId || crypto.randomUUID(),row.expiresAt,row.usedAt,row.createdAt];
    case 'categories': return [row.id,row.slug,row.name,row.createdAt];
    case 'jobs': return [row.id,row.ownerId,row.providerId,row.title,row.description,row.categoryId,row.jobType,row.budgetType,row.budgetMin,row.budgetMax,row.duration,row.acceptanceCriteria,row.status,row.city,row.createdAt,row.updatedAt,row.publishedAt];
    case 'offers': return [row.id,row.jobId,row.providerId,row.price,row.message,row.status,row.createdAt,row.updatedAt];
    case 'payments': return [row.id,row.jobId,row.payerId,row.payeeId,row.amount,row.status,row.providerRef,row.idempotencyKey,row.createdAt,row.updatedAt];
    case 'evidence': return [row.id,row.jobId,row.submittedBy,row.uri,row.notes,row.type,row.createdAt];
    case 'uploads': return [row.id,row.storageKey,row.uploadedBy,row.contentType,row.size,row.createdAt];
    case 'uploadIntents': return [row.id,row.storageKey,row.uploadedBy,row.contentType,row.expiresAt,row.createdAt];
    case 'audit': return [row.id,row.action,row.actorId,row.entityType,row.entityId,row.meta || {},row.createdAt];
    default: throw new Error(`Unknown collection ${collection}`);
  }
}

function fromDbRow(collection, r) {
  switch (collection) {
    case 'users': return { id:r.id,email:r.email,passwordHash:r.password_hash,displayName:r.display_name,role:r.role,status:r.status,sessionVersion:Number(r.session_version || 0),createdAt:r.created_at?.toISOString?.() ?? r.created_at };
    case 'providers': return { id:r.id,userId:r.user_id,providerType:r.provider_type,capacity:r.capacity,verificationStatus:r.verification_status,createdAt:r.created_at?.toISOString?.() ?? r.created_at,updatedAt:r.updated_at?.toISOString?.() ?? r.updated_at };
    case 'refreshTokens': return { id:r.id,userId:r.user_id,tokenHash:r.token_hash,familyId:r.family_id,expiresAt:r.expires_at?.toISOString?.() ?? r.expires_at,createdAt:r.created_at?.toISOString?.() ?? r.created_at,revokedAt:r.revoked_at ? (r.revoked_at.toISOString?.() ?? r.revoked_at) : null,replacedBy:r.replaced_by };
    case 'resetTokens': return { id:r.id,userId:r.user_id,tokenHash:r.token_hash,familyId:r.family_id,expiresAt:r.expires_at?.toISOString?.() ?? r.expires_at,usedAt:r.used_at ? (r.used_at.toISOString?.() ?? r.used_at) : null,createdAt:r.created_at?.toISOString?.() ?? r.created_at };
    case 'categories': return { id:r.id,slug:r.slug,name:r.name,createdAt:r.created_at?.toISOString?.() ?? r.created_at };
    case 'jobs': return { id:r.id,ownerId:r.owner_id,providerId:r.provider_id,title:r.title,description:r.description,categoryId:r.category_id,jobType:r.job_type,budgetType:r.budget_type,budgetMin:Number(r.budget_min),budgetMax:Number(r.budget_max),duration:r.duration,acceptanceCriteria:r.acceptance_criteria,status:r.status,city:r.city,createdAt:r.created_at?.toISOString?.() ?? r.created_at,updatedAt:r.updated_at?.toISOString?.() ?? r.updated_at,publishedAt:r.published_at ? (r.published_at.toISOString?.() ?? r.published_at) : null };
    case 'offers': return { id:r.id,jobId:r.job_id,providerId:r.provider_id,price:Number(r.price),message:r.message,status:r.status,createdAt:r.created_at?.toISOString?.() ?? r.created_at,updatedAt:r.updated_at?.toISOString?.() ?? r.updated_at };
    case 'payments': return { id:r.id,jobId:r.job_id,payerId:r.payer_id,payeeId:r.payee_id,amount:Number(r.amount),status:r.status,providerRef:r.provider_ref,idempotencyKey:r.idempotency_key || '',createdAt:r.created_at?.toISOString?.() ?? r.created_at,updatedAt:r.updated_at?.toISOString?.() ?? r.updated_at };
    case 'evidence': return { id:r.id,jobId:r.job_id,submittedBy:r.submitted_by,uri:r.uri,notes:r.notes,type:r.type,createdAt:r.created_at?.toISOString?.() ?? r.created_at };
    case 'uploads': return { id:r.id,storageKey:r.storage_key,uploadedBy:r.uploaded_by,contentType:r.content_type,size:r.size,createdAt:r.created_at?.toISOString?.() ?? r.created_at };
    case 'uploadIntents': return { id:r.id,storageKey:r.storage_key,uploadedBy:r.uploaded_by,contentType:r.content_type,expiresAt:r.expires_at?.toISOString?.() ?? r.expires_at,createdAt:r.created_at?.toISOString?.() ?? r.created_at };
    case 'audit': return { id:r.id,action:r.action,actorId:r.actor_id,entityType:r.entity_type,entityId:r.entity_id,meta:r.meta || {},createdAt:r.created_at?.toISOString?.() ?? r.created_at };
    default: throw new Error(`Unknown collection ${collection}`);
  }
}

async function createSchema(client) {
  await client.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'USER', status TEXT NOT NULL DEFAULT 'ACTIVE', session_version INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS providers (
      id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, provider_type TEXT NOT NULL,
      capacity TEXT NOT NULL, verification_status TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL,
      UNIQUE(user_id)
    );
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash TEXT NOT NULL UNIQUE, family_id UUID NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ NULL, replaced_by TEXT NULL
    );
    CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens(user_id);
    CREATE TABLE IF NOT EXISTS reset_tokens (
      id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash TEXT NOT NULL UNIQUE, family_id UUID NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL, used_at TIMESTAMPTZ NULL, created_at TIMESTAMPTZ NOT NULL
    );
    DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='reset_tokens') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reset_tokens' AND column_name='family_id') THEN ALTER TABLE reset_tokens ADD COLUMN family_id UUID; UPDATE reset_tokens SET family_id=gen_random_uuid() WHERE family_id IS NULL; ALTER TABLE reset_tokens ALTER COLUMN family_id SET NOT NULL; END IF; END $$;
    CREATE TABLE IF NOT EXISTS categories (
      id UUID PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS jobs (
      id UUID PRIMARY KEY, owner_id UUID NOT NULL REFERENCES users(id), provider_id UUID NULL REFERENCES users(id),
      title TEXT NOT NULL, description TEXT NOT NULL, category_id UUID NOT NULL REFERENCES categories(id), job_type TEXT NOT NULL,
      budget_type TEXT NOT NULL, budget_min NUMERIC(18,2) NOT NULL CHECK(budget_min > 0), budget_max NUMERIC(18,2) NOT NULL CHECK(budget_max >= budget_min),
      duration INTEGER NOT NULL CHECK(duration > 0), acceptance_criteria TEXT NOT NULL, status TEXT NOT NULL,
      city TEXT NULL, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL, published_at TIMESTAMPTZ NULL
    );
    ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;
    CREATE INDEX IF NOT EXISTS jobs_owner_idx ON jobs(owner_id); CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs(status); CREATE INDEX IF NOT EXISTS jobs_provider_idx ON jobs(provider_id);
    CREATE TABLE IF NOT EXISTS offers (
      id UUID PRIMARY KEY, job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE, provider_id UUID NOT NULL REFERENCES users(id),
      price NUMERIC(18,2) NOT NULL CHECK(price > 0), message TEXT NOT NULL, status TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS offers_job_idx ON offers(job_id); CREATE UNIQUE INDEX IF NOT EXISTS offers_pending_provider_uq ON offers(job_id, provider_id) WHERE status='PENDING';
    CREATE TABLE IF NOT EXISTS payments (
      id UUID PRIMARY KEY, job_id UUID NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE CASCADE, payer_id UUID NOT NULL REFERENCES users(id),
      payee_id UUID NOT NULL REFERENCES users(id), amount NUMERIC(18,2) NOT NULL CHECK(amount > 0), status TEXT NOT NULL,
      provider_ref TEXT NOT NULL UNIQUE, idempotency_key TEXT NULL, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS payments_idempotency_uq ON payments(payer_id,idempotency_key) WHERE idempotency_key IS NOT NULL AND idempotency_key <> '';
    CREATE TABLE IF NOT EXISTS evidence (
      id UUID PRIMARY KEY, job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE, submitted_by UUID NOT NULL REFERENCES users(id),
      uri TEXT NOT NULL, notes TEXT NOT NULL, type TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS uploads (
      id UUID PRIMARY KEY, storage_key TEXT NOT NULL UNIQUE, uploaded_by UUID NOT NULL REFERENCES users(id), content_type TEXT NOT NULL,
      size INTEGER NOT NULL CHECK(size > 0), created_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS upload_intents (
      id UUID PRIMARY KEY, storage_key TEXT NOT NULL UNIQUE, uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content_type TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS upload_intents_user_idx ON upload_intents(uploaded_by);
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY, action TEXT NOT NULL, actor_id UUID NULL REFERENCES users(id) ON DELETE SET NULL, entity_type TEXT NOT NULL,
      entity_id UUID NULL, meta JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL
    );
    ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS family_id UUID;
    UPDATE refresh_tokens SET family_id = id WHERE family_id IS NULL;
    ALTER TABLE refresh_tokens ALTER COLUMN family_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS refresh_tokens_family_idx ON refresh_tokens(family_id);
    CREATE TABLE IF NOT EXISTS hope_meta (key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS outbox_events (
      id UUID PRIMARY KEY,
      event_type TEXT NOT NULL,
      aggregate_type TEXT NOT NULL,
      aggregate_id UUID NULL,
      dedupe_key TEXT NULL UNIQUE,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PROCESSING','DONE','FAILED')),
      attempts INTEGER NOT NULL DEFAULT 0,
      available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      locked_at TIMESTAMPTZ NULL,
      last_error TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      processed_at TIMESTAMPTZ NULL
    );
    CREATE INDEX IF NOT EXISTS outbox_pending_idx ON outbox_events(status,available_at,created_at);
  `);
}

async function loadAll(client) {
  const next = structuredClone(empty);
  for (const collection of collections) {
    const table = tableMap[collection];
    const { rows } = await client.query(`SELECT * FROM ${table} ORDER BY created_at NULLS FIRST, id`);
    next[collection] = rows.map((r) => fromDbRow(collection, r));
  }
  return next;
}

async function upsertCollection(client, collection) {
  const table = tableMap[collection];
  for (const row of state[collection]) {
    const values = toDbRow(collection, row);
    const cols = tableColumns[table];
    const placeholders = cols.map((_, i) => `$${i + 2}`);
    await client.query(
      `INSERT INTO ${table}(id,${cols.join(',')}) VALUES($1,${placeholders.join(',')}) ON CONFLICT(id) DO UPDATE SET ${cols.map((c) => `${c}=EXCLUDED.${c}`).join(',')}`,
      values
    );
  }
}

async function flushInTx(client, collectionsToWrite) {
  for (const collection of collectionsToWrite) await upsertCollection(client, collection);
  await client.query("INSERT INTO hope_meta(key,value) VALUES('schema_version','\"2-relational\"'::jsonb) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()");
}

async function persistCollections(collectionsToWrite) {
  if (!pool || collectionsToWrite.size === 0) return;
  const client = await pool.connect();
  try { await client.query('BEGIN'); await flushInTx(client, collectionsToWrite); await client.query('COMMIT'); }
  catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

export async function initDatabase() {
  if (initialized) return;
  if (!pool) { state = legacyLoad(); initialized = true; return; }
  const client = await pool.connect();
  try {
    await createSchema(client);
    const loaded = await loadAll(client);
    const hasData = Object.values(loaded).some((items) => items.length > 0);
    if (hasData) state = loaded;
    else {
      state = legacyLoad();
      const hasLegacy = Object.values(state).some((items) => items.length > 0);
      if (hasLegacy) { dirty = new Set(collections); await flushInTx(client, dirty); dirty.clear(); }
    }
    initialized = true;
    console.log('[db] PostgreSQL relational schema initialized; multi-writer safe repository mode active');
  } catch (e) { throw e; }
  finally { client.release(); }
}

async function persistLegacyFile() {
  if (pool || !config.dataFile) return;
  const dir = path.dirname(config.dataFile);
  await fs.promises.mkdir(dir, { recursive: true });
  const temp = `${config.dataFile}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fs.promises.writeFile(temp, JSON.stringify(state, null, 2), 'utf8');
  await fs.promises.rename(temp, config.dataFile);
}

function scheduleFlush() {
  const toFlush = new Set(dirty);
  dirty.clear();
  if (!toFlush.size) return;
  if (pool) flushChain = flushChain.then(() => persistCollections(toFlush));
  else flushChain = flushChain.then(() => persistLegacyFile());
}

function markDirty(collection) {
  dirty.add(collection);
  if (txDepth === 0) scheduleFlush();
}

export async function withTransaction(fn) {
  if (!pool) {
    const snapshot = structuredClone(state);
    const dirtyBefore = new Set(dirty);
    txDepth += 1;
    try {
      const result = await fn();
      txDepth -= 1;
      scheduleFlush();
      return result;
    } catch (e) {
      state = snapshot;
      dirty = dirtyBefore;
      txDepth -= 1;
      throw e;
    }
  }
  let resolveQueue;
  const previous = transactionChain;
  transactionChain = new Promise((resolve) => { resolveQueue = resolve; });
  await previous;
  const client = await pool.connect();
  txDepth += 1;
  try {
    await client.query('BEGIN');
    const result = await fn();
    const toFlush = new Set(dirty);
    await flushInTx(client, toFlush);
    await client.query('COMMIT');
    dirty.clear();
    return result;
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { txDepth -= 1; client.release(); resolveQueue(); }
}


export function getPool() { return pool; }
export async function withSqlTransaction(fn) {
  if (!pool) return fn(null);
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
  catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

export async function databaseHealth() {
  if (!pool) return { mode:'file', status:'ok' };
  try { const r = await pool.query('SELECT current_database() AS database'); return { mode:'postgres', status:'ok', database:r.rows[0].database }; }
  catch (error) { return { mode:'postgres', status:'down', error:error.message }; }
}

export const db = {
  get collection() { return state; },
  touch(...collectionsToWrite) {
    for (const collection of collectionsToWrite.flat()) {
      if (!collections.includes(collection)) throw new Error(`Unknown collection: ${collection}`);
      dirty.add(collection);
    }
    if (txDepth === 0) scheduleFlush();
  },
  save() {
    if (txDepth > 0) return Promise.resolve();
    scheduleFlush();
    return flushChain;
  },
  async flush() { await flushChain; },
  async close() { await flushChain; if (pool) await pool.end(); },
  reset() { state = structuredClone(empty); dirty = new Set(collections); if (txDepth === 0) this.save(); return state; },
  id() { return crypto.randomUUID(); },
  insert(collection,row) { state[collection].push(row); markDirty(collection); return row; },
  update(collection,id,patch) { const item=state[collection].find((x)=>x.id===id); if(!item) return null; Object.assign(item,patch); markDirty(collection); return item; },
};

export function seedBaseData() {
  if (state.categories.length) return;
  const now = new Date().toISOString();
  for (const [slug,name] of [['writing','نویسندگی و ترجمه'],['design','طراحی'],['development','برنامه‌نویسی'],['research','پژوهش'],['education','آموزش']]) db.insert('categories',{id:db.id(),slug,name,createdAt:now});
}
