import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { S3Client, CreateBucketCommand, HeadBucketCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

process.env.NODE_ENV = 'test';
process.env.STORAGE_BACKEND = 's3';
process.env.S3_BUCKET = process.env.S3_BUCKET || 'hope-ci';
process.env.S3_REGION = process.env.S3_REGION || 'us-east-1';
process.env.S3_ENDPOINT = process.env.S3_ENDPOINT || 'http://127.0.0.1:9000';
process.env.S3_FORCE_PATH_STYLE = 'true';
process.env.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || 'minioadmin';
process.env.AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || 'minioadmin';

const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'hope-s3-'));
const filePath = path.join(tmp, 'sample.pdf');
await fsp.writeFile(filePath, Buffer.from('%PDF-1.7\nHOPE CI\n'));

const client = new S3Client({
  region: process.env.S3_REGION,
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY },
});
const { storage } = await import('../src/storage.js');

const key = 'ci/s3-integration/sample.pdf';

after(async () => {
  try { await client.send(new DeleteObjectCommand({ Bucket:process.env.S3_BUCKET, Key:key })); } catch {}
  await fsp.rm(tmp, { recursive:true, force:true });
  client.destroy();
});

test('real S3-compatible storage supports upload, head, and signature validation', async () => {
  try {
    await client.send(new HeadBucketCommand({ Bucket:process.env.S3_BUCKET }));
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === 'NotFound') {
      await client.send(new CreateBucketCommand({ Bucket:process.env.S3_BUCKET }));
    } else throw error;
  }

  const result = await storage.put({ path:filePath, key, contentType:'application/pdf' });
  assert.equal(result.key, key);
  const head = await storage.head({ key });
  assert.equal(head.key, key);
  assert.equal(head.contentType, 'application/pdf');
  assert.ok(head.size > 0);
  await storage.validateObject({ key, contentType:'application/pdf' });
  const signed = await storage.presignPut({ key:'ci/s3-integration/presigned.pdf', contentType:'application/pdf', expiresIn:60 });
  assert.match(signed.url, /http:\/\/127\.0\.0\.1:9000/);
  assert.equal(signed.mode, 's3');
});
