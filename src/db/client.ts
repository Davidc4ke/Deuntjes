import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

declare global {
  // eslint-disable-next-line no-var
  var __deuntjes_pool: Pool | undefined;
}

const pool =
  global.__deuntjes_pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  });

if (process.env.NODE_ENV !== 'production') {
  global.__deuntjes_pool = pool;
}

export const db = drizzle(pool, { schema });
export type DB = typeof db;
