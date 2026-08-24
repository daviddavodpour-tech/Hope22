import { initDatabase, seedBaseData, db } from './db.js';

await initDatabase();
seedBaseData();
await db.flush();
console.log('HOPE seed data initialized.');
await db.close();
