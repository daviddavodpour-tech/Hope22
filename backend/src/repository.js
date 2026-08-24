import crypto from 'node:crypto';
import { getPool, withSqlTransaction } from './db.js';
import { config } from './config.js';

function requirePool() {
  const pool = getPool();
  if (!pool) throw new Error('SQL repository requires PostgreSQL');
  return pool;
}

const userSelect = `id,email,password_hash,password_hash AS "passwordHash",display_name AS "displayName",role,status,session_version,created_at AS "createdAt"`;

function userFromRow(r) {
  return { id:r.id, email:r.email, passwordHash:r.password_hash, displayName:r.displayName, role:r.role, status:r.status, sessionVersion:Number(r.session_version || 0), createdAt:r.createdAt?.toISOString?.() ?? r.createdAt };
}
function jobFromRow(r) {
  return { id:r.id, ownerId:r.owner_id, providerId:r.provider_id, title:r.title, description:r.description, categoryId:r.category_id, jobType:r.job_type, budgetType:r.budget_type, budgetMin:Number(r.budget_min), budgetMax:Number(r.budget_max), duration:r.duration, acceptanceCriteria:r.acceptance_criteria, status:r.status, city:r.city, createdAt:r.created_at?.toISOString?.() ?? r.created_at, updatedAt:r.updated_at?.toISOString?.() ?? r.updated_at, publishedAt:r.published_at ? (r.published_at.toISOString?.() ?? r.published_at) : null };
}
function offerFromRow(r) {
  return { id:r.id, jobId:r.job_id, providerId:r.provider_id, price:Number(r.price), message:r.message, status:r.status, createdAt:r.created_at?.toISOString?.() ?? r.created_at, updatedAt:r.updated_at?.toISOString?.() ?? r.updated_at };
}
function paymentFromRow(r) {
  return { id:r.id, jobId:r.job_id, payerId:r.payer_id, payeeId:r.payee_id, amount:Number(r.amount), status:r.status, providerRef:r.provider_ref, idempotencyKey:r.idempotency_key || '', createdAt:r.created_at?.toISOString?.() ?? r.created_at, updatedAt:r.updated_at?.toISOString?.() ?? r.updated_at };
}

