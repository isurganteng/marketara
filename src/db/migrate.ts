import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { client, db } from './index';

const migrationsFolder = './drizzle';

console.log('Running migrations...');
await migrate(db, { migrationsFolder });
console.log('Migrations completed.');
await client.end();
