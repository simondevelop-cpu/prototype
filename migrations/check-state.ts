/**
 * Quick script to check current database state before migration
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  ssl: process.env.DATABASE_SSL !== 'false' ? { rejectUnauthorized: false } : false,
});

async function checkState() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking database state...\n');
    
    // Check if new tables exist
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
    console.log('📊 New L0/L1 tables found:', newTables.length > 0 ? newTables.join(', ') : 'None');
    
    if (newTables.length > 0) {
      // Check counts in new tables
      for (const table of newTables) {
        try {
          const count = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
          console.log(`   ${table}: ${count.rows[0].count} rows`);
        } catch (e) {
          console.log(`   ${table}: Error checking count`);
        }
      }
    }
    
    // Check old tables
    console.log('\n📊 Old tables:');
    const oldUserCount = await client.query('SELECT COUNT(*) as count FROM users');
    const oldTxCount = await client.query('SELECT COUNT(*) as count FROM transactions');
    console.log(`   users: ${oldUserCount.rows[0].count} rows`);
    console.log(`   transactions: ${oldTxCount.rows[0].count} rows`);
    
    // Summary
    console.log('\n✅ Status:');
    if (newTables.length === 0) {
      console.log('   Schema not created yet - safe to run migration');
    } else if (newTables.length < 4) {
      console.log('   ⚠️  Partial schema exists - migration may need to handle this');
    } else {
      const tokenCount = await client.query('SELECT COUNT(*) as count FROM l0_user_tokenization');
      if (parseInt(tokenCount.rows[0].count) === 0) {
        console.log('   Schema exists but no data migrated - safe to run data migration');
      } else {
        console.log('   ✅ Schema and data exist - migration may have already run');
      }
    }
    
  } catch (error: any) {
    console.error('❌ Error checking state:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

checkState();