export async function findUserByEmail(email) {
  const { rows } = await requirePool().query(`SELECT ${userSelect} FROM users WHERE email=$1`, [email]);
  return rows[0] ? userFromRow(rows[0]) : null;
}
export async function findUserById(id) {
  const { rows } = await requirePool().query(`SELECT ${userSelect} FROM users WHERE id=$1`, [id]);
  return rows[0] ? userFromRow(rows[0]) : null;
}
export async function createUserWithProvider(user, provider) {
  return withSqlTransaction(async (client) => {
    await client.query(`INSERT INTO users(id,email,password_hash,display_name,role,status,session_version,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [user.id,user.email,user.passwordHash,user.displayName,user.role,user.status,user.sessionVersion || 0,user.createdAt]);
    await client.query(`INSERT INTO providers(id,user_id,provider_type,capacity,verification_status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7)`, [provider.id,provider.userId,provider.providerType,provider.capacity,provider.verificationStatus,provider.createdAt,provider.updatedAt]);
    return user;
  });
}
export async function listCategories() {
  const { rows } = await requirePool().query(`SELECT id,slug,name,created_at AS "createdAt" FROM categories ORDER BY name`);
  return rows.map((r)=>({id:r.id,slug:r.slug,name:r.name,createdAt:r.createdAt?.toISOString?.() ?? r.createdAt}));
}
export async function findJobById(id, client = requirePool()) {
  const { rows } = await client.query(`SELECT * FROM jobs WHERE id=$1`, [id]);
  return rows[0] ? jobFromRow(rows[0]) : null;
}
export async function listJobs(status, userId = null) {
  const params = [status];
  let where = `status=$1`;
  if (userId) { params.push(userId); where += ` AND (owner_id=$2 OR provider_id=$2)`; }
  const { rows } = await requirePool().query(`SELECT * FROM jobs WHERE ${where} ORDER BY updated_at DESC`, params);
  return rows.map(jobFromRow);
}
export async function insertJob(job) {
  const { rows } = await requirePool().query(`INSERT INTO jobs(id,owner_id,provider_id,title,description,category_id,job_type,budget_type,budget_min,budget_max,duration,acceptance_criteria,status,city,created_at,updated_at,published_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`, [job.id,job.ownerId,job.providerId,job.title,job.description,job.categoryId,job.jobType,job.budgetType,job.budgetMin,job.budgetMax,job.duration,job.acceptanceCriteria,job.status,job.city,job.createdAt,job.updatedAt,job.publishedAt]);
  return jobFromRow(rows[0]);
}
export async function updateJobWithLock(id, expectedStatuses, patcher) {
  return withSqlTransaction(async (client) => {
    const job = await findJobById(id, client);
    if (!job) return null;
    if (!expectedStatuses.includes(job.status)) { const e = new Error('INVALID_STATE'); e.code='INVALID_STATE'; throw e; }
    const updated = await patcher(job, client);
    const fields = Object.keys(updated).filter((k)=>['providerId','status','updatedAt','publishedAt'].includes(k));
    const mapping = {providerId:'provider_id',status:'status',updatedAt:'updated_at',publishedAt:'published_at'};
    const sets = fields.map((k,i)=>`${mapping[k]}=$${i+2}`);
    if (sets.length) {
      const values=[id,...fields.map((k)=>updated[k])];
      const {rows}=await client.query(`UPDATE jobs SET ${sets.join(',')} WHERE id=$1 RETURNING *`, values);
      return jobFromRow(rows[0]);
    }
    return job;
  });
}
export async function findOffers(jobId, client = requirePool()) {
  const { rows } = await client.query(`SELECT * FROM offers WHERE job_id=$1 ORDER BY created_at ASC`, [jobId]);
  return rows.map(offerFromRow);
}
export async function findOfferById(id, client = requirePool()) {
  const { rows } = await client.query(`SELECT * FROM offers WHERE id=$1`, [id]);
  return rows[0] ? offerFromRow(rows[0]) : null;
}
export async function insertOffer(offer) {
  const { rows } = await requirePool().query(`INSERT INTO offers(id,job_id,provider_id,price,message,status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [offer.id,offer.jobId,offer.providerId,offer.price,offer.message,offer.status,offer.createdAt,offer.updatedAt]);
  return offerFromRow(rows[0]);
}

export async function insertRefreshToken(token) {
  const { rows } = await requirePool().query(`INSERT INTO refresh_tokens(id,user_id,token_hash,family_id,expires_at,created_at,revoked_at,replaced_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [token.id,token.userId,token.tokenHash,token.familyId,token.expiresAt,token.createdAt,token.revokedAt,token.replacedBy]);
  return { id:rows[0].id, userId:rows[0].user_id, tokenHash:rows[0].token_hash, familyId:rows[0].family_id, expiresAt:rows[0].expires_at?.toISOString?.() ?? rows[0].expires_at, createdAt:rows[0].created_at?.toISOString?.() ?? rows[0].created_at, revokedAt:rows[0].revoked_at ? (rows[0].revoked_at.toISOString?.() ?? rows[0].revoked_at) : null, replacedBy:rows[0].replaced_by };
}
export async function findRefreshTokenByHash(tokenHash) {
  const { rows } = await requirePool().query(`SELECT * FROM refresh_tokens WHERE token_hash=$1`, [tokenHash]);
  const r=rows[0];
  return r ? { id:r.id,userId:r.user_id,tokenHash:r.token_hash,familyId:r.family_id,expiresAt:r.expires_at?.toISOString?.() ?? r.expires_at,createdAt:r.created_at?.toISOString?.() ?? r.created_at,revokedAt:r.revoked_at ? (r.revoked_at.toISOString?.() ?? r.revoked_at) : null,replacedBy:r.replaced_by } : null;
}
export async function rotateRefreshToken(oldHash, nextToken, familyId) {
  return withSqlTransaction(async (client)=>{
    const {rows}=await client.query(`SELECT * FROM refresh_tokens WHERE token_hash=$1 FOR UPDATE`,[oldHash]);
    const r=rows[0];
    if(!r) return {kind:'invalid'};
    if(r.revoked_at){
      await client.query(`UPDATE refresh_tokens SET revoked_at=COALESCE(revoked_at,NOW()) WHERE family_id=$1 AND revoked_at IS NULL`,[r.family_id]);
      return {kind:'reuse'};
    }
    if(new Date(r.expires_at).getTime()<=Date.now()) return {kind:'invalid'};
    const {rows:users}=await client.query(`SELECT ${userSelect} FROM users WHERE id=$1`,[r.user_id]);
    const user=users[0]?userFromRow(users[0]):null;
    if(!user) return {kind:'invalid'};
    await client.query(`UPDATE refresh_tokens SET revoked_at=NOW(), replaced_by=$2 WHERE id=$1`,[r.id,nextToken.tokenHash]);
    const {rows:created}=await client.query(`INSERT INTO refresh_tokens(id,user_id,token_hash,family_id,expires_at,created_at,revoked_at,replaced_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[nextToken.id,user.id,nextToken.tokenHash,familyId,nextToken.expiresAt,nextToken.createdAt,null,null]);
    return {kind:'ok',user,token:{id:created[0].id,userId:created[0].user_id,tokenHash:created[0].token_hash,familyId:created[0].family_id,expiresAt:created[0].expires_at?.toISOString?.() ?? created[0].expires_at,createdAt:created[0].created_at?.toISOString?.() ?? created[0].created_at,revokedAt:null,replacedBy:null}};
  });
}
export async function revokeRefreshFamily(familyId) {
  await requirePool().query(`UPDATE refresh_tokens SET revoked_at=COALESCE(revoked_at,NOW()) WHERE family_id=$1 AND revoked_at IS NULL`,[familyId]);
}
export async function bumpUserSessionVersion(userId) {
  const { rows } = await requirePool().query(`UPDATE users SET session_version=session_version+1 WHERE id=$1 RETURNING session_version`, [userId]);
  return rows[0] ? Number(rows[0].session_version) : null;
}

export async function revokeUserRefreshTokens(userId) {
  await requirePool().query(`UPDATE refresh_tokens SET revoked_at=COALESCE(revoked_at,NOW()) WHERE user_id=$1 AND revoked_at IS NULL`,[userId]);
}
export async function insertResetToken(token) {
  const {rows}=await requirePool().query(`INSERT INTO reset_tokens(id,user_id,token_hash,family_id,expires_at,used_at,created_at) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[token.id,token.userId,token.tokenHash,token.familyId,token.expiresAt,null,token.createdAt]);
  return rows[0];
}
export async function findResetTokenForUse(tokenHash) {
  return withSqlTransaction(async(client)=>{
    const {rows}=await client.query(`SELECT * FROM reset_tokens WHERE token_hash=$1 FOR UPDATE`,[tokenHash]);
    const r=rows[0]; if(!r || r.used_at || new Date(r.expires_at).getTime()<=Date.now()) return null;
    const {rows:u}=await client.query(`SELECT ${userSelect} FROM users WHERE id=$1`,[r.user_id]);
    return u[0]?{token:{id:r.id,userId:r.user_id,tokenHash:r.token_hash,expiresAt:r.expires_at?.toISOString?.() ?? r.expires_at,familyId:r.family_id},user:userFromRow(u[0])}:null;
  });
}
export async function consumeResetTokenAndChangePassword(tokenId,userId,passwordHash) {
  return withSqlTransaction(async(client)=>{
    const {rows}=await client.query(`UPDATE reset_tokens SET used_at=NOW() WHERE id=$1 AND user_id=$2 AND used_at IS NULL RETURNING id`,[tokenId,userId]);
    if(!rows[0]) return false;
    await client.query(`UPDATE users SET password_hash=$2,session_version=session_version+1 WHERE id=$1`,[userId,passwordHash]);
    await client.query(`UPDATE refresh_tokens SET revoked_at=COALESCE(revoked_at,NOW()) WHERE user_id=$1 AND revoked_at IS NULL`,[userId]);
    return true;
  });
}
export async function findProviderByUserId(userId) {
  const {rows}=await requirePool().query(`SELECT * FROM providers WHERE user_id=$1`,[userId]);
  const r=rows[0]; return r?{id:r.id,userId:r.user_id,providerType:r.provider_type,capacity:r.capacity,verificationStatus:r.verification_status,createdAt:r.created_at?.toISOString?.() ?? r.created_at,updatedAt:r.updated_at?.toISOString?.() ?? r.updated_at}:null;
}
export async function upsertProvider(provider) {
  const {rows}=await requirePool().query(`INSERT INTO providers(id,user_id,provider_type,capacity,verification_status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(user_id) DO UPDATE SET provider_type=EXCLUDED.provider_type,capacity=EXCLUDED.capacity,verification_status=EXCLUDED.verification_status,updated_at=EXCLUDED.updated_at RETURNING *`,[provider.id,provider.userId,provider.providerType,provider.capacity,provider.verificationStatus,provider.createdAt,provider.updatedAt]);
  const r=rows[0]; return {id:r.id,userId:r.user_id,providerType:r.provider_type,capacity:r.capacity,verificationStatus:r.verification_status,createdAt:r.created_at?.toISOString?.() ?? r.created_at,updatedAt:r.updated_at?.toISOString?.() ?? r.updated_at};
}
export async function insertUpload(upload) { const {rows}=await requirePool().query(`INSERT INTO uploads(id,storage_key,uploaded_by,content_type,size,created_at) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[upload.id,upload.storageKey,upload.uploadedBy,upload.contentType,upload.size,upload.createdAt]); const r=rows[0]; return {id:r.id,storageKey:r.storage_key,uploadedBy:r.uploaded_by,contentType:r.content_type,size:r.size,createdAt:r.created_at?.toISOString?.() ?? r.created_at}; }
export async function findUploadByKey(key, client=requirePool()) {
  const {rows}=await client.query(`SELECT * FROM uploads WHERE storage_key=$1`,[key]); const r=rows[0]; return r?{id:r.id,storageKey:r.storage_key,uploadedBy:r.uploaded_by,contentType:r.content_type,size:r.size,createdAt:r.created_at?.toISOString?.() ?? r.created_at}:null;
}
export async function createUploadIntent(intent) {
  const {rows}=await requirePool().query(`INSERT INTO upload_intents(id,storage_key,uploaded_by,content_type,expires_at,created_at) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[intent.id,intent.storageKey,intent.uploadedBy,intent.contentType,intent.expiresAt,intent.createdAt]); const r=rows[0]; return {id:r.id,storageKey:r.storage_key,uploadedBy:r.uploaded_by,contentType:r.content_type,expiresAt:r.expires_at?.toISOString?.() ?? r.expires_at,createdAt:r.created_at?.toISOString?.() ?? r.created_at};
}
export async function findUploadIntentForUpdate(key,client= requirePool()) {
  const {rows}=await client.query(`SELECT * FROM upload_intents WHERE storage_key=$1 FOR UPDATE`,[key]); const r=rows[0]; return r?{id:r.id,storageKey:r.storage_key,uploadedBy:r.uploaded_by,contentType:r.content_type,expiresAt:r.expires_at?.toISOString?.() ?? r.expires_at,createdAt:r.created_at?.toISOString?.() ?? r.created_at}:null;
}
export async function completeUploadAtomic({intentId,key,userId,contentType,size,createdAt}) {
  return withSqlTransaction(async(client)=>{
    const {rows:ir}=await client.query(`SELECT * FROM upload_intents WHERE id=$1 AND storage_key=$2 FOR UPDATE`,[intentId,key]); const i=ir[0];
    if(!i || i.uploaded_by!==userId || i.content_type!==contentType || new Date(i.expires_at).getTime()<=Date.now()){const e=new Error('INVALID_UPLOAD_INTENT');e.code='INVALID_UPLOAD_INTENT';throw e;}
    const {rows:existing}=await client.query(`SELECT * FROM uploads WHERE storage_key=$1`,[key]); if(existing[0]){await client.query(`DELETE FROM upload_intents WHERE id=$1`,[intentId]); return {existing:true,upload:{id:existing[0].id,storageKey:existing[0].storage_key,uploadedBy:existing[0].uploaded_by,contentType:existing[0].content_type,size:existing[0].size,createdAt:existing[0].created_at?.toISOString?.() ?? existing[0].created_at}};}
    const {rows}=await client.query(`INSERT INTO uploads(id,storage_key,uploaded_by,content_type,size,created_at) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[crypto.randomUUID(),key,userId,contentType,size,createdAt]);
    await client.query(`DELETE FROM upload_intents WHERE id=$1`,[intentId]); const r=rows[0]; return {existing:false,upload:{id:r.id,storageKey:r.storage_key,uploadedBy:r.uploaded_by,contentType:r.content_type,size:r.size,createdAt:r.created_at?.toISOString?.() ?? r.created_at}};
  });
}
export async function insertAudit(audit) {
  await requirePool().query(`INSERT INTO audit_logs(id,action,actor_id,entity_type,entity_id,meta,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)`,[audit.id,audit.action,audit.actorId,audit.entityType,audit.entityId,audit.meta||{},audit.createdAt]);
}
export async function insertEvidence(evidence) {
  const {rows}=await requirePool().query(`INSERT INTO evidence(id,job_id,submitted_by,uri,notes,type,created_at) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[evidence.id,evidence.jobId,evidence.submittedBy,evidence.uri,evidence.notes,evidence.type,evidence.createdAt]);
  const r=rows[0]; return {id:r.id,jobId:r.job_id,submittedBy:r.submitted_by,uri:r.uri,notes:r.notes,type:r.type,createdAt:r.created_at?.toISOString?.() ?? r.created_at};
}
export async function insertEvidenceAndTouchJob(evidence) {
  return withSqlTransaction(async (client) => {
    const { rows: jr } = await client.query(`SELECT * FROM jobs WHERE id=$1 FOR UPDATE`, [evidence.jobId]);
    if (!jr[0]) return null;
    const job = jobFromRow(jr[0]);
    if (job.providerId !== evidence.submittedBy || !['IN_PROGRESS'].includes(job.status)) {
      const e = new Error('INVALID_STATE'); e.code = 'INVALID_STATE'; throw e;
    }
    if (evidence.storageKey) {
      const { rows: ur } = await client.query(`SELECT id FROM uploads WHERE storage_key=$1 AND uploaded_by=$2`, [evidence.storageKey, evidence.submittedBy]);
      if (!ur[0]) { const e = new Error('INVALID_STORAGE_REFERENCE'); e.code = 'INVALID_STORAGE_REFERENCE'; throw e; }
    }
    const { rows } = await client.query(`INSERT INTO evidence(id,job_id,submitted_by,uri,notes,type,created_at) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [evidence.id,evidence.jobId,evidence.submittedBy,evidence.uri,evidence.notes,evidence.type,evidence.createdAt]);
    await client.query(`UPDATE jobs SET updated_at=$2 WHERE id=$1`, [evidence.jobId,evidence.createdAt]);
    const r = rows[0];
    return {id:r.id,jobId:r.job_id,submittedBy:r.submitted_by,uri:r.uri,notes:r.notes,type:r.type,createdAt:r.created_at?.toISOString?.() ?? r.created_at};
  });
}
export async function listOffersForJob(jobId) {
  const {rows}=await requirePool().query(`SELECT * FROM offers WHERE job_id=$1 ORDER BY created_at ASC`,[jobId]); return rows.map(offerFromRow);
}
export async function findPendingOffer(jobId,providerId) {
  const {rows}=await requirePool().query(`SELECT * FROM offers WHERE job_id=$1 AND provider_id=$2 AND status='PENDING' LIMIT 1`,[jobId,providerId]); return rows[0]?offerFromRow(rows[0]):null;
}
export async function findPaymentById(paymentId, client=requirePool()) {
  const {rows}=await client.query(`SELECT * FROM payments WHERE id=$1`,[paymentId]); return rows[0]?paymentFromRow(rows[0]):null;
}
export async function updateJobSimple(id,expectedStatuses,patch) {
  return withSqlTransaction(async(client)=>{
    const {rows}=await client.query(`SELECT * FROM jobs WHERE id=$1 FOR UPDATE`,[id]); if(!rows[0]) return null; const job=jobFromRow(rows[0]);
    if(!expectedStatuses.includes(job.status)){const e=new Error('INVALID_STATE');e.code='INVALID_STATE';throw e;}
    const allowed={providerId:'provider_id',status:'status',updatedAt:'updated_at',publishedAt:'published_at'}; const fields=Object.keys(patch).filter(k=>allowed[k]);
    if(!fields.length) return job;
    const values=[id,...fields.map(k=>patch[k])]; const sets=fields.map((k,i)=>`${allowed[k]}=$${i+2}`);
    const {rows:updated}=await client.query(`UPDATE jobs SET ${sets.join(',')} WHERE id=$1 RETURNING *`,values); return jobFromRow(updated[0]);
  });
}
export async function transitionJobWithPayment(id,expectedStatuses,jobPatch,paymentStatus) {
  return withSqlTransaction(async(client)=>{
    const {rows}=await client.query(`SELECT * FROM jobs WHERE id=$1 FOR UPDATE`,[id]); if(!rows[0]) return null; const job=jobFromRow(rows[0]);
    if(!expectedStatuses.includes(job.status)){const e=new Error('INVALID_STATE');e.code='INVALID_STATE';throw e;}
    const {rows:p}=await client.query(`SELECT * FROM payments WHERE job_id=$1 FOR UPDATE`,[id]); const payment=p[0]?paymentFromRow(p[0]):null;
    if(!payment || (paymentStatus && payment.status!==paymentStatus)){const e=new Error('INVALID_PAYMENT_STATE');e.code='INVALID_PAYMENT_STATE';throw e;}
    const allowed={status:'status',updatedAt:'updated_at'}; const fields=Object.keys(jobPatch).filter(k=>allowed[k]); const vals=[id,...fields.map(k=>jobPatch[k])]; const sets=fields.map((k,i)=>`${allowed[k]}=$${i+2}`);
    const {rows:uj}=await client.query(`UPDATE jobs SET ${sets.join(',')} WHERE id=$1 RETURNING *`,vals);
    const {rows:up}=await client.query(`UPDATE payments SET status=$2,updated_at=NOW() WHERE id=$1 RETURNING *`,[payment.id,paymentStatus==='HELD'?'RELEASE_PENDING':paymentStatus]);
    return {job:jobFromRow(uj[0]),payment:paymentFromRow(up[0])};
  });
}

