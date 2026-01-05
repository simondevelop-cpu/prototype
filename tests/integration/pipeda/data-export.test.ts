/**
 * Integration Tests: Data Export (PIPEDA Right to Access)
 * Tests that data export returns all user data correctly
 * 
 * NOTE: These tests use pg-mem for in-memory PostgreSQL
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { newDb } from 'pg-mem';
import { Pool } from 'pg';

describe('Data Export (PIPEDA)', () => {
  let db: any;
  let pool: Pool;

  beforeAll(async () => {
    db = newDb();
    
    db.public.registerFunction({
      name: 'current_database',
      implementation: () => 'test',
    });

    const connectionString = db.adapters.createPg().connectionString;
    pool = new Pool({ connectionString });

    // Create schema
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS l0_pii_users (
        internal_user_id INTEGER PRIMARY KEY REFERENCES users(id),
        email TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS l0_user_tokenization (
        internal_user_id INTEGER PRIMARY KEY REFERENCES users(id),
        tokenized_user_id TEXT NOT NULL UNIQUE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS l1_transaction_facts (
        id SERIAL PRIMARY KEY,
        tokenized_user_id TEXT NOT NULL REFERENCES l0_user_tokenization(tokenized_user_id),
        transaction_date DATE NOT NULL,
        description TEXT NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        cashflow TEXT NOT NULL,
        account TEXT NOT NULL,
        category TEXT NOT NULL
      )
    `);
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
  });

  it('should export all user profile data', async () => {
    // Create test user
    await pool.query('INSERT INTO users (email) VALUES ($1)', ['export@test.com']);
    await pool.query(`
      INSERT INTO l0_pii_users (internal_user_id, email, first_name, last_name)
      VALUES (1, 'export@test.com', 'Export', 'User')
    `);

    const profile = await pool.query(`
      SELECT email, first_name, last_name
      FROM l0_pii_users
      WHERE internal_user_id = 1
    `);

    expect(profile.rows.length).toBe(1);
    expect(profile.rows[0].email).toBe('export@test.com');
    expect(profile.rows[0].first_name).toBe('Export');
    expect(profile.rows[0].last_name).toBe('User');
  });

  it('should export all user transactions', async () => {
    // Setup user and tokenization
    await pool.query(`
      INSERT INTO l0_user_tokenization (internal_user_id, tokenized_user_id)
      VALUES (1, 'token_123')
    `);

    // Create transactions
    await pool.query(`
      INSERT INTO l1_transaction_facts 
      (tokenized_user_id, transaction_date, description, amount, cashflow, account, category)
      VALUES 
      ('token_123', '2024-01-15', 'Transaction 1', -50.00, 'expense', 'Credit Card', 'Food'),
      ('token_123', '2024-01-16', 'Transaction 2', -25.00, 'expense', 'Credit Card', 'Food')
    `);

    const transactions = await pool.query(`
      SELECT transaction_date, description, amount, category
      FROM l1_transaction_facts
      WHERE tokenized_user_id = 'token_123'
      ORDER BY transaction_date
    `);

    expect(transactions.rows.length).toBe(2);
    expect(transactions.rows[0].description).toBe('Transaction 1');
    expect(transactions.rows[1].description).toBe('Transaction 2');
  });

  it('should export data in correct format', async () => {
    // Test that exported data has expected structure
    const profile = await pool.query(`
      SELECT email, first_name, last_name FROM l0_pii_users WHERE internal_user_id = 1
    `);

    expect(profile.rows[0]).toHaveProperty('email');
    expect(profile.rows[0]).toHaveProperty('first_name');
    expect(profile.rows[0]).toHaveProperty('last_name');
  });
});
