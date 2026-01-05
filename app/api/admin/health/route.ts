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
}

async function checkDatabaseConnection(): Promise<HealthCheck> {
  try {
    const pool = getPool();
    if (!pool) {
      return {
        name: 'Database Connection',
        description: 'Verifies database connection pool is initialized',
        status: 'fail',
        message: 'Database pool not initialized (DISABLE_DB may be set)',
      };
    }

    const result = await pool.query('SELECT 1 as health');
    if (result.rows[0].health === 1) {
      return {
        name: 'Database Connection',
        description: 'Verifies database connection pool is initialized and can execute queries',
        status: 'pass',
        message: 'Database connection successful',
      };
    }

    return {
      name: 'Database Connection',
      description: 'Verifies database connection pool is initialized and can execute queries',
      status: 'fail',
      message: 'Database query returned unexpected result',
    };
  } catch (error: any) {
    return {
      name: 'Database Connection',
      description: 'Verifies database connection pool is initialized and can execute queries',
      status: 'fail',
      message: `Connection error: ${error.message}`,
      details: error.message,
    };
  }
}

async function checkSchemaTables(): Promise<HealthCheck> {
  try {
    const pool = getPool();
    if (!pool) {
      return {
        name: 'Schema Tables',
        description: 'Verifies all required database tables exist',
        status: 'fail',
        message: 'Database pool not available',
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

    if (missingTables.length === 0) {
      return {
        name: 'Schema Tables',
        description: 'Verifies all required database tables exist (legacy and new L0/L1 tables)',
        status: 'pass',
        message: `All ${requiredTables.length} required tables exist`,
        details: { tables: existingTables },
      };
    }

    return {
      name: 'Schema Tables',
      description: 'Verifies all required database tables exist (legacy and new L0/L1 tables)',
      status: 'warning',
      message: `${missingTables.length} table(s) missing: ${missingTables.join(', ')}`,
      details: { missing: missingTables, existing: existingTables },
    };
  } catch (error: any) {
    return {
      name: 'Schema Tables',
      description: 'Verifies all required database tables exist',
      status: 'fail',
      message: `Error checking tables: ${error.message}`,
      details: error.message,
    };
  }
}

async function checkDataMigration(): Promise<HealthCheck> {
  try {
    const pool = getPool();
    if (!pool) {
      return {
        name: 'Data Migration',
        description: 'Verifies data has been migrated to L0/L1 tables',
        status: 'fail',
        message: 'Database pool not available',
      };
    }

    // Check if new tables have data
    const tokenizedCount = await pool.query('SELECT COUNT(*) as count FROM l0_user_tokenization');
    const txFactsCount = await pool.query('SELECT COUNT(*) as count FROM l1_transaction_facts');
    const oldTxCount = await pool.query('SELECT COUNT(*) as count FROM transactions');

    const tokenizedUsers = parseInt(tokenizedCount.rows[0].count);
    const newTransactions = parseInt(txFactsCount.rows[0].count);
    const oldTransactions = parseInt(oldTxCount.rows[0].count);

    if (tokenizedUsers === 0 && newTransactions === 0) {
      return {
        name: 'Data Migration',
        description: 'Verifies data has been migrated to L0/L1 tables',
        status: 'warning',
        message: 'New tables are empty (migration may not have run)',
        details: { tokenizedUsers, newTransactions, oldTransactions },
      };
    }

    if (newTransactions > 0 && tokenizedUsers > 0) {
      return {
        name: 'Data Migration',
        description: 'Verifies data has been migrated to L0/L1 tables',
        status: 'pass',
        message: `Migration complete: ${tokenizedUsers} users, ${newTransactions} transactions migrated`,
        details: { tokenizedUsers, newTransactions, oldTransactions },
      };
    }

    return {
      name: 'Data Migration',
      description: 'Verifies data has been migrated to L0/L1 tables',
      status: 'warning',
      message: 'Partial migration detected',
      details: { tokenizedUsers, newTransactions, oldTransactions },
    };
  } catch (error: any) {
    // Table might not exist (pre-migration)
    if (error.message?.includes('does not exist')) {
      return {
        name: 'Data Migration',
        description: 'Verifies data has been migrated to L0/L1 tables',
        status: 'warning',
        message: 'L0/L1 tables do not exist (migration not run)',
      };
    }

    return {
      name: 'Data Migration',
      description: 'Verifies data has been migrated to L0/L1 tables',
      status: 'fail',
      message: `Error: ${error.message}`,
      details: error.message,
    };
  }
}

async function checkDataIntegrity(): Promise<HealthCheck> {
  try {
    const pool = getPool();
    if (!pool) {
      return {
        name: 'Data Integrity',
        description: 'Verifies data integrity between old and new tables',
        status: 'fail',
        message: 'Database pool not available',
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

    if (orphanedCount === 0) {
      return {
        name: 'Data Integrity',
        description: 'Verifies data integrity between old and new tables (no orphaned records)',
        status: 'pass',
        message: 'No orphaned records found',
        details: { orphanedTransactions: 0 },
      };
    }

    return {
      name: 'Data Integrity',
      description: 'Verifies data integrity between old and new tables (no orphaned records)',
      status: 'fail',
      message: `${orphanedCount} orphaned transaction(s) found`,
      details: { orphanedTransactions: orphanedCount },
    };
  } catch (error: any) {
    if (error.message?.includes('does not exist')) {
      return {
        name: 'Data Integrity',
        description: 'Verifies data integrity between old and new tables',
        status: 'warning',
        message: 'L0/L1 tables do not exist (cannot check integrity)',
      };
    }

    return {
      name: 'Data Integrity',
      description: 'Verifies data integrity between old and new tables',
      status: 'fail',
      message: `Error: ${error.message}`,
      details: error.message,
    };
  }
}

async function checkPasswordSecurity(): Promise<HealthCheck> {
  try {
    const pool = getPool();
    if (!pool) {
      return {
        name: 'Password Security',
        description: 'Verifies passwords are stored using secure hashing (bcrypt)',
        status: 'fail',
        message: 'Database pool not available',
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

    if (legacyHashes === 0) {
      return {
        name: 'Password Security',
        description: 'Verifies passwords are stored using secure hashing (bcrypt, not SHA-256)',
        status: 'pass',
        message: 'All passwords use bcrypt hashing',
        details: { legacyHashes: 0 },
      };
    }

    return {
      name: 'Password Security',
      description: 'Verifies passwords are stored using secure hashing (bcrypt, not SHA-256)',
      status: 'warning',
      message: `${legacyHashes} user(s) still using legacy password hashing`,
      details: { legacyHashes },
    };
  } catch (error: any) {
    return {
      name: 'Password Security',
      description: 'Verifies passwords are stored using secure hashing',
      status: 'fail',
      message: `Error: ${error.message}`,
      details: error.message,
    };
  }
}

async function checkEnvironmentVariables(): Promise<HealthCheck> {
  const required = ['DATABASE_URL', 'JWT_SECRET'];
  const optional = ['ALLOWED_ORIGINS', 'TOKENIZATION_SALT'];
  
  const missing = required.filter(key => !process.env[key]);
  const present = required.filter(key => process.env[key]);
  const optionalPresent = optional.filter(key => process.env[key]);

  if (missing.length === 0) {
    return {
      name: 'Environment Variables',
      description: 'Verifies required environment variables are set',
      status: 'pass',
      message: 'All required environment variables are set',
      details: {
        required: present,
        optional: optionalPresent,
      },
    };
  }

  return {
    name: 'Environment Variables',
    description: 'Verifies required environment variables are set',
    status: 'fail',
    message: `Missing required variables: ${missing.join(', ')}`,
    details: { missing, present, optional: optionalPresent },
  };
}

async function checkExtensions(): Promise<HealthCheck> {
  try {
    const pool = getPool();
    if (!pool) {
      return {
        name: 'Database Extensions',
        description: 'Verifies required PostgreSQL extensions are enabled',
        status: 'fail',
        message: 'Database pool not available',
      };
    }

    const result = await pool.query(`
      SELECT extname 
      FROM pg_extension 
      WHERE extname = 'pgcrypto'
    `);

    if (result.rows.length > 0) {
      return {
        name: 'Database Extensions',
        description: 'Verifies required PostgreSQL extensions (pgcrypto) are enabled',
        status: 'pass',
        message: 'pgcrypto extension is enabled',
        details: { extensions: ['pgcrypto'] },
      };
    }

    return {
      name: 'Database Extensions',
      description: 'Verifies required PostgreSQL extensions (pgcrypto) are enabled',
      status: 'warning',
      message: 'pgcrypto extension not enabled (required for tokenization)',
      details: { extensions: [] },
    };
  } catch (error: any) {
    return {
      name: 'Database Extensions',
      description: 'Verifies required PostgreSQL extensions are enabled',
      status: 'fail',
      message: `Error: ${error.message}`,
      details: error.message,
    };
  }
}

export async function GET() {
  try {
    const checks: HealthCheck[] = [];

    // Run all checks
    checks.push(await checkEnvironmentVariables());
    checks.push(await checkDatabaseConnection());
    checks.push(await checkSchemaTables());
    checks.push(await checkExtensions());
    checks.push(await checkDataMigration());
    checks.push(await checkDataIntegrity());
    checks.push(await checkPasswordSecurity());

    const allPassed = checks.every(c => c.status === 'pass');
    const hasFailures = checks.some(c => c.status === 'fail');
    const hasWarnings = checks.some(c => c.status === 'warning');

    const overallStatus = hasFailures ? 'fail' : (hasWarnings ? 'warning' : 'pass');

    return NextResponse.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
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
      },
      { status: 500 }
    );
  }
}