export async function acceptOffer(offerId, ownerId) {
  return withSqlTransaction(async (client) => {
    const offer = await findOfferById(offerId, client);
    if (!offer) return null;
    // BUG FIX: the job row must be locked (SELECT ... FOR UPDATE) BEFORE
    // its status is checked, not after. The previous version read job.status
    // via a plain, non-locking findJobById(), decided PUBLISHED was fine,
    // and only then acquired the lock -- so two concurrent "accept a
    // different offer on the same job" transactions could both pass the
    // PUBLISHED check before either committed, then both proceed to assign
    // the job (to two different offers/providers) once the lock freed up
    // in turn. This mirrors the correct lock-then-check order already used
    // by fundJobAtomic()/releasePaymentAtomic() below.
    const { rows: jobRows } = await client.query(`SELECT * FROM jobs WHERE id=$1 FOR UPDATE`, [offer.jobId]);
    if (!jobRows[0]) return null;
    const job = jobFromRow(jobRows[0]);
    if (job.ownerId !== ownerId) { const e = new Error('FORBIDDEN'); e.code='FORBIDDEN'; throw e; }
    if (job.status !== 'PUBLISHED') { const e = new Error('INVALID_STATE'); e.code='INVALID_STATE'; throw e; }
    // Re-check the offer itself under the same lock: another request could
    // have accepted/withdrawn it while this one waited for the job lock.
    const { rows: offerRows } = await client.query(`SELECT * FROM offers WHERE id=$1 FOR UPDATE`, [offer.id]);
    const current = offerRows[0] ? offerFromRow(offerRows[0]) : null;
    if (!current || current.status !== 'PENDING') { const e = new Error('INVALID_STATE'); e.code='INVALID_STATE'; throw e; }
    await client.query(`UPDATE offers SET status='ACCEPTED',updated_at=NOW() WHERE id=$1`, [offer.id]);
    await client.query(`UPDATE offers SET status='REJECTED',updated_at=NOW() WHERE job_id=$1 AND id<>$2 AND status='PENDING'`, [job.id,offer.id]);
    const {rows}=await client.query(`UPDATE jobs SET provider_id=$2,status='ASSIGNED',updated_at=NOW() WHERE id=$1 RETURNING *`, [job.id,offer.providerId]);
    return { offer: (await findOfferById(offer.id,client)), job: jobFromRow(rows[0]) };
  });
}
export async function findPaymentByJob(jobId, client = requirePool()) {
  const { rows } = await client.query(`SELECT * FROM payments WHERE job_id=$1`, [jobId]);
  return rows[0] ? paymentFromRow(rows[0]) : null;
}
export async function findPaymentByIdempotency(payerId, key, client = requirePool()) {
  const { rows } = await client.query(`SELECT * FROM payments WHERE payer_id=$1 AND idempotency_key=$2`, [payerId,key]);
  return rows[0] ? paymentFromRow(rows[0]) : null;
}
export async function fundJobAtomic({jobId,payerId,payeeId,offerId=null,amount,id,idempotencyKey,createdAt}) {
  return withSqlTransaction(async (client) => {
    const {rows:jobRows}=await client.query(`SELECT * FROM jobs WHERE id=$1 FOR UPDATE`, [jobId]);
    const job=jobRows[0] ? jobFromRow(jobRows[0]) : null;
    if (!job) return null;
    if (job.ownerId !== payerId) { const e=new Error('FORBIDDEN');e.code='FORBIDDEN';throw e; }
    if (!['PUBLISHED','ASSIGNED','FUNDED'].includes(job.status)) { const e=new Error('INVALID_STATE');e.code='INVALID_STATE';throw e; }
    const existingRow = await client.query(`SELECT * FROM payments WHERE job_id=$1 FOR UPDATE`, [jobId]);
    if (existingRow.rows[0]) {
      const existing=paymentFromRow(existingRow.rows[0]);
      if (existing.idempotencyKey && idempotencyKey && existing.idempotencyKey !== idempotencyKey) { const e=new Error('PAYMENT_ALREADY_EXISTS');e.code='PAYMENT_ALREADY_EXISTS';throw e; }
      if (existing.status === 'HOLD_FAILED') {
        await client.query(`UPDATE payments SET status='HOLD_PENDING',idempotency_key=COALESCE(NULLIF(idempotency_key,''),NULLIF($3,'')),updated_at=$2 WHERE id=$1`, [existing.id,createdAt,idempotencyKey || null]);
        const {rows:ev}=await client.query(`
          INSERT INTO outbox_events(id,event_type,aggregate_type,aggregate_id,dedupe_key,payload,status,attempts,available_at,created_at)
          VALUES(gen_random_uuid(),'PAYMENT_CREATE_HOLD','payment',$1,$2,$3::jsonb,'PENDING',0,NOW(),NOW())
          ON CONFLICT(dedupe_key) DO UPDATE SET status='PENDING',available_at=NOW(),locked_at=NULL,last_error=NULL,processed_at=NULL
          RETURNING *`,
          [existing.id, `PAYMENT_CREATE_HOLD:${existing.id}`, JSON.stringify({ jobId, ownerId:payerId, paymentId:existing.id, amount:existing.amount, currency:config.paymentCurrency, idempotencyKey:existing.idempotencyKey || idempotencyKey || `payment:${existing.id}` })]);
        return { payment:{...existing,status:'HOLD_PENDING',updatedAt:createdAt.toISOString?.() ?? createdAt}, job, outboxEvent:{id:ev[0].id,status:ev[0].status}, retry:true };
      }
      return {payment:existing,job,outboxEvent:null,created:false};
    }
    if (idempotencyKey) {
      const prior=await findPaymentByIdempotency(payerId,idempotencyKey,client);
      if (prior) {
        if (prior.jobId !== jobId || Number(prior.amount) !== Number(amount)) { const e=new Error('IDEMPOTENCY_CONFLICT'); e.code='IDEMPOTENCY_CONFLICT'; throw e; }
        return {payment:prior,job,outboxEvent:null,created:false};
      }
    }
    if (offerId) {
      const {rows:offerRows}=await client.query(`SELECT * FROM offers WHERE id=$1 AND job_id=$2 FOR UPDATE`, [offerId,jobId]);
      const selected=offerRows[0];
      if (!selected || selected.status !== 'PENDING' || selected.provider_id !== payeeId) { const e=new Error('INVALID_OFFER_STATE');e.code='INVALID_OFFER_STATE';throw e; }
      await client.query(`UPDATE offers SET status='ACCEPTED',updated_at=NOW() WHERE id=$1`, [offerId]);
      await client.query(`UPDATE offers SET status='REJECTED',updated_at=NOW() WHERE job_id=$1 AND id<>$2 AND status='PENDING'`, [jobId,offerId]);
    }
    const placeholderRef = `PENDING:${id}`;
    const {rows}=await client.query(`INSERT INTO payments(id,job_id,payer_id,payee_id,amount,status,provider_ref,idempotency_key,created_at,updated_at) VALUES($1,$2,$3,$4,$5,'HOLD_PENDING',$6,$7,$8,$8) RETURNING *`, [id,jobId,payerId,payeeId,amount,placeholderRef,idempotencyKey || null,createdAt]);
    const {rows:job2}=await client.query(`UPDATE jobs SET status='FUNDED',updated_at=$2,provider_id=COALESCE(provider_id,$3) WHERE id=$1 RETURNING *`, [jobId,createdAt,payeeId]);
    const {rows:ev}=await client.query(`
      INSERT INTO outbox_events(id,event_type,aggregate_type,aggregate_id,dedupe_key,payload,status,attempts,available_at,created_at)
      VALUES(gen_random_uuid(),'PAYMENT_CREATE_HOLD','payment',$1,$2,$3::jsonb,'PENDING',0,NOW(),NOW())
      RETURNING *`,
      [id, `PAYMENT_CREATE_HOLD:${id}`, JSON.stringify({ jobId, ownerId:payerId, paymentId:id, amount:Number(amount), currency:config.paymentCurrency, idempotencyKey:idempotencyKey || `payment:${id}` })]);
    await client.query(`INSERT INTO audit_logs(id,action,actor_id,entity_type,entity_id,meta,created_at) VALUES($1,'PAYMENT_FUND',$2,'payment',$3,$4::jsonb,$5)`, [crypto.randomUUID(), payerId, id, JSON.stringify({jobId,outboxEventId:ev[0].id}), createdAt]);
    return {payment:paymentFromRow(rows[0]),job:jobFromRow(job2[0]),outboxEvent:{id:ev[0].id,status:ev[0].status},created:true};
  });
}

