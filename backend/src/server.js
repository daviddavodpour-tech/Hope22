import { createServer } from './app.js';
import { config } from './config.js';
import { db } from './db.js';
import { startOutboxWorker } from './outbox_worker.js';

const server = createServer();
server.requestTimeout = config.requestTimeoutMs;
server.headersTimeout = Math.max(config.headersTimeoutMs, config.requestTimeoutMs + 1000);
server.keepAliveTimeout = config.keepAliveTimeoutMs;
server.maxRequestsPerSocket = 1000;
server.on('error', (error) => {
  console.error('[server] error:', error);
  process.exitCode = 1;
});
server.on('clientError', (error, socket) => {
  console.error('[server] client error:', error.message);
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
});
const outboxWorker = startOutboxWorker();
server.listen(config.port, config.host, () => {
  console.log(`HOPE API listening on ${config.host}:${config.port}`);
});

let shuttingDown = false;
const shutdown = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  const timer = setTimeout(() => process.exit(1), 10000);
  timer.unref();
  server.close(async () => {
    try { outboxWorker.stop(); await db.close(); process.exitCode = 0; }
    catch (error) { console.error('[server] shutdown error:', error); process.exitCode = 1; }
    finally { process.exit(); }
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
