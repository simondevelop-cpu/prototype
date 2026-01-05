/**
 * Integration Tests: Transaction Deduplication
 * Tests that duplicate transactions are properly detected and handled
 * 
 * NOTE: These tests use pg-mem for in-memory PostgreSQL
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { newDb } from 'pg-mem';
import { Pool } from 'pg';

describe('Transaction Deduplication', () => {
  let db: any;
  let pool: Pool;

  beforeAll(async () => {
    // Create in-memory PostgreSQL database
    db = newDb();
    
    db.public.registerFunction({
      name: 'current_database',
      implementation: () => 'test',
    });
    
    db.public.registerFunction({
      name: 'version',
      implementation: () => 'PostgreSQL 14.0',
    });

    const connectionString = db.adapters.createPg().connectionString;
    pool = new Pool({ connectionString });

    // Create test schema
    await pool.query(`
      CREATE TABLE IF NOT EXISTS l1_transaction_facts (
        id SERIAL PRIMARY KEY,
        tokenized_user_id TEXT NOT NULL,
        transaction_date DATE NOT NULL,
        description TEXT NOT NULL,
        merchant TEXT,
        amount NUMERIC(12, 2) NOT NULL,
        cashflow TEXT NOT NULL,
        account TEXT NOT NULL,
        category TEXT NOT NULL,
        label TEXT DEFAULT '',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
  });

  it('should detect duplicate transactions', async () => {
    const tokenizedUserId = 'test_user_123';
    
    // Insert first transaction
    await pool.query(`
      INSERT INTO l1_transaction_facts 
      (tokenized_user_id, transaction_date, description, merchant, amount, cashflow, account, category)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [tokenizedUserId, '2024-01-15', 'TIM HORTONS', 'TIM HORTONS', -5.50, 'expense', 'Credit Card', 'Food']);

    // Try to insert duplicate (same date, merchant, amount, cashflow)
    const duplicateCheck = await pool.query(`
      SELECT id FROM l1_transaction_facts 
      WHERE tokenized_user_id = $1 
      AND transaction_date = $2 
      AND amount = $3 
      AND merchant = $4 
      AND cashflow = $5
    `, [tokenizedUserId, '2024-01-15', -5.50, 'TIM HORTONS', 'expense']);

    expect(duplicateCheck.rows.length).toBeGreaterThan(0);
  });

  it('should allow transactions with different dates', async () => {
    const tokenizedUserId = 'test_user_456';
    
    // Insert transaction on date 1
    await pool.query(`
      INSERT INTO l1_transaction_facts 
      (tokenized_user_id, transaction_date, description, merchant, amount, cashflow, account, category)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [tokenizedUserId, '2024-01-15', 'TIM HORTONS', 'TIM HORTONS', -5.50, 'expense', 'Credit Card', 'Food']);

    // Insert same transaction on different date (should NOT be duplicate)
    const duplicateCheck = await pool.query(`
      SELECT id FROM l1_transaction_facts 
      WHERE tokenized_user_id = $1 
      AND transaction_date = $2 
      AND amount = $3 
      AND merchant = $4 
      AND cashflow = $5
    `, [tokenizedUserId, '2024-01-16', -5.50, 'TIM HORTONS', 'expense']);

    expect(duplicateCheck.rows.length).toBe(0); // Not a duplicate (different date)
  });

  it('should allow transactions with different amounts', async () => {
    const tokenizedUserId = 'test_user_789';
    
    // Insert transaction with amount 1
    await pool.query(`
      INSERT INTO l1_transaction_facts 
      (tokenized_user_id, transaction_date, description, merchant, amount, cashflow, account, category)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [tokenizedUserId, '2024-01-15', 'TIM HORTONS', 'TIM HORTONS', -5.50, 'expense', 'Credit Card', 'Food']);

    // Insert same transaction with different amount (should NOT be duplicate)
    const duplicateCheck = await pool.query(`
      SELECT id FROM l1_transaction_facts 
      WHERE tokenized_user_id = $1 
      AND transaction_date = $2 
      AND amount = $3 
      AND merchant = $4 
      AND cashflow = $5
    `, [tokenizedUserId, '2024-01-15', -10.00, 'TIM HORTONS', 'expense']);

    expect(duplicateCheck.rows.length).toBe(0); // Not a duplicate (different amount)
  });

  it('should isolate duplicates per user', async () => {
    const user1 = 'user_1';
    const user2 = 'user_2';
    
    // User 1 inserts transaction
    await pool.query(`
      INSERT INTO l1_transaction_facts 
      (tokenized_user_id, transaction_date, description, merchant, amount, cashflow, account, category)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [user1, '2024-01-15', 'TIM HORTONS', 'TIM HORTONS', -5.50, 'expense', 'Credit Card', 'Food']);

    // User 2 inserts same transaction (should NOT be duplicate - different user)
    const duplicateCheck = await pool.query(`
      SELECT id FROM l1_transaction_facts 
      WHERE tokenized_user_id = $1 
      AND transaction_date = $2 
      AND amount = $3 
      AND merchant = $4 
      AND cashflow = $5
    `, [user2, '2024-01-15', -5.50, 'TIM HORTONS', 'expense']);

    expect(duplicateCheck.rows.length).toBe(0); // Not a duplicate (different user)
  });
});