export async function completePaymentCreateHoldOutbox({ eventId, jobId, paymentId, providerRef, actorId }) {
  return withSqlTransaction(async (client) => {
    const { rows: er } = await client.query(`SELECT * FROM outbox_events WHERE id=$1 FOR UPDATE`, [eventId]);
    if (!er[0]) return { completed:false, reason:'OUTBOX_NOT_FOUND' };
    const { rows: pr } = await client.query(`SELECT * FROM payments WHERE id=$1 AND job_id=$2 FOR UPDATE`, [paymentId, jobId]);
    const payment = pr[0];
    if (!payment) return { completed:false, reason:'PAYMENT_NOT_FOUND' };
    if (payment.status === 'HELD') {
      if (payment.provider_ref !== providerRef) {
        const e = new Error('PROVIDER_REF_MISMATCH'); e.code = 'PROVIDER_REF_MISMATCH'; throw e;
      }
      await client.query(`UPDATE outbox_events SET status='DONE',processed_at=COALESCE(processed_at,NOW()),locked_at=NULL,last_error=NULL WHERE id=$1`, [eventId]);
      return { completed:true, alreadyDone:true };
    }
    if (payment.status !== 'HOLD_PENDING') return { completed:false, reason:'INVALID_PAYMENT_STATE' };
    await client.query(`UPDATE payments SET status='HELD',provider_ref=$2,updated_at=NOW() WHERE id=$1`, [paymentId, providerRef]);
    await client.query(`INSERT INTO audit_logs(id,action,actor_id,entity_type,entity_id,meta,created_at) VALUES($1,'PAYMENT_HOLD_CONFIRMED',$2,'payment',$3,$4::jsonb,NOW())`, [crypto.randomUUID(), actorId, paymentId, JSON.stringify({ jobId, outboxEventId:eventId, providerRef })]);
    await client.query(`UPDATE outbox_events SET status='DONE',processed_at=NOW(),locked_at=NULL,last_error=NULL WHERE id=$1`, [eventId]);
    return { completed:true, alreadyDone:false };
  });
}

