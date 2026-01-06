/**
 * Integration Tests: Data Migration Integrity
 * Tests that data migrations don't create duplicates or lose data
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { newDb } from 'pg-mem';
import { Client } from 'pg';

describe('Data Migration Integrity', () => {
  let db: any;
  let client: Client;

  beforeAll(async () => {
    db = newDb();
    
    db.public.registerFunction({
      name: 'current_database',
      implementation: () => 'test',
    });

    const adapter = db.adapters.createPg();
    const MockClient = adapter.Client;
    client = new MockClient();
    await client.connect();

    // Create legacy schema
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        date DATE NOT NULL,
        description TEXT NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        category TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create new L0/L1 schema
    await client.query(`
      CREATE TABLE IF NOT EXISTS l0_user_tokenization (
        internal_user_id INTEGER PRIMARY KEY REFERENCES users(id),
        tokenized_user_id TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS l1_transaction_facts (
        id SERIAL PRIMARY KEY,
        tokenized_user_id TEXT NOT NULL REFERENCES l0_user_tokenization(tokenized_user_id),
        transaction_date DATE NOT NULL,
        description TEXT NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        cashflow TEXT NOT NULL,
        account TEXT NOT NULL,
        category TEXT NOT NULL,
        legacy_transaction_id INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });

  afterAll(async () => {
    if (client) {
      await client.end();
    }
  });

  it('should tokenize all users without duplicates', async () => {
    // Insert test users
    await client.query('INSERT INTO users (email) VALUES ($1)', ['user1@test.com']);
    await client.query('INSERT INTO users (email) VALUES ($1)', ['user2@test.com']);

    // Simulate tokenization (would use actual tokenization function)
    await client.query(`
      INSERT INTO l0_user_tokenization (internal_user_id, tokenized_user_id)
      VALUES (1, 'token1'), (2, 'token2')
      ON CONFLICT (internal_user_id) DO NOTHING
    `);

    const tokenizedCount = await client.query('SELECT COUNT(*) FROM l0_user_tokenization');
    const usersCount = await client.query('SELECT COUNT(*) FROM users');

    expect(parseInt(tokenizedCount.rows[0].count)).toBe(parseInt(usersCount.rows[0].count));
  });

  it('should migrate transactions without data loss', async () => {
    // Insert transaction for user 1
    await client.query(`
      INSERT INTO transactions (user_id, date, description, amount, category)
      VALUES (1, '2024-01-15', 'Test Transaction', -50.00, 'Food')
    `);

    // Simulate migration (would use actual migration function)
    await client.query(`
      INSERT INTO l1_transaction_facts 
      (tokenized_user_id, transaction_date, description, amount, cashflow, account, category, legacy_transaction_id)
      SELECT 
        ut.tokenized_user_id,
        t.date,
        t.description,
        t.amount,
        'expense',
        'Credit Card',
        t.category,
        t.id
      FROM transactions t
      JOIN l0_user_tokenization ut ON t.user_id = ut.internal_user_id
      WHERE NOT EXISTS (
        SELECT 1 FROM l1_transaction_facts tf 
        WHERE tf.legacy_transaction_id = t.id
      )
    `);

    const oldCount = await client.query('SELECT COUNT(*) FROM transactions');
    const newCount = await client.query('SELECT COUNT(*) FROM l1_transaction_facts');

    expect(parseInt(newCount.rows[0].count)).toBeGreaterThanOrEqual(parseInt(oldCount.rows[0].count));
  });

  it('should not create duplicate tokenized user records', async () => {
    // Try to insert duplicate tokenization
    await client.query(`
      INSERT INTO l0_user_tokenization (internal_user_id, tokenized_user_id)
      VALUES (1, 'token1')
      ON CONFLICT (internal_user_id) DO NOTHING
    `);

    const count = await client.query(`
      SELECT COUNT(*) FROM l0_user_tokenization WHERE internal_user_id = 1
    `);

    expect(parseInt(count.rows[0].count)).toBe(1); // Should still be 1, not 2
  });

  it('should maintain referential integrity', async () => {
    // All transactions in L1 should have valid tokenized user IDs
    const orphaned = await client.query(`
      SELECT COUNT(*) FROM l1_transaction_facts tf
      WHERE NOT EXISTS (
        SELECT 1 FROM l0_user_tokenization ut 
        WHERE ut.tokenized_user_id = tf.tokenized_user_id
      )
    `);

    expect(parseInt(orphaned.rows[0].count)).toBe(0); // No orphaned transactions
  });
});
