import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';

export const dynamic = 'force-dynamic';

/**
 * Investigate unmigrated transactions and table dependencies
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

    const results: any = {};

    // 1. Find unmigrated transactions
    try {
      const unmigrated = await pool.query(`
        SELECT 
          t.id,
          t.user_id,
          t.date,
          t.description,
          t.amount,
          t.created_at,
          u.email,
          CASE 
            WHEN lut.internal_user_id IS NULL THEN 'No tokenization record'
            WHEN ltf.legacy_transaction_id IS NOT NULL THEN 'Already migrated'
            ELSE 'Not migrated'
          END as status,
          lut.tokenized_user_id
        FROM transactions t
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN l0_user_tokenization lut ON lut.internal_user_id = t.user_id
        LEFT JOIN l1_transaction_facts ltf ON ltf.legacy_transaction_id = t.id
        WHERE ltf.legacy_transaction_id IS NULL
        ORDER BY t.created_at DESC
        LIMIT 10
      `);
      results.unmigratedTransactions = unmigrated.rows;
    } catch (error: any) {
      results.unmigratedTransactionsError = error.message;
    }

    // 2. Check accounts table usage
    try {
      const accountsCheck = await pool.query(`
        SELECT 
          COUNT(*) as row_count,
          (SELECT COUNT(*) FROM information_schema.table_constraints 
           WHERE table_name = 'accounts' AND constraint_type = 'FOREIGN KEY') as fk_count,
          (SELECT COUNT(*) FROM information_schema.key_column_usage kcu
           JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
           WHERE tc.table_name != 'accounts' 
           AND kcu.referenced_table_name = 'accounts') as referenced_by_count
        FROM accounts
      `);
      results.accounts = accountsCheck.rows[0];
    } catch (error: any) {
      results.accountsError = error.message;
    }

    // 3. Check for views using transactions
    try {
      const viewsCheck = await pool.query(`
        SELECT 
          viewname,
          definition
        FROM pg_views
        WHERE schemaname = 'public'
          AND definition LIKE '%transactions%'
      `);
      results.viewsUsingTransactions = viewsCheck.rows;
    } catch (error: any) {
      results.viewsError = error.message;
    }

    // 4. Check foreign keys on transactions table
    try {
      const fkCheck = await pool.query(`
        SELECT
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'transactions'
      `);
      results.transactionsForeignKeys = fkCheck.rows;
    } catch (error: any) {
      results.fkError = error.message;
    }

    // 5. Check empty tables and their dependencies
    const emptyTables = ['l0_admin_list', 'l0_insight_list', 'l0_privacy_metadata', 
                         'l1_file_ingestion', 'l1_job_list', 'l1_support_tickets'];
    results.emptyTablesAnalysis = [];

    for (const tableName of emptyTables) {
      try {
        const tableCheck = await pool.query(`
          SELECT 
            COUNT(*) as row_count,
            (SELECT COUNT(*) FROM information_schema.table_constraints 
             WHERE table_name = $1 AND constraint_type = 'FOREIGN KEY') as fk_count,
            (SELECT COUNT(*) FROM information_schema.key_column_usage kcu
             JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
             WHERE tc.table_name != $1 
             AND kcu.referenced_table_name = $1) as referenced_by_count
          FROM "${tableName}"
        `, [tableName]);

        const fkFromCheck = await pool.query(`
          SELECT
            tc.constraint_name,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
          FROM information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name = $1
        `, [tableName]);

        results.emptyTablesAnalysis.push({
          tableName,
          rowCount: parseInt(tableCheck.rows[0]?.row_count || '0', 10),
          foreignKeysFrom: fkFromCheck.rows,
          referencedBy: parseInt(tableCheck.rows[0]?.referenced_by_count || '0', 10),
        });
      } catch (error: any) {
        results.emptyTablesAnalysis.push({
          tableName,
          error: error.message,
        });
      }
    }

    // 6. Check l1_customer_facts for PII fields
    try {
      const customerFactsCheck = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'l1_customer_facts'
        AND column_name IN ('age_range', 'province_region', 'migration_flag', 'user_segment')
      `);
      results.customerFactsPIIFields = customerFactsCheck.rows;
    } catch (error: any) {
      results.customerFactsError = error.message;
    }

    // 7. Check where consents are logged
    try {
      const consentsCheck = await pool.query(`
        SELECT 
          COUNT(*) as total_consents,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT metadata->>'consentType') as consent_types
        FROM l1_events
        WHERE event_type = 'consent'
      `);
      results.consents = consentsCheck.rows[0];
    } catch (error: any) {
      results.consentsError = error.message;
    }

    return NextResponse.json({
      success: true,
      investigation: results,
    });
  } catch (error: any) {
    console.error('[Investigation API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to investigate', details: error.message },
      { status: 500 }
    );
  }
}