export async function releasePaymentAtomic(jobId, ownerId) {
  return withSqlTransaction(async (client)=>{
    const {rows:jr}=await client.query(`SELECT * FROM jobs WHERE id=$1 FOR UPDATE`,[jobId]);
    if (!jr[0]) return null;
    const job=jobFromRow(jr[0]);
    if(job.ownerId!==ownerId){const e=new Error('FORBIDDEN');e.code='FORBIDDEN';throw e;}
    if(job.status!=='COMPLETED'){const e=new Error('INVALID_STATE');e.code='INVALID_STATE';throw e;}
    const payment=await findPaymentByJob(jobId,client);
    if(!payment||payment.status!=='RELEASE_PENDING'){const e=new Error('INVALID_PAYMENT_STATE');e.code='INVALID_PAYMENT_STATE';throw e;}
    const {rows}=await client.query(`UPDATE payments SET status='RELEASED',updated_at=NOW() WHERE id=$1 RETURNING *`,[payment.id]);
    const {rows:jobRows}=await client.query(`UPDATE jobs SET status='SETTLED',updated_at=NOW() WHERE id=$1 RETURNING *`,[jobId]);
    return {payment:paymentFromRow(rows[0]),job:jobFromRow(jobRows[0])};
  });
}

export async function enqueuePaymentRelease({ jobId, ownerId, paymentId, dedupeKey }) {
  return withSqlTransaction(async (client) => {
    const { rows: jr } = await client.query(`SELECT * FROM jobs WHERE id=$1 FOR UPDATE`, [jobId]);
    const job = jr[0];
    if (!job) return null;
    if (job.owner_id !== ownerId) { const e=new Error('FORBIDDEN'); e.code='FORBIDDEN'; throw e; }
    if (job.status !== 'COMPLETED') { const e=new Error('INVALID_STATE'); e.code='INVALID_STATE'; throw e; }
    const { rows: pr } = await client.query(`SELECT * FROM payments WHERE id=$1 AND job_id=$2 FOR UPDATE`, [paymentId, jobId]);
    const payment = pr[0];
    if (!payment || payment.status !== 'RELEASE_PENDING') { const e=new Error('INVALID_PAYMENT_STATE'); e.code='INVALID_PAYMENT_STATE'; throw e; }
    const { rows } = await client.query(
      `INSERT INTO outbox_events(id,event_type,aggregate_type,aggregate_id,dedupe_key,payload,status,attempts,available_at,created_at)
       VALUES(gen_random_uuid(),'PAYMENT_RELEASE','payment',$1,$2,$3::jsonb,'PENDING',0,NOW(),NOW())
       ON CONFLICT(dedupe_key) DO UPDATE SET
         status=CASE WHEN outbox_events.status='DONE' THEN outbox_events.status ELSE 'PENDING' END,
         attempts=CASE WHEN outbox_events.status='DONE' THEN outbox_events.attempts ELSE 0 END,
         available_at=CASE WHEN outbox_events.status='DONE' THEN outbox_events.available_at ELSE NOW() END,
         locked_at=CASE WHEN outbox_events.status='DONE' THEN outbox_events.locked_at ELSE NULL END,
         last_error=CASE WHEN outbox_events.status='DONE' THEN outbox_events.last_error ELSE NULL END,
         processed_at=CASE WHEN outbox_events.status='DONE' THEN outbox_events.processed_at ELSE NULL END
       RETURNING *`,
      [paymentId, dedupeKey, JSON.stringify({ jobId, ownerId, paymentId, providerRef: payment.provider_ref, idempotencyKey: payment.idempotency_key || `payment-release:${paymentId}` })]
    );
    return { id: rows[0].id, status: rows[0].status, paymentId, jobId };
  });
}

