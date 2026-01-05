/**
 * App Health Check Endpoint
 * Comprehensive health checks for application and database
 */

import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface HealthCheck {
  name: string;
  description: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
  responseTimeMs?: number;
}

async function checkDatabaseConnection(): Promise<HealthCheck> {
  const startTime = Date.now();
  try {
    const pool = getPool();
    if (!pool) {
      return {
        name: 'Database Connection',
        description: 'Verifies database connection pool is initialized and can execute queries',
        status: 'fail',
        message: 'Database pool not initialized (DISABLE_DB may be set)',
        responseTimeMs: Date.now() - startTime,
      };
    }

    // Simple query to test connectivity
    const result = await pool.query('SELECT 1 as health');
    const responseTime = Date.now() - startTime;
    
    if (result.rows[0].health === 1) {
      const status = responseTime > 1000 ? 'warning' : 'pass';
      return {
        name: 'Database Connection',
        description: 'Verifies database connection pool is initialized and can execute queries',
        status,
        message: responseTime > 1000 
          ? `Database connection successful (slow: ${responseTime}ms)` 
          : 'Database connection successful',
        responseTimeMs: responseTime,
        details: { responseTimeMs: responseTime },
      };
    }

    return {
      name: 'Database Connection',
      description: 'Verifies database connection pool is initialized and can execute queries',
      status: 'fail',
      message: 'Database query returned unexpected result',
      responseTimeMs: responseTime,
    };
  } catch (error: any) {
    return {
      name: 'Database Connection',
      description: 'Verifies database connection pool is initialized and can execute queries',
      status: 'fail',
      message: `Connection error: ${error.message}`,
      details: error.message,
      responseTimeMs: Date.now() - startTime,
    };
  }
}

async function checkDatabasePerformance(): Promise<HealthCheck> {
  const startTime = Date.now();
  try {
    const pool = getPool();
    if (!pool) {
      return {
        name: 'Database Performance',
        description: 'Checks database query performance and connection pool health',
        status: 'fail',
        message: 'Database pool not available',
        responseTimeMs: Date.now() - startTime,
      };
    }

    // Check active connections (if we can access pool stats)
    let activeConnections = 'unknown';
    let idleConnections = 'unknown';
    try {
      // Try to get pool statistics (if available)
      const stats = (pool as any).totalCount !== undefined ? {
        total: (pool as any).totalCount || 'unknown',
        idle: (pool as any).idleCount || 'unknown',
        waiting: (pool as any).waitingCount || 'unknown',
      } : null;
      
      if (stats) {
        activeConnections = `${stats.total - stats.idle}`;
        idleConnections = `${stats.idle}`;
      }
    } catch (e) {
      // Pool stats not available, that's okay
    }

    // Run a more complex query to test performance
    const perfStart = Date.now();
    await pool.query('SELECT COUNT(*) FROM users');
    const queryTime = Date.now() - perfStart;

    const responseTime = Date.now() - startTime;
    const status = queryTime > 500 ? 'warning' : 'pass';

    return {
      name: 'Database Performance',
      description: 'Checks database query performance and connection pool health',
      status,
      message: queryTime > 500 
        ? `Database queries are slow (${queryTime}ms for COUNT query)` 
        : 'Database performance is good',
      responseTimeMs: responseTime,
      details: { 
        queryTimeMs: queryTime,
        activeConnections,
        idleConnections,
      },
    };
  } catch (error: any) {
    return {
      name: 'Database Performance',
      description: 'Checks database query performance',
      status: 'fail',
      message: `Performance check failed: ${error.message}`,
      details: error.message,
      responseTimeMs: Date.now() - startTime,
    };
  }
}

