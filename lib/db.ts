import { Pool } from 'pg';

const disableDb = process.env.DISABLE_DB === '1';

let pool: Pool | null = null;

export function getPool(): Pool | null {
  if (disableDb) return null;
  
  if (!pool) {
    const useSSL = process.env.DATABASE_SSL !== 'false';
    let connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
    
    // Fix SSL mode warning by explicitly setting sslmode in connection string
    // The warning recommends using 'verify-full' to maintain current behavior
    // This prevents the deprecation warning
    if (useSSL && connectionString) {
      // Remove any existing sslmode/uselibpqcompat parameters to avoid conflicts
      connectionString = connectionString.replace(/[?&]sslmode=[^&]*/g, '');
      connectionString = connectionString.replace(/[?&]uselibpqcompat=[^&]*/g, '');
      
      // Add sslmode parameter as recommended by the warning to maintain current behavior
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