export async function getOutboxEvent(id) {
  const { rows } = await requirePool().query(`SELECT * FROM outbox_events WHERE id=$1`, [id]);
  return rows[0] ? rows[0] : null;
}

export async function claimOutboxEvent(leaseSeconds = 60) {
  return withSqlTransaction(async (client) => {
    const { rows } = await client.query(
      `WITH candidate AS (
         SELECT id FROM outbox_events
         WHERE status IN ('PENDING','PROCESSING')
           AND (status='PENDING' OR locked_at < NOW() - make_interval(secs => $1))
           AND available_at <= NOW()
         ORDER BY created_at
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       UPDATE outbox_events o
       SET status='PROCESSING', attempts=o.attempts+1, locked_at=NOW()
       FROM candidate c
       WHERE o.id=c.id
       RETURNING o.*`, [leaseSeconds]);
    return rows[0] || null;
  });
}

export async function completePaymentReleaseOutbox({ eventId, jobId, paymentId, actorId }) {
  return withSqlTransaction(async (client) => {
    const { rows: er } = await client.query(`SELECT * FROM outbox_events WHERE id=$1 FOR UPDATE`, [eventId]);
    if (!er[0]) return { completed:false, reason:'OUTBOX_NOT_FOUND' };
    const { rows: pr } = await client.query(`SELECT * FROM payments WHERE id=$1 AND job_id=$2 FOR UPDATE`, [paymentId, jobId]);
    const payment = pr[0];
    if (!payment) return { completed:false, reason:'PAYMENT_NOT_FOUND' };
    if (payment.status === 'RELEASED') {
      await client.query(`UPDATE outbox_events SET status='DONE',processed_at=COALESCE(processed_at,NOW()),locked_at=NULL,last_error=NULL WHERE id=$1`, [eventId]);
      return { completed:true, alreadyDone:true };
    }
    if (payment.status !== 'RELEASE_PENDING') return { completed:false, reason:'INVALID_PAYMENT_STATE' };
    await client.query(`UPDATE payments SET status='RELEASED',updated_at=NOW() WHERE id=$1`, [paymentId]);
    await client.query(`UPDATE jobs SET status='SETTLED',updated_at=NOW() WHERE id=$1`, [jobId]);
    await client.query(`INSERT INTO audit_logs(id,action,actor_id,entity_type,entity_id,meta,created_at) VALUES($1,'PAYMENT_RELEASE',$2,'payment',$3,$4::jsonb,NOW())`, [crypto.randomUUID(), actorId, paymentId, JSON.stringify({ jobId, outboxEventId:eventId })]);
    await client.query(`UPDATE outbox_events SET status='DONE',processed_at=NOW(),locked_at=NULL,last_error=NULL WHERE id=$1`, [eventId]);
    return { completed:true, alreadyDone:false };
  });
}