async function checkSchemaTables(): Promise<HealthCheck> {
  const startTime = Date.now();
  try {
    const pool = getPool();
    if (!pool) {
      return {
        name: 'Schema Tables',
        description: 'Verifies all required database tables exist',
        status: 'fail',
        message: 'Database pool not available',
        responseTimeMs: Date.now() - startTime,
      };
    }

    const requiredTables = [
      'users',
      'transactions',
      'l0_user_tokenization',
      'l0_pii_users',
      'l1_transaction_facts',
      'l1_customer_facts',
    ];

    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = ANY($1)
    `, [requiredTables]);

    const existingTables = result.rows.map(r => r.table_name);
    const missingTables = requiredTables.filter(t => !existingTables.includes(t));
    const responseTime = Date.now() - startTime;

    if (missingTables.length === 0) {
      return {
        name: 'Schema Tables',
        description: 'Verifies all required database tables exist (legacy and new L0/L1 tables)',
        status: 'pass',
        message: `All ${requiredTables.length} required tables exist`,
        details: { tables: existingTables },
        responseTimeMs: responseTime,
      };
    }

    return {
      name: 'Schema Tables',
      description: 'Verifies all required database tables exist (legacy and new L0/L1 tables)',
      status: 'warning',
      message: `${missingTables.length} table(s) missing: ${missingTables.join(', ')}`,
      details: { missing: missingTables, existing: existingTables },
      responseTimeMs: responseTime,
    };
  } catch (error: any) {
    return {
      name: 'Schema Tables',
      description: 'Verifies all required database tables exist',
      status: 'fail',
      message: `Error checking tables: ${error.message}`,
      details: error.message,
      responseTimeMs: Date.now() - startTime,
    };
  }
}

async function checkDataMigration(): Promise<HealthCheck> {
  const startTime = Date.now();
  try {
    const pool = getPool();
    if (!pool) {
      return {
        name: 'Data Migration',
        description: 'Verifies data has been migrated to L0/L1 tables',
        status: 'fail',
        message: 'Database pool not available',
        responseTimeMs: Date.now() - startTime,
      };
    }

    // Check if new tables have data
    const tokenizedCount = await pool.query('SELECT COUNT(*) as count FROM l0_user_tokenization');
    const txFactsCount = await pool.query('SELECT COUNT(*) as count FROM l1_transaction_facts');
    const oldTxCount = await pool.query('SELECT COUNT(*) as count FROM transactions');

    const tokenizedUsers = parseInt(tokenizedCount.rows[0].count);
    const newTransactions = parseInt(txFactsCount.rows[0].count);
    const oldTransactions = parseInt(oldTxCount.rows[0].count);
    const responseTime = Date.now() - startTime;

    if (tokenizedUsers === 0 && newTransactions === 0) {
      return {
        name: 'Data Migration',
        description: 'Verifies data has been migrated to L0/L1 tables',
        status: 'warning',
        message: 'New tables are empty (migration may not have run)',
        details: { tokenizedUsers, newTransactions, oldTransactions },
        responseTimeMs: responseTime,
      };
    }

    if (newTransactions > 0 && tokenizedUsers > 0) {
      return {
        name: 'Data Migration',
        description: 'Verifies data has been migrated to L0/L1 tables',
        status: 'pass',
        message: `Migration complete: ${tokenizedUsers} users, ${newTransactions} transactions migrated`,
        details: { tokenizedUsers, newTransactions, oldTransactions },
        responseTimeMs: responseTime,
      };
    }

    return {
      name: 'Data Migration',
      description: 'Verifies data has been migrated to L0/L1 tables',
      status: 'warning',
      message: 'Partial migration detected',
      details: { tokenizedUsers, newTransactions, oldTransactions },
      responseTimeMs: responseTime,
    };
  } catch (error: any) {
    // Table might not exist (pre-migration)
    if (error.message?.includes('does not exist')) {
      return {
        name: 'Data Migration',
        description: 'Verifies data has been migrated to L0/L1 tables',
        status: 'warning',
        message: 'L0/L1 tables do not exist (migration not run)',
        responseTimeMs: Date.now() - startTime,
      };
    }

    return {
      name: 'Data Migration',
      description: 'Verifies data has been migrated to L0/L1 tables',
      status: 'fail',
      message: `Error: ${error.message}`,
      details: error.message,
      responseTimeMs: Date.now() - startTime,
    };
  }
}

async function checkDataIntegrity(): Promise<HealthCheck> {
  const startTime = Date.now();
  try {
    const pool = getPool();
    if (!pool) {
      return {
        name: 'Data Integrity',
        description: 'Verifies data integrity between old and new tables',
        status: 'fail',
        message: 'Database pool not available',
        responseTimeMs: Date.now() - startTime,
      };
    }

    // Check for orphaned transactions (transactions in l1_transaction_facts without valid tokenized user)
    const orphanedResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM l1_transaction_facts tf
      WHERE NOT EXISTS (
        SELECT 1 FROM l0_user_tokenization ut 
        WHERE ut.tokenized_user_id = tf.tokenized_user_id
      )
    `);

    const orphanedCount = parseInt(orphanedResult.rows[0].count);
    const responseTime = Date.now() - startTime;

    if (orphanedCount === 0) {
      return {
        name: 'Data Integrity',
        description: 'Verifies data integrity between old and new tables (no orphaned records)',
        status: 'pass',
        message: 'No orphaned records found',
        details: { orphanedTransactions: 0 },
        responseTimeMs: responseTime,
      };
    }

    return {
      name: 'Data Integrity',
      description: 'Verifies data integrity between old and new tables (no orphaned records)',
      status: 'fail',
      message: `${orphanedCount} orphaned transaction(s) found`,
      details: { orphanedTransactions: orphanedCount },
      responseTimeMs: responseTime,
    };
  } catch (error: any) {
    if (error.message?.includes('does not exist')) {
      return {
        name: 'Data Integrity',
        description: 'Verifies data integrity between old and new tables',
        status: 'warning',
        message: 'L0/L1 tables do not exist (cannot check integrity)',
        responseTimeMs: Date.now() - startTime,
      };
    }

    return {
      name: 'Data Integrity',
      description: 'Verifies data integrity between old and new tables',
      status: 'fail',
      message: `Error: ${error.message}`,
      details: error.message,
      responseTimeMs: Date.now() - startTime,
    };
  }
}

