import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';

export const dynamic = 'force-dynamic';

/**
 * Maintenance-focused Single Source of Truth and PII Isolation Tests
 * These tests verify ongoing compliance, not migration status
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

    // ============================================
    // SINGLE SOURCE OF TRUTH TESTS (Maintenance)
    // ============================================

    // Test 1: Verify l1_transaction_facts is the only transaction table
    try {
      const transactionTables = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN ('transactions', 'l1_transaction_facts')
      `);
      
      const tableNames = transactionTables.rows.map((r: any) => r.table_name);
      const hasLegacy = tableNames.includes('transactions');
      const hasL1 = tableNames.includes('l1_transaction_facts');
      
      tests.push({
        name: 'Single Source of Truth - Transactions',
        status: hasL1 && !hasLegacy ? 'pass' : 'fail',
        message: hasL1 && !hasLegacy 
          ? 'l1_transaction_facts is the only transaction table'
          : hasLegacy 
          ? 'Legacy transactions table still exists - violates SSOT'
          : 'l1_transaction_facts table missing',
        details: hasLegacy 
          ? 'Legacy transactions table must be dropped to maintain SSOT'
          : 'All transactions use l1_transaction_facts',
      });
    } catch (error: any) {
      tests.push({
        name: 'Single Source of Truth - Transactions',
        status: 'error',
        message: error.message,
      });
    }

    // Test 2: Verify l1_events is the only events table
    try {
      const eventTables = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN ('user_events', 'l1_events', 'l1_event_facts')
      `);
      
      const tableNames = eventTables.rows.map((r: any) => r.table_name);
      const hasLegacy = tableNames.includes('user_events');
      const hasL1 = tableNames.includes('l1_events');
      const hasOldL1 = tableNames.includes('l1_event_facts');
      
      tests.push({
        name: 'Single Source of Truth - Events',
        status: hasL1 && !hasLegacy && !hasOldL1 ? 'pass' : 'fail',
        message: hasL1 && !hasLegacy && !hasOldL1
          ? 'l1_events is the only events table'
          : hasLegacy || hasOldL1
          ? 'Legacy event tables still exist - violates SSOT'
          : 'l1_events table missing',
        details: hasLegacy || hasOldL1
          ? `Legacy tables found: ${tableNames.filter((n: string) => n !== 'l1_events').join(', ')}`
          : 'All events use l1_events',
      });
    } catch (error: any) {
      tests.push({
        name: 'Single Source of Truth - Events',
        status: 'error',
        message: error.message,
      });
    }

    // Test 3: Verify views use l1_transaction_facts
    try {
      const views = await pool.query(`
        SELECT viewname, definition
        FROM pg_views
        WHERE schemaname = 'public'
          AND definition LIKE '%transaction%'
      `);
      
      const violations: string[] = [];
      for (const view of views.rows) {
        const def = view.definition.toLowerCase();
        if (def.includes('transactions') && !def.includes('l1_transaction_facts')) {
          violations.push(view.viewname);
        }
      }
      
      tests.push({
        name: 'Views use Single Source of Truth',
        status: violations.length === 0 ? 'pass' : 'fail',
        message: violations.length === 0
          ? 'All views use l1_transaction_facts'
          : `${violations.length} view(s) still reference legacy tables`,
        details: violations.length > 0 
          ? `Views to update: ${violations.join(', ')}`
          : 'All views correctly use l1_transaction_facts',
      });
    } catch (error: any) {
      tests.push({
        name: 'Views use Single Source of Truth',
        status: 'error',
        message: error.message,
      });
    }

    // Test 4: Verify tokenization coverage
    try {
      const tokenizedCount = await pool.query(`
        SELECT COUNT(DISTINCT internal_user_id) as count
        FROM l0_user_tokenization
      `);
      const totalUsers = await pool.query(`
        SELECT COUNT(*) as count
        FROM users
        WHERE email != $1
      `, [ADMIN_EMAIL]);
      
      const tokenized = parseInt(tokenizedCount.rows[0]?.count || '0', 10);
      const total = parseInt(totalUsers.rows[0]?.count || '0', 10);
      
      tests.push({
        name: 'Tokenization Coverage',
        status: tokenized >= total ? 'pass' : 'warn',
        message: `${tokenized} of ${total} users have tokenization`,
        details: tokenized >= total 
          ? 'All users have tokenization'
          : `${total - tokenized} users missing tokenization`,
      });
    } catch (error: any) {
      tests.push({
        name: 'Tokenization Coverage',
        status: 'error',
        message: error.message,
      });
    }

    // ============================================
    // PII ISOLATION TESTS
    // ============================================

    // Get all PII variables from l0_pii_users
    const piiVariables = [
      'email',
      'first_name',
      'last_name',
      'date_of_birth',
      'recovery_phone',
      'province_region',
      'ip_address',
    ];

    // Test 5: Verify l0_pii_users table exists and has all PII variables
    try {
      const piiColumns = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'l0_pii_users'
      `);
      
      const columnNames = piiColumns.rows.map((r: any) => r.column_name);
      const missingPII = piiVariables.filter(v => !columnNames.includes(v));
      
      tests.push({
        name: 'PII Table Structure',
        status: missingPII.length === 0 ? 'pass' : 'fail',
        message: missingPII.length === 0
          ? `All ${piiVariables.length} PII variables present in l0_pii_users`
          : `${missingPII.length} PII variable(s) missing from l0_pii_users`,
        details: missingPII.length > 0
          ? `Missing: ${missingPII.join(', ')}`
          : `PII variables: ${piiVariables.join(', ')}`,
      });
    } catch (error: any) {
      tests.push({
        name: 'PII Table Structure',
        status: 'error',
        message: error.message,
      });
    }

    // Test 6-12: Check each PII variable doesn't exist in other tables
    for (const piiVar of piiVariables) {
      try {
        // Get all tables except l0_pii_users
        const allTables = await pool.query(`
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
            AND table_name != 'l0_pii_users'
            AND table_name NOT LIKE 'pg_%'
            AND table_name NOT LIKE 'sql_%'
          ORDER BY table_name
        `);
        
        const violations: string[] = [];
        for (const table of allTables.rows) {
          const tableName = table.table_name;
          const columns = await pool.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = $1
              AND column_name = $2
          `, [tableName, piiVar]);
          
          if (columns.rows.length > 0) {
            violations.push(tableName);
          }
        }
        
        // Allow user_id/internal_user_id in other tables (not PII)
        const isUserId = piiVar === 'internal_user_id' || piiVar === 'email'; // email is allowed in users table for auth
        const allowedTables = isUserId ? ['users', 'l0_user_tokenization'] : [];
        const actualViolations = violations.filter(t => !allowedTables.includes(t));
        
        tests.push({
          name: `PII Isolation - ${piiVar}`,
          status: actualViolations.length === 0 ? 'pass' : 'fail',
          message: actualViolations.length === 0
            ? `${piiVar} only exists in l0_pii_users`
            : `${piiVar} found in ${actualViolations.length} other table(s)`,
          details: actualViolations.length > 0
            ? `Violations: ${actualViolations.join(', ')}`
            : 'PII properly isolated',
        });
      } catch (error: any) {
        tests.push({
          name: `PII Isolation - ${piiVar}`,
          status: 'error',
          message: error.message,
        });
      }
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
    console.error('[Maintenance Tests API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to run maintenance tests', details: error.message },
      { status: 500 }
    );
  }
}

