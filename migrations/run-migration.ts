/**
 * Migration Script: Run L0/L1/L2 Schema Migration
 * 
 * IMPORTANT: This script creates the schema and migrates HISTORICAL data only.
 * 
 * RECOMMENDED APPROACH (Direct Migration - No Duplication):
 * 1. Run this script to create schema (schema only, or with data migration)
 * 2. Update ALL application code to use new tables
 * 3. After code is updated, run data migration if you haven't already
 * 
 * This avoids duplicate data - new writes go directly to new tables.
 * 
 * Usage:
 *   ts-node migrations/run-migration.ts [--schema-only]
 *   or
 *   npm run migrate [--schema-only]
 * 
 * Options:
 *   --schema-only: Only create schema, skip data migration (for code update first)
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  ssl: process.env.DATABASE_SSL !== 'false' ? { rejectUnauthorized: false } : false,
});

async function runSQLFile(filePath: string): Promise<void> {
  const sql = fs.readFileSync(filePath, 'utf8');
  console.log(`\n[Migration] Running ${path.basename(filePath)}...`);
  
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log(`[Migration] ✅ Completed ${path.basename(filePath)}`);
  } catch (error: any) {
    console.error(`[Migration] ❌ Error in ${path.basename(filePath)}:`, error.message);
    throw error;
  } finally {
    client.release();
  }
}

async function verifyMigration(): Promise<void> {
  console.log('\n[Verification] Checking migration results...');
  
  const client = await pool.connect();
  try {
    // Check tokenized users
    const userCount = await client.query('SELECT COUNT(*) as count FROM l0_user_tokenization');
    console.log(`[Verification] ✅ Tokenized users: ${userCount.rows[0].count}`);
    
    // Check PII records
    const piiCount = await client.query('SELECT COUNT(*) as count FROM l0_pii_users');
    console.log(`[Verification] ✅ PII records: ${piiCount.rows[0].count}`);
    
    // Check transaction facts
    const txCount = await client.query('SELECT COUNT(*) as count FROM l1_transaction_facts');
    console.log(`[Verification] ✅ Transaction facts: ${txCount.rows[0].count}`);
    
    // Check customer facts
    const customerCount = await client.query('SELECT COUNT(*) as count FROM l1_customer_facts');
    console.log(`[Verification] ✅ Customer facts: ${customerCount.rows[0].count}`);
    
    // Check categories
    const categoryCount = await client.query('SELECT COUNT(*) as count FROM l0_category_list');
    console.log(`[Verification] ✅ Categories: ${categoryCount.rows[0].count}`);
    
    // Verify tokenization integrity
    const orphanedTx = await client.query(`
      SELECT COUNT(*) as count 
      FROM l1_transaction_facts tf
      WHERE NOT EXISTS (
        SELECT 1 FROM l0_user_tokenization ut WHERE ut.tokenized_user_id = tf.tokenized_user_id
      )
    `);
    
    if (parseInt(orphanedTx.rows[0].count) > 0) {
      console.warn(`[Verification] ⚠️  Found ${orphanedTx.rows[0].count} orphaned transaction facts`);
    } else {
      console.log(`[Verification] ✅ All transaction facts have valid tokenized user IDs`);
    }
    
  } catch (error: any) {
    console.error('[Verification] ❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  const schemaOnly = process.argv.includes('--schema-only');
  
  console.log('='.repeat(60));
  console.log('Data Architecture Migration: L0/L1/L2 Schema');
  if (schemaOnly) {
    console.log('Mode: Schema Only (skip data migration)');
  }
  console.log('='.repeat(60));
  
  try {
    // Test connection
    await pool.query('SELECT 1');
    console.log('[Migration] ✅ Database connection established');
    
    // Run schema creation
    const schemaPath = path.join(__dirname, 'create-l0-l1-l2-schema.sql');
    await runSQLFile(schemaPath);
    
    if (schemaOnly) {
      console.log('\n[Migration] ⏭️  Skipping data migration (schema-only mode)');
      console.log('\n[Next Steps]');
      console.log('1. Update ALL application code to use new L1 tables');
      console.log('2. Test all functionality with new schema');
      console.log('3. Run data migration after code is updated:');
      console.log('   psql $DATABASE_URL -f migrations/migrate-data-to-l0-l1.sql');
      console.log('   OR re-run without --schema-only flag');
    } else {
      // Run data migration
      const dataPath = path.join(__dirname, 'migrate-data-to-l0-l1.sql');
      await runSQLFile(dataPath);
      
      // Verify migration
      await verifyMigration();
      
      console.log('\n' + '='.repeat(60));
      console.log('✅ Migration completed successfully!');
      console.log('='.repeat(60));
      
      console.log('\n[Next Steps]');
      console.log('1. Update application code to use new L1 tables');
      console.log('2. Test queries against new schema');
      console.log('3. Update API endpoints to use tokenized user IDs for analytics');
      console.log('4. Ensure PII queries only access L0 tables');
      console.log('\n⚠️  Note: Until code is updated, new data will continue going to old tables.');
      console.log('   Consider updating code FIRST, then running data migration.');
    }
    
  } catch (error: any) {
    console.error('\n[Migration] ❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { main as runMigration };