async function checkPasswordSecurity(): Promise<HealthCheck> {
  const startTime = Date.now();
  try {
    const pool = getPool();
    if (!pool) {
      return {
        name: 'Password Security',
        description: 'Verifies passwords are stored using secure hashing (bcrypt)',
        status: 'fail',
        message: 'Database pool not available',
        responseTimeMs: Date.now() - startTime,
      };
    }

    // Check if any passwords use old SHA-256 format (not starting with bcrypt prefix)
    const result = await pool.query(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE password_hash IS NOT NULL 
      AND password_hash !~ '^\\$2[aby]\\$'
    `);

    const legacyHashes = parseInt(result.rows[0].count);
    const responseTime = Date.now() - startTime;

    if (legacyHashes === 0) {
      return {
        name: 'Password Security',
        description: 'Verifies passwords are stored using secure hashing (bcrypt, not SHA-256)',
        status: 'pass',
        message: 'All passwords use bcrypt hashing',
        details: { legacyHashes: 0 },
        responseTimeMs: responseTime,
      };
    }

    return {
      name: 'Password Security',
      description: 'Verifies passwords are stored using secure hashing (bcrypt, not SHA-256)',
      status: 'warning',
      message: `${legacyHashes} user(s) still using legacy password hashing`,
      details: { legacyHashes },
      responseTimeMs: responseTime,
    };
  } catch (error: any) {
    return {
      name: 'Password Security',
      description: 'Verifies passwords are stored using secure hashing',
      status: 'fail',
      message: `Error: ${error.message}`,
      details: error.message,
      responseTimeMs: Date.now() - startTime,
    };
  }
}

async function checkEnvironmentVariables(): Promise<HealthCheck> {
  const startTime = Date.now();
  const required = ['DATABASE_URL'];
  const recommended = ['JWT_SECRET']; // Has default fallback in code
  const optional = ['ALLOWED_ORIGINS', 'TOKENIZATION_SALT'];
  
  const missing = required.filter(key => !process.env[key]);
  const present = required.filter(key => process.env[key]);
  const recommendedPresent = recommended.filter(key => process.env[key]);
  const recommendedMissing = recommended.filter(key => !process.env[key]);
  const optionalPresent = optional.filter(key => process.env[key]);

  if (missing.length === 0) {
    // Check if recommended variables are missing (warn but don't fail)
    if (recommendedMissing.length > 0) {
      return {
        name: 'Environment Variables',
        description: 'Verifies required environment variables are set (JWT_SECRET has default fallback)',
        status: 'warning',
        message: `All required variables set. Recommended: ${recommendedMissing.join(', ')} not set (using defaults)`,
        details: { 
          required: present, 
          recommended: recommendedPresent,
          recommendedMissing,
          optional: optionalPresent 
        },
        responseTimeMs: Date.now() - startTime,
      };
    }

    return {
      name: 'Environment Variables',
      description: 'Verifies required environment variables are set',
      status: 'pass',
      message: 'All required environment variables are set',
      details: {
        required: present,
        recommended: recommendedPresent,
        optional: optionalPresent,
      },
      responseTimeMs: Date.now() - startTime,
    };
  }

  return {
    name: 'Environment Variables',
    description: 'Verifies required environment variables are set',
    status: 'fail',
    message: `Missing required variables: ${missing.join(', ')}`,
    details: { missing, present, recommended: recommendedPresent, optional: optionalPresent },
    responseTimeMs: Date.now() - startTime,
  };
}

async function checkExtensions(): Promise<HealthCheck> {
  const startTime = Date.now();
  try {
    const pool = getPool();
    if (!pool) {
      return {
        name: 'Database Extensions',
        description: 'Verifies required PostgreSQL extensions are enabled',
        status: 'fail',
        message: 'Database pool not available',
        responseTimeMs: Date.now() - startTime,
      };
    }

    const result = await pool.query(`
      SELECT extname 
      FROM pg_extension 
      WHERE extname = 'pgcrypto'
    `);

    const responseTime = Date.now() - startTime;

    if (result.rows.length > 0) {
      return {
        name: 'Database Extensions',
        description: 'Verifies required PostgreSQL extensions (pgcrypto) are enabled',
        status: 'pass',
        message: 'pgcrypto extension is enabled',
        details: { extensions: ['pgcrypto'] },
        responseTimeMs: responseTime,
      };
    }

    return {
      name: 'Database Extensions',
      description: 'Verifies required PostgreSQL extensions (pgcrypto) are enabled',
      status: 'warning',
      message: 'pgcrypto extension not enabled (required for tokenization)',
      details: { extensions: [] },
      responseTimeMs: responseTime,
    };
  } catch (error: any) {
    return {
      name: 'Database Extensions',
      description: 'Verifies required PostgreSQL extensions are enabled',
      status: 'fail',
      message: `Error: ${error.message}`,
      details: error.message,
      responseTimeMs: Date.now() - startTime,
    };
  }
}

async function checkDatabaseDiskSpace(): Promise<HealthCheck> {
  const startTime = Date.now();
  try {
    const pool = getPool();
    if (!pool) {
      return {
        name: 'Database Disk Space',
        description: 'Checks database disk space usage',
        status: 'fail',
        message: 'Database pool not available',
        responseTimeMs: Date.now() - startTime,
      };
    }

    // Check database size and available space (if accessible)
    // Note: This requires superuser privileges in most managed databases
    // So we'll make it a warning if we can't access it
    try {
      const sizeResult = await pool.query(`
        SELECT 
          pg_size_pretty(pg_database_size(current_database())) as database_size,
          pg_database_size(current_database()) as size_bytes
      `);

      const databaseSize = sizeResult.rows[0]?.database_size || 'unknown';
      const sizeBytes = parseInt(sizeResult.rows[0]?.size_bytes || '0');

      // Check if database is getting large (>10GB = warning)
      const status = sizeBytes > 10 * 1024 * 1024 * 1024 ? 'warning' : 'pass';
      const responseTime = Date.now() - startTime;

      return {
        name: 'Database Disk Space',
        description: 'Checks database disk space usage',
        status,
        message: status === 'warning' 
          ? `Database is large (${databaseSize}) - consider cleanup`
          : `Database size: ${databaseSize}`,
        details: { databaseSize, sizeBytes },
        responseTimeMs: responseTime,
      };
    } catch (permError: any) {
      // Permission denied - that's okay, managed databases often restrict this
      return {
        name: 'Database Disk Space',
        description: 'Checks database disk space usage (requires superuser - may not be available in managed DBs)',
        status: 'warning',
        message: 'Cannot check disk space (permission denied - normal for managed databases)',
        details: { note: 'Managed databases (Neon, Vercel) restrict disk space queries' },
        responseTimeMs: Date.now() - startTime,
      };
    }
  } catch (error: any) {
    return {
      name: 'Database Disk Space',
      description: 'Checks database disk space usage',
      status: 'warning',
      message: `Cannot check disk space: ${error.message}`,
      details: error.message,
      responseTimeMs: Date.now() - startTime,
    };
  }
}

export async function GET() {
  const overallStartTime = Date.now();
  try {
    const checks: HealthCheck[] = [];

    // Run all checks
    checks.push(await checkEnvironmentVariables());
    checks.push(await checkDatabaseConnection());
    checks.push(await checkDatabasePerformance());
    checks.push(await checkSchemaTables());
    checks.push(await checkExtensions());
    checks.push(await checkDatabaseDiskSpace());
    checks.push(await checkDataMigration());
    checks.push(await checkDataIntegrity());
    checks.push(await checkPasswordSecurity());

    const allPassed = checks.every(c => c.status === 'pass');
    const hasFailures = checks.some(c => c.status === 'fail');
    const hasWarnings = checks.some(c => c.status === 'warning');

    const overallStatus = hasFailures ? 'fail' : (hasWarnings ? 'warning' : 'pass');
    const totalResponseTime = Date.now() - overallStartTime;

    return NextResponse.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTimeMs: totalResponseTime,
      checks,
      summary: {
        total: checks.length,
        passed: checks.filter(c => c.status === 'pass').length,
        warnings: checks.filter(c => c.status === 'warning').length,
        failed: checks.filter(c => c.status === 'fail').length,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'fail',
        error: 'Health check failed',
        message: error.message,
        responseTimeMs: Date.now() - overallStartTime,
      },
      { status: 500 }
    );
  }
}
