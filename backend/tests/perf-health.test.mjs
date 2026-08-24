import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createServer } from '../src/app.js';
const server = createServer();
let base;
before(async () => { await new Promise(resolve => server.listen(0,'127.0.0.1',resolve)); base=`http://127.0.0.1:${server.address().port}`; });
after(async () => { await new Promise(resolve => server.close(resolve)); });

test('health endpoint remains responsive under concurrent probes', async () => {
  const started=Date.now();
  const responses=await Promise.all(Array.from({length:100},()=>fetch(base+'/health')));
  const elapsed=Date.now()-started;
  assert.equal(responses.length,100);
  assert.ok(responses.every(r=>r.status===200 || r.status===503));
  assert.ok(elapsed < 5000, `health probes took ${elapsed}ms`);
});
