import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

interface MigrationTest {
  name: string;
  query: string;
  expectedResult?: 'exists' | 'not_exists' | 'has_rows' | 'no_rows' | 'count_greater_than';
  expectedValue?: number;
  description: string;
}

/**
 * Run the comprehensive table consolidation migration
 */
export async function POST(request: NextRequest) {
  try {
    // Admin authentication
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.role !== 'admin' && decoded.email !== ADMIN_EMAIL) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const pool = getPool();
    if (!pool) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    // Read migration script
    const migrationPath = path.join(process.cwd(), 'migrations', 'comprehensive-table-consolidation-v2.sql');
    const migrationScript = fs.readFileSync(migrationPath, 'utf-8');

    // Execute the entire migration script as a single transaction
    // This handles DO blocks, comments, and complex SQL properly
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Execute the full script
      await client.query(migrationScript);
      
      await client.query('COMMIT');
      
      return NextResponse.json({
        success: true,
        executed: 1,
        successful: 1,
        errors: 0,
        message: 'Migration completed successfully',
      });
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('[Migration API] Migration failed:', error);
      return NextResponse.json({
        success: false,
        executed: 1,
        successful: 0,
        errors: 1,
        error: error.message,
        details: error.detail || error.hint || '',
      }, { status: 500 });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[Migration API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to run migration', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Run pre-migration tests to verify current state
 */
export async function GET(request: NextRequest) {
  try {
    // Admin authentication
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.role !== 'admin' && decoded.email !== ADMIN_EMAIL) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const pool = getPool();
    if (!pool) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    // Define tests
    const tests: MigrationTest[] = [
      {
        name: 'l0_pii_users table exists',
        query: `SELECT 1 FROM information_schema.tables WHERE table_name = 'l0_pii_users'`,
        expectedResult: 'has_rows',
        description: 'Verify l0_pii_users table exists',
      },
      {
        name: 'l1_events table exists (or user_events exists)',
        query: `SELECT 1 FROM information_schema.tables WHERE table_name IN ('l1_events', 'user_events')`,
        expectedResult: 'has_rows',
        description: 'Verify events table exists (either renamed or original)',
      },
      {
        name: 'l1_transaction_facts table exists',
        query: `SELECT 1 FROM information_schema.tables WHERE table_name = 'l1_transaction_facts'`,
        expectedResult: 'has_rows',
        description: 'Verify l1_transaction_facts table exists',
      },
      {
        name: 'l0_pii_users has internal_user_id column',
        query: `SELECT 1 FROM information_schema.columns WHERE table_name = 'l0_pii_users' AND column_name = 'internal_user_id'`,
        expectedResult: 'has_rows',
        description: 'Verify internal_user_id column exists',
      },
      {
        name: 'l0_pii_users has ip_address column',
        query: `SELECT 1 FROM information_schema.columns WHERE table_name = 'l0_pii_users' AND column_name = 'ip_address'`,
        expectedResult: 'has_rows',
        description: 'Verify ip_address column exists (or will be added)',
      },
      {
        name: 'l1_events has is_admin column',
        query: `SELECT 1 FROM information_schema.columns WHERE table_name IN ('l1_events', 'user_events') AND column_name = 'is_admin'`,
        expectedResult: 'has_rows',
        description: 'Verify is_admin column exists (or will be added)',
      },
      {
        name: 'transactions table has data',
        query: `SELECT COUNT(*) as count FROM transactions`,
        expectedResult: 'count_greater_than',
        expectedValue: 0,
        description: 'Check if transactions table has data to migrate',
      },
      {
        name: 'l1_transaction_facts has data',
        query: `SELECT COUNT(*) as count FROM l1_transaction_facts`,
        expectedResult: 'count_greater_than',
        expectedValue: 0,
        description: 'Check if l1_transaction_facts already has data',
      },
    ];

    const testResults = [];

    for (const test of tests) {
      try {
        const result = await pool.query(test.query);
        
        let passed = false;
        let actualValue: any = null;

        switch (test.expectedResult) {
          case 'has_rows':
            passed = result.rows.length > 0;
            actualValue = result.rows.length;
            break;
          case 'no_rows':
            passed = result.rows.length === 0;
            actualValue = result.rows.length;
            break;
          case 'count_greater_than':
            actualValue = parseInt(result.rows[0]?.count || '0', 10);
            passed = actualValue > (test.expectedValue || 0);
            break;
          case 'exists':
            passed = result.rows.length > 0;
            break;
          case 'not_exists':
            passed = result.rows.length === 0;
            break;
        }

        testResults.push({
          name: test.name,
          description: test.description,
          passed,
          actualValue,
          expectedResult: test.expectedResult,
          expectedValue: test.expectedValue,
        });
      } catch (error: any) {
        testResults.push({
          name: test.name,
          description: test.description,
          passed: false,
          error: error.message,
        });
      }
    }

    const allPassed = testResults.every(r => r.passed);

    return NextResponse.json({
      success: allPassed,
      tests: testResults,
      summary: {
        total: testResults.length,
        passed: testResults.filter(r => r.passed).length,
        failed: testResults.filter(r => !r.passed).length,
      },
    });
  } catch (error: any) {
    console.error('[Migration Tests API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to run tests', details: error.message },
      { status: 500 }
    );
  }
}

