import { initDatabase, db } from './db.js';

await initDatabase();
console.log('HOPE PostgreSQL schema initialized.');
await db.close();
