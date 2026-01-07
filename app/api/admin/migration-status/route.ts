/**
 * Migration Status Checker
 * Checks if L0/L1/L2 tables exist and shows migration status
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
});

export async function GET(request: NextRequest) {
  try {
    const tables = {
      'l0_pii_users': false,
      'l0_user_tokenization': false,
      'l0_category_list': false,
      'l0_privacy_metadata': false,
      'l1_transaction_facts': false,
      'l1_customer_facts': false,
      'l1_file_ingestion': false,
      'l2_transactions_view': false,
    };

    const counts: Record<string, number> = {};
    const errors: string[] = [];

    // Check if tables exist and get counts
    for (const tableName of Object.keys(tables)) {
      try {
        const result = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          )
        `, [tableName]);
        
        tables[tableName as keyof typeof tables] = result.rows[0].exists;
        
        if (result.rows[0].exists) {
          // Get row count
          const countResult = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
          counts[tableName] = parseInt(countResult.rows[0].count);
        }
      } catch (error: any) {
        errors.push(`${tableName}: ${error.message}`);
      }
    }

    // Check old tables for comparison
    const oldTableCounts: Record<string, number> = {};
    try {
      const usersResult = await pool.query('SELECT COUNT(*) as count FROM users');
      oldTableCounts.users = parseInt(usersResult.rows[0].count);
    } catch (e: any) {
      errors.push(`users table: ${e.message}`);
    }

    try {
      const txResult = await pool.query('SELECT COUNT(*) as count FROM transactions');
      oldTableCounts.transactions = parseInt(txResult.rows[0].count);
    } catch (e: any) {
      errors.push(`transactions table: ${e.message}`);
    }

    const allTablesExist = Object.values(tables).every(exists => exists);
    const hasData = Object.values(counts).some(count => count > 0);

    return NextResponse.json({
      migrated: allTablesExist && hasData,
      tablesExist: allTablesExist,
      hasData,
      tables,
      counts,
      oldTableCounts,
      errors: errors.length > 0 ? errors : undefined,
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Migration Status] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check migration status', details: error.message },
      { status: 500 }
    );
  }
}