export async function failOutboxEvent({ eventId, error, maxAttempts, backoffSeconds = 5 }) {
  return withSqlTransaction(async (client) => {
    const { rows } = await client.query(`SELECT attempts FROM outbox_events WHERE id=$1 FOR UPDATE`, [eventId]);
    if (!rows[0]) return null;
    const attempts = Number(rows[0].attempts || 0);
    const terminal = attempts >= maxAttempts;
    const nextStatus = terminal ? 'FAILED' : 'PENDING';
    await client.query(
      `UPDATE outbox_events SET status=$2,available_at=NOW()+make_interval(secs => $3),locked_at=NULL,last_error=$4 WHERE id=$1`,
      [eventId, nextStatus, terminal ? 0 : Math.min(300, backoffSeconds * Math.pow(2, Math.max(0, attempts-1))), String(error).slice(0,2000)]
    );
    if (terminal) {
      await client.query(`UPDATE payments p SET status='HOLD_FAILED',updated_at=NOW() FROM outbox_events o WHERE o.id=$1 AND o.event_type='PAYMENT_CREATE_HOLD' AND p.id=o.aggregate_id AND p.status='HOLD_PENDING'`, [eventId]);
    }
    return { terminal, attempts };
  });
}

export async function findCategoryByIdOrSlug(value) {
  const { rows } = await requirePool().query(`SELECT id,slug,name,created_at FROM categories WHERE id::text=$1 OR slug=$1 LIMIT 1`, [String(value)]);
  const r=rows[0]; return r ? { id:r.id, slug:r.slug, name:r.name, createdAt:r.created_at?.toISOString?.() ?? r.created_at } : null;
}

