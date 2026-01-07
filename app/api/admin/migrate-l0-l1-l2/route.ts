/**
 * L0/L1/L2 Data Architecture Migration Endpoint
 * Creates the new layered architecture schema and migrates data
 */

import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL !== 'false' ? { rejectUnauthorized: false } : false,
});

async function runSQLFile(filePath: string): Promise<void> {
  const sql = fs.readFileSync(filePath, 'utf8');
  const client = await pool.connect();
  try {
    await client.query(sql);
  } finally {
    client.release();
  }
}

async function verifyMigration(client: any) {
  const results: Record<string, any> = {};
  
  // Check tokenized users
  const userCount = await client.query('SELECT COUNT(*) as count FROM l0_user_tokenization');
  results.tokenizedUsers = parseInt(userCount.rows[0].count);
  
  // Check PII records
  const piiCount = await client.query('SELECT COUNT(*) as count FROM l0_pii_users');
  results.piiRecords = parseInt(piiCount.rows[0].count);
  
  // Check transaction facts
  const txCount = await client.query('SELECT COUNT(*) as count FROM l1_transaction_facts');
  results.transactionFacts = parseInt(txCount.rows[0].count);
  
  // Check customer facts
  const customerCount = await client.query('SELECT COUNT(*) as count FROM l1_customer_facts');
  results.customerFacts = parseInt(customerCount.rows[0].count);
  
  // Check categories
  const categoryCount = await client.query('SELECT COUNT(*) as count FROM l0_category_list');
  results.categories = parseInt(categoryCount.rows[0].count);
  
  // Verify tokenization integrity
  const orphanedTx = await client.query(`
    SELECT COUNT(*) as count 
    FROM l1_transaction_facts tf
    WHERE NOT EXISTS (
      SELECT 1 FROM l0_user_tokenization ut WHERE ut.tokenized_user_id = tf.tokenized_user_id
    )
  `);
  results.orphanedTransactions = parseInt(orphanedTx.rows[0].count);
  
  return results;
}

export async function POST() {
  const steps: string[] = [];
  const errors: string[] = [];

  try {
    // Test connection
    await pool.query('SELECT 1');
    steps.push('✅ Database connection established');

    // Enable pgcrypto extension (required for digest function)
    try {
      await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
      steps.push('✅ pgcrypto extension enabled');
    } catch (error: any) {
      // Extension might already exist or might require superuser - try to continue
      steps.push('ℹ️ pgcrypto extension check completed');
    }

    // Run schema creation
    try {
      const schemaPath = path.join(process.cwd(), 'migrations', 'create-l0-l1-l2-schema.sql');
      await runSQLFile(schemaPath);
      steps.push('✅ Schema creation completed');
    } catch (error: any) {
      const errorMsg = `Schema creation failed: ${error.message}`;
      errors.push(errorMsg);
      steps.push(`❌ ${errorMsg}`);
      throw error;
    }

    // Run data migration
    try {
      const dataPath = path.join(process.cwd(), 'migrations', 'migrate-data-to-l0-l1.sql');
      await runSQLFile(dataPath);
      steps.push('✅ Data migration completed');
    } catch (error: any) {
      const errorMsg = `Data migration failed: ${error.message}`;
      errors.push(errorMsg);
      steps.push(`❌ ${errorMsg}`);
      throw error;
    }

    // Verify migration
    const client = await pool.connect();
    try {
      const verification = await verifyMigration(client);
      steps.push(`✅ Verification: ${verification.tokenizedUsers} tokenized users, ${verification.transactionFacts} transactions, ${verification.customerFacts} customers`);
      
      return NextResponse.json({
        success: true,
        message: 'L0/L1/L2 migration completed successfully',
        steps,
        verification,
      });
    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('[L0/L1/L2 Migration] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Migration failed',
        details: error.message,
        steps,
        errors,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Check current state
    const client = await pool.connect();
    try {
      const tableCheck = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN (
          'l0_user_tokenization',
          'l0_pii_users',
          'l1_transaction_facts',
          'l1_customer_facts'
        )
        ORDER BY table_name
      `);
      
      const newTables = tableCheck.rows.map(r => r.table_name);
      
      // Get counts if tables exist
      const counts: Record<string, number> = {};
      if (newTables.length > 0) {
        for (const table of newTables) {
          try {
            const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
            counts[table] = parseInt(result.rows[0].count);
          } catch (e) {
            counts[table] = -1; // Error
          }
        }
      }
      
      // Check old tables
      const oldUserCount = await client.query('SELECT COUNT(*) as count FROM users');
      const oldTxCount = await client.query('SELECT COUNT(*) as count FROM transactions');
      
      return NextResponse.json({
        schemaExists: newTables.length > 0,
        newTables,
        counts,
        oldTables: {
          users: parseInt(oldUserCount.rows[0].count),
          transactions: parseInt(oldTxCount.rows[0].count),
        },
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to check migration status', details: error.message },
      { status: 500 }
    );
  }
}

