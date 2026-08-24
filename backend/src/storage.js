import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from './config.js';

class LocalStorage {
  async put(file) {
    await fs.mkdir(config.storageDir, { recursive:true });
    const destination = path.join(config.storageDir, file.key);
    await fs.rename(file.path, destination);
    return { key:file.key };
  }
  async presignPut() { throw new Error('DIRECT_UPLOAD_UNSUPPORTED'); }
  async head() { throw new Error('DIRECT_UPLOAD_UNSUPPORTED'); }
  async validateObject() { throw new Error('DIRECT_UPLOAD_UNSUPPORTED'); }
  async delete({ key }) { try { await fs.unlink(path.join(config.storageDir, key)); } catch {} }
}
class S3Storage {
  constructor() {
    this.bucket = config.s3Bucket;
    this.client = new S3Client({ region:config.s3Region, endpoint:config.s3Endpoint || undefined, forcePathStyle:config.s3ForcePathStyle });
  }
  async put(file) {
    await this.client.send(new PutObjectCommand({ Bucket:this.bucket, Key:file.key, Body:createReadStream(file.path), ContentType:file.contentType }));
    return { key:file.key };
  }
  async presignPut({ key, contentType, expiresIn }) {
    const command = new PutObjectCommand({ Bucket:this.bucket, Key:key, ContentType:contentType });
    return { key, url:await getSignedUrl(this.client, command, { expiresIn }), contentType, expiresIn, mode:'s3' };
  }
  async head({ key }) {
    const result = await this.client.send(new HeadObjectCommand({ Bucket:this.bucket, Key:key }));
    return { key, contentType:result.ContentType || '', size:Number(result.ContentLength || 0) };
  }
  async delete({ key }) { await this.client.send(new DeleteObjectCommand({ Bucket:this.bucket, Key:key })); }
  async validateObject({ key, contentType }) {
    const result = await this.client.send(new GetObjectCommand({ Bucket:this.bucket, Key:key, Range:'bytes=0-4095' }));
    const chunks=[]; let total=0;
    for await (const chunk of result.Body) { chunks.push(chunk); total += chunk.length; if (total >= 4096) break; }
    const content=Buffer.concat(chunks).subarray(0,4096);
    const valid = (contentType==='application/pdf' && content.subarray(0,4).toString()==='%PDF') ||
      (contentType==='image/png' && content.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) ||
      (contentType==='image/jpeg' && content.subarray(0,3).equals(Buffer.from([0xff,0xd8,0xff]))) ||
      (contentType==='image/webp' && content.subarray(0,4).toString()==='RIFF' && content.subarray(8,12).toString()==='WEBP') ||
      (contentType==='text/plain' && !content.includes(0));
    if (!valid) { const error=new Error('INVALID_FILE_SIGNATURE'); error.code='INVALID_FILE_SIGNATURE'; throw error; }
    return { valid:true };
  }
}
export const storage = config.storageBackend === 's3' ? new S3Storage() : new LocalStorage();
