import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hope-sec-'));
process.env.DATA_FILE=path.join(tmp,'hope.json');
process.env.STORAGE_DIR=path.join(tmp,'storage');
process.env.NODE_ENV='test';
process.env.EXPOSE_RESET_TOKEN_IN_DEVELOPMENT='true';
process.env.AUTH_RATE_LIMIT_MAX='20';
process.env.RATE_LIMIT_WINDOW_MS='60000';
process.env.METRICS_TOKEN='metrics-test';
const {createServer}=await import('../src/app.js');
const {db}=await import('../src/db.js');
const server=createServer(); await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}/api/v1`;
const json=(url,opt={})=>fetch(base+url,{...opt,headers:{'Content-Type':'application/json',...(opt.headers||{})}}).then(async r=>({status:r.status,body:await r.json()}));

test('refresh rotates and reusing old token revokes family',async()=>{
  const r=await json('/auth/register',{method:'POST',body:JSON.stringify({email:'rotate@example.com',password:'pass12345',displayName:'Rotate'})}); assert.equal(r.status,201);
  const first=r.body.data.refreshToken;
  const rotated=await json('/auth/refresh',{method:'POST',body:JSON.stringify({refreshToken:first})}); assert.equal(rotated.status,200); assert.ok(rotated.body.data.refreshToken);
  const reuse=await json('/auth/refresh',{method:'POST',body:JSON.stringify({refreshToken:first})}); assert.equal(reuse.status,401); assert.equal(reuse.body.error.code,'REFRESH_REUSE_DETECTED');
  const secondReuse=await json('/auth/refresh',{method:'POST',body:JSON.stringify({refreshToken:rotated.body.data.refreshToken})}); assert.equal(secondReuse.status,401);
});

test('password reset is one-time and invalidates prior refresh session',async()=>{
  const r=await json('/auth/register',{method:'POST',body:JSON.stringify({email:'reset@example.com',password:'pass12345',displayName:'Reset'})}); assert.equal(r.status,201); const oldRefresh=r.body.data.refreshToken;
  const req=await json('/auth/password-reset/request',{method:'POST',body:JSON.stringify({email:'reset@example.com'})}); assert.equal(req.status,202); const token=req.body.data.resetToken; assert.ok(token);
  const confirm=await json('/auth/password-reset/confirm',{method:'POST',body:JSON.stringify({token,password:'newpass123'})});
  assert.equal(confirm.status,200);
  const reuse=await json('/auth/password-reset/confirm',{method:'POST',body:JSON.stringify({token,password:'another123'})}); assert.equal(reuse.status,400);
  const old=await json('/auth/refresh',{method:'POST',body:JSON.stringify({refreshToken:oldRefresh})}); assert.equal(old.status,401);
  const login=await json('/auth/login',{method:'POST',body:JSON.stringify({email:'reset@example.com',password:'newpass123'})}); assert.equal(login.status,200);
});

test('metrics requires the configured token and auth rate limit is active',async()=>{
  const unauth=await fetch(base.replace('/api/v1','')+'/metrics'); assert.equal(unauth.status,401);
  const auth=await fetch(base.replace('/api/v1','')+'/metrics',{headers:{'x-metrics-token':'metrics-test'}}); assert.equal(auth.status,200);
  const attempts=[]; for(let i=0;i<21;i++) attempts.push(await json('/auth/login',{method:'POST',body:JSON.stringify({email:`nope${i}@example.com`,password:'badpass1'})}));
  assert.ok(attempts.some(x=>x.status===429));
});

after(async()=>{await db.close(); await new Promise(r=>server.close(r)); fs.rmSync(tmp,{recursive:true,force:true});});
