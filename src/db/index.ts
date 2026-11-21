import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../config';
import * as schema from './schema';

export const client = postgres(env.databaseUrl, {
  max: env.nodeEnv === 'production' ? 20 : 10,
  idle_timeout: 20,
  connect_timeout: 10,
  onnotice: env.nodeEnv === 'production' ? undefined : () => {},
});

export const db = drizzle(client, {
  schema,
  casing: 'snake_case',
  logger: env.dbLog ? { logQuery(query, params) { console.log('[sql]', query, params); } } : false,
});

export type DB = typeof db;
export { schema };
