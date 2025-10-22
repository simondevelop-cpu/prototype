import { Pool } from 'pg';

const disableDb = process.env.DISABLE_DB === '1';

let pool: Pool | null = null;

export function getPool(): Pool | null {
  if (disableDb) return null;
  
  if (!pool) {
    const useSSL = process.env.DATABASE_SSL !== 'false';
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: useSSL ? { rejectUnauthorized: false } : false,
    });
    console.log('[DB] Pool created');
  }
  
  return pool;
}

