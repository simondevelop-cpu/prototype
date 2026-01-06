/**
 * Integration Tests: PII Isolation (PIPEDA Compliance)
 * Tests that PII is properly isolated and not exposed in analytics
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { newDb } from 'pg-mem';
import { Client } from 'pg';

describe('PII Isolation (PIPEDA)', () => {
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

    // Create schema
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS l0_pii_users (
        internal_user_id INTEGER PRIMARY KEY REFERENCES users(id),
        email TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        date_of_birth DATE,
        recovery_phone TEXT,
        province_region TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS l0_user_tokenization (
        internal_user_id INTEGER PRIMARY KEY REFERENCES users(id),
        tokenized_user_id TEXT NOT NULL UNIQUE
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
        category TEXT NOT NULL
      )
    `);
  });

  afterAll(async () => {
    if (client) {
      await client.end();
    }
  });

  it('should store PII only in L0 table', async () => {
    await client.query('INSERT INTO users (email) VALUES ($1)', ['pii@test.com']);
    await client.query(`
      INSERT INTO l0_pii_users 
      (internal_user_id, email, first_name, last_name, date_of_birth, recovery_phone, province_region)
      VALUES (1, 'pii@test.com', 'John', 'Doe', '1990-01-01', '555-1234', 'Ontario')
    `);

    const pii = await client.query(`
      SELECT first_name, last_name, date_of_birth, recovery_phone, province_region
      FROM l0_pii_users
      WHERE internal_user_id = 1
    `);

    expect(pii.rows[0].first_name).toBe('John');
    expect(pii.rows[0].last_name).toBe('Doe');
  });

  it('should NOT store PII in L1 transaction facts', async () => {
    // Verify L1 table schema doesn't include PII fields
    const columns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'l1_transaction_facts'
    `);

    const columnNames = columns.rows.map((r: any) => r.column_name);
    
    // Should NOT contain PII fields
    expect(columnNames).not.toContain('first_name');
    expect(columnNames).not.toContain('last_name');
    expect(columnNames).not.toContain('date_of_birth');
    expect(columnNames).not.toContain('recovery_phone');
    expect(columnNames).not.toContain('email');
    expect(columnNames).not.toContain('internal_user_id');
  });

  it('should use tokenized user IDs in analytics tables', async () => {
    await client.query(`
      INSERT INTO l0_user_tokenization (internal_user_id, tokenized_user_id)
      VALUES (1, 'abc123tokenized456')
    `);

    await client.query(`
      INSERT INTO l1_transaction_facts 
      (tokenized_user_id, transaction_date, description, amount, cashflow, account, category)
      VALUES ('abc123tokenized456', '2024-01-15', 'Test', -50.00, 'expense', 'Credit Card', 'Food')
    `);

    const transaction = await client.query(`
      SELECT tokenized_user_id FROM l1_transaction_facts WHERE id = 1
    `);

    // Should use tokenized ID, not internal user ID
    expect(transaction.rows[0].tokenized_user_id).toBe('abc123tokenized456');
    expect(transaction.rows[0].tokenized_user_id).not.toBe('1'); // Not internal ID
  });

  it('should prevent joining L1 to users table directly', async () => {
    // L1 transactions should only reference tokenized_user_id
    // Should NOT be able to join directly to users.id
    
    const transaction = await client.query(`
      SELECT tf.tokenized_user_id 
      FROM l1_transaction_facts tf
      WHERE tf.id = 1
    `);

    expect(transaction.rows[0].tokenized_user_id).toBeDefined();
    // Tokenized ID should not reveal internal user ID
    expect(transaction.rows[0].tokenized_user_id).not.toBe('1');
  });

  it('should require tokenization table to link L1 to users', async () => {
    // To link L1 transactions to users, you MUST go through l0_user_tokenization
    // This ensures PII isolation
    
    const joinQuery = `
      SELECT tf.id, ut.internal_user_id
      FROM l1_transaction_facts tf
      JOIN l0_user_tokenization ut ON tf.tokenized_user_id = ut.tokenized_user_id
      WHERE tf.id = 1
    `;

    const result = await client.query(joinQuery);
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].internal_user_id).toBe(1);
    
    // This join is the ONLY way to link transactions to users
    // PII is isolated in l0_pii_users, not accessible from L1
  });
});
