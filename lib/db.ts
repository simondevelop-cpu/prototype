import { Pool } from 'pg';

const disableDb = process.env.DISABLE_DB === '1';

let pool: Pool | null = null;

export function getPool(): Pool | null {
  if (disableDb) return null;
  
  if (!pool) {
    const useSSL = process.env.DATABASE_SSL !== 'false';
    let connectionString = process.env.DATABASE_URL || '';
    
    // Fix SSL mode warning by explicitly setting sslmode in connection string
    // For managed databases (Vercel Postgres, Neon, etc.), use 'require' with libpq compatibility
    // This prevents the deprecation warning while maintaining compatibility
    if (useSSL && connectionString && !connectionString.includes('sslmode=')) {
      // Add sslmode parameter to connection string
      // Using 'require' with uselibpqcompat for managed database compatibility
      const separator = connectionString.includes('?') ? '&' : '?';
      connectionString = `${connectionString}${separator}uselibpqcompat=true&sslmode=require`;
    }
    
    pool = new Pool({
      connectionString,
      ssl: useSSL ? { rejectUnauthorized: false } : false,
    });
    console.log('[DB] Pool created');
  }
  
  return pool;
}