export async function listJobViews({ status, userId = null }) {
  const params=[status];
  let where=`j.status=$1`;
  if(userId){ params.push(userId); where += ` AND (j.owner_id=$2 OR j.provider_id=$2)`; }
  const { rows } = await requirePool().query(
    `SELECT j.*, c.name AS category_name,
            ou.display_name AS owner_display_name, ou.role AS owner_role,
            pu.display_name AS provider_display_name, pu.role AS provider_role,
            COUNT(o.id)::int AS offer_count
       FROM jobs j
       JOIN categories c ON c.id=j.category_id
       JOIN users ou ON ou.id=j.owner_id
       LEFT JOIN users pu ON pu.id=j.provider_id
       LEFT JOIN offers o ON o.job_id=j.id
      WHERE ${where}
      GROUP BY j.id,c.name,ou.display_name,ou.role,pu.display_name,pu.role
      ORDER BY j.updated_at DESC`, params);
  return rows.map(r=>({
    job:jobFromRow(r),
    category:r.category_name,
    owner:r.owner_display_name ? {id:r.owner_id,displayName:r.owner_display_name,role:r.owner_role} : null,
    provider:r.provider_display_name ? {id:r.provider_id,displayName:r.provider_display_name,role:r.provider_role} : null,
    offerCount:Number(r.offer_count||0),
  }));
}

export async function listMyJobViews(userId) {
  const { rows } = await requirePool().query(
    `SELECT j.*, c.name AS category_name,
            ou.display_name AS owner_display_name, ou.role AS owner_role,
            pu.display_name AS provider_display_name, pu.role AS provider_role,
            COUNT(DISTINCT o.id)::int AS offer_count,
            p.id AS payment_id,p.status AS payment_status,p.amount AS payment_amount,p.provider_ref AS payment_provider_ref,
            p.created_at AS payment_created_at,p.updated_at AS payment_updated_at,p.idempotency_key AS payment_idempotency_key
       FROM jobs j
       JOIN categories c ON c.id=j.category_id
       JOIN users ou ON ou.id=j.owner_id
       LEFT JOIN users pu ON pu.id=j.provider_id
       LEFT JOIN offers o ON o.job_id=j.id
       LEFT JOIN payments p ON p.job_id=j.id
      WHERE j.owner_id=$1 OR j.provider_id=$1
      GROUP BY j.id,c.name,ou.display_name,ou.role,pu.display_name,pu.role,p.id
      ORDER BY j.updated_at DESC`, [userId]);
  return rows.map(r=>({
    job:jobFromRow(r), category:r.category_name,
    owner:r.owner_display_name?{id:r.owner_id,displayName:r.owner_display_name,role:r.owner_role}:null,
    provider:r.provider_display_name?{id:r.provider_id,displayName:r.provider_display_name,role:r.provider_role}:null,
    offerCount:Number(r.offer_count||0),
    payment:r.payment_id?paymentFromRow({id:r.payment_id,job_id:r.id,payer_id:null,payee_id:null,amount:r.payment_amount,status:r.payment_status,provider_ref:r.payment_provider_ref,idempotency_key:r.payment_idempotency_key,created_at:r.payment_created_at,updated_at:r.payment_updated_at}):null,
  }));
}

export async function listOfferViewsForJob(jobId) {
  const { rows } = await requirePool().query(
    `SELECT o.*, u.display_name AS provider_display_name, u.role AS provider_role
       FROM offers o JOIN users u ON u.id=o.provider_id
      WHERE o.job_id=$1 ORDER BY o.created_at ASC`, [jobId]);
  return rows.map(o=>({
    id:o.id,jobId:o.job_id,providerId:o.provider_id,price:Number(o.price),message:o.message,status:o.status,
    createdAt:o.created_at?.toISOString?.() ?? o.created_at,updatedAt:o.updated_at?.toISOString?.() ?? o.updated_at,
    provider:o.provider_display_name?{id:o.provider_id,displayName:o.provider_display_name,role:o.provider_role}:null,
  }));
}
