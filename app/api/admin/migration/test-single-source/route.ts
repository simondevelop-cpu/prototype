import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';

export const dynamic = 'force-dynamic';

/**
 * Comprehensive test suite for Single Source of Truth
 * Tests that all code uses l1_transaction_facts and no fallbacks to transactions
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

    const tests: any[] = [];

    // Test 1: Verify all transactions migrated
    try {
      const legacyCount = await pool.query('SELECT COUNT(*) as count FROM transactions');
      const migratedCount = await pool.query(`
        SELECT COUNT(*) as count 
        FROM l1_transaction_facts 
        WHERE legacy_transaction_id IS NOT NULL
      `);
      const legacy = parseInt(legacyCount.rows[0]?.count || '0', 10);
      const migrated = parseInt(migratedCount.rows[0]?.count || '0', 10);
      tests.push({
        name: 'All transactions migrated',
        status: migrated >= legacy ? 'pass' : 'fail',
        message: `${migrated} of ${legacy} transactions migrated`,
        details: legacy > 0 ? `Legacy table has ${legacy} rows, ${migrated} migrated` : 'No legacy transactions',
      });
    } catch (error: any) {
      tests.push({
        name: 'All transactions migrated',
        status: 'error',
        message: error.message,
      });
    }

    // Test 2: Verify l2_customer_summary_view uses l1_transaction_facts
    try {
      const viewDef = await pool.query(`
        SELECT definition
        FROM pg_views
        WHERE viewname = 'l2_customer_summary_view'
      `);
      if (viewDef.rows.length > 0) {
        const definition = viewDef.rows[0].definition.toLowerCase();
        const usesL1 = definition.includes('l1_transaction_facts');
        const usesLegacy = definition.includes('transactions') && !definition.includes('l1_transaction_facts');
        tests.push({
          name: 'l2_customer_summary_view uses l1_transaction_facts',
          status: usesL1 && !usesLegacy ? 'pass' : 'fail',
          message: usesL1 ? 'View uses l1_transaction_facts' : 'View does not use l1_transaction_facts',
          details: usesLegacy ? 'View still references transactions table' : 'View correctly uses l1_transaction_facts',
        });
      } else {
        tests.push({
          name: 'l2_customer_summary_view uses l1_transaction_facts',
          status: 'warn',
          message: 'View does not exist',
        });
      }
    } catch (error: any) {
      tests.push({
        name: 'l2_customer_summary_view uses l1_transaction_facts',
        status: 'error',
        message: error.message,
      });
    }

    // Test 3: Verify transactions table has no foreign keys (ready to drop)
    try {
      const fkCheck = await pool.query(`
        SELECT COUNT(*) as count
        FROM information_schema.table_constraints
        WHERE table_name = 'transactions'
          AND constraint_type = 'FOREIGN KEY'
      `);
      const fkCount = parseInt(fkCheck.rows[0]?.count || '0', 10);
      tests.push({
        name: 'transactions table foreign keys removed',
        status: fkCount === 0 ? 'pass' : 'fail',
        message: fkCount === 0 ? 'No foreign keys' : `${fkCount} foreign key(s) still exist`,
        details: fkCount > 0 ? 'Foreign keys must be dropped before dropping transactions table' : 'Ready to drop',
      });
    } catch (error: any) {
      tests.push({
        name: 'transactions table foreign keys removed',
        status: 'error',
        message: error.message,
      });
    }

    // Test 4: Verify accounts table has no foreign keys (ready to drop)
    try {
      const fkCheck = await pool.query(`
        SELECT COUNT(*) as count
        FROM information_schema.table_constraints
        WHERE table_name = 'accounts'
          AND constraint_type = 'FOREIGN KEY'
      `);
      const fkCount = parseInt(fkCheck.rows[0]?.count || '0', 10);
      tests.push({
        name: 'accounts table foreign keys removed',
        status: fkCount === 0 ? 'pass' : 'fail',
        message: fkCount === 0 ? 'No foreign keys' : `${fkCount} foreign key(s) still exist`,
        details: fkCount > 0 ? 'Foreign keys must be dropped before dropping accounts table' : 'Ready to drop',
      });
    } catch (error: any) {
      tests.push({
        name: 'accounts table foreign keys removed',
        status: 'warn',
        message: 'accounts table may not exist',
      });
    }

    // Test 5: Verify no views depend on transactions table
    try {
      const viewCheck = await pool.query(`
        SELECT viewname
        FROM pg_views
        WHERE schemaname = 'public'
          AND definition LIKE '%transactions%'
          AND definition NOT LIKE '%l1_transaction_facts%'
      `);
      const dependentViews = viewCheck.rows.map((r: any) => r.viewname);
      tests.push({
        name: 'No views depend on transactions table',
        status: dependentViews.length === 0 ? 'pass' : 'fail',
        message: dependentViews.length === 0 ? 'No dependent views' : `${dependentViews.length} view(s) still depend on transactions`,
        details: dependentViews.length > 0 ? `Views: ${dependentViews.join(', ')}` : 'All views updated',
      });
    } catch (error: any) {
      tests.push({
        name: 'No views depend on transactions table',
        status: 'error',
        message: error.message,
      });
    }

    // Test 6: Verify data consistency (transaction counts match)
    try {
      const l1Count = await pool.query(`
        SELECT COUNT(DISTINCT tokenized_user_id) as user_count, COUNT(*) as tx_count
        FROM l1_transaction_facts
      `);
      const legacyCount = await pool.query(`
        SELECT COUNT(DISTINCT user_id) as user_count, COUNT(*) as tx_count
        FROM transactions
      `);
      const l1Users = parseInt(l1Count.rows[0]?.user_count || '0', 10);
      const l1Txs = parseInt(l1Count.rows[0]?.tx_count || '0', 10);
      const legacyUsers = parseInt(legacyCount.rows[0]?.user_count || '0', 10);
      const legacyTxs = parseInt(legacyCount.rows[0]?.tx_count || '0', 10);
      
      tests.push({
        name: 'Data consistency check',
        status: l1Txs >= legacyTxs ? 'pass' : 'warn',
        message: `L1: ${l1Txs} transactions, ${l1Users} users | Legacy: ${legacyTxs} transactions, ${legacyUsers} users`,
        details: l1Txs >= legacyTxs ? 'All data migrated' : 'Some transactions may not be migrated',
      });
    } catch (error: any) {
      tests.push({
        name: 'Data consistency check',
        status: 'error',
        message: error.message,
      });
    }

    // Test 7: Verify tokenization coverage
    try {
      const tokenizedUsers = await pool.query(`
        SELECT COUNT(DISTINCT internal_user_id) as count
        FROM l0_user_tokenization
      `);
      const totalUsers = await pool.query(`
        SELECT COUNT(*) as count
        FROM users
        WHERE email != $1
      `, [ADMIN_EMAIL]);
      const tokenized = parseInt(tokenizedUsers.rows[0]?.count || '0', 10);
      const total = parseInt(totalUsers.rows[0]?.count || '0', 10);
      tests.push({
        name: 'Tokenization coverage',
        status: tokenized >= total ? 'pass' : 'warn',
        message: `${tokenized} of ${total} users have tokenization`,
        details: tokenized >= total ? 'All users tokenized' : `${total - tokenized} users missing tokenization`,
      });
    } catch (error: any) {
      tests.push({
        name: 'Tokenization coverage',
        status: 'error',
        message: error.message,
      });
    }

    // Calculate summary
    const passed = tests.filter((t) => t.status === 'pass').length;
    const failed = tests.filter((t) => t.status === 'fail').length;
    const warnings = tests.filter((t) => t.status === 'warn').length;
    const errors = tests.filter((t) => t.status === 'error').length;

    return NextResponse.json({
      success: failed === 0 && errors === 0,
      summary: {
        total: tests.length,
        passed,
        failed,
        warnings,
        errors,
      },
      tests,
    });
  } catch (error: any) {
    console.error('[Test Single Source API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to run tests', details: error.message },
      { status: 500 }
    );
  }
}

