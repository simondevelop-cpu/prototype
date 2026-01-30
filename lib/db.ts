import { Pool } from 'pg';

const disableDb = process.env.DISABLE_DB === '1';

let pool: Pool | null = null;

export function getPool(): Pool | null {
  if (disableDb) return null;
  
  if (!pool) {
    const useSSL = process.env.DATABASE_SSL !== 'false';
    let connectionString = process.env.DATABASE_URL || '';
    
    // Fix SSL mode warning by explicitly setting sslmode=verify-full in connection string
    if (useSSL && connectionString && !connectionString.includes('sslmode=')) {
      // Add sslmode parameter to connection string
      const separator = connectionString.includes('?') ? '&' : '?';
      connectionString = `${connectionString}${separator}sslmode=verify-full`;
    }
    
    pool = new Pool({
      connectionString,
      ssl: useSSL ? { rejectUnauthorized: false } : false,
    });
    console.log('[DB] Pool created');
  }
  
  return pool;
}

