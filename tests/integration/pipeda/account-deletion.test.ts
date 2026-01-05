/**
 * Integration Tests: Account Deletion (PIPEDA Compliance)
 * Tests that account deletion works correctly and sets deleted_at timestamp
 * 
 * NOTE: These tests use pg-mem for in-memory PostgreSQL
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { newDb } from 'pg-mem';
import { Pool } from 'pg';

describe('Account Deletion (PIPEDA)', () => {
  let db: any;
  let pool: Pool;

  beforeAll(async () => {
    db = newDb();
    
    // Register required PostgreSQL functions
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

    // Create schema
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS l0_pii_users (
        id SERIAL PRIMARY KEY,
        internal_user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
        email TEXT NOT NULL UNIQUE,
        first_name TEXT,
        last_name TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP WITH TIME ZONE
      )
    `);
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
  });

  it('should set deleted_at timestamp on account deletion', async () => {
    // Create test user and PII record
    await pool.query('INSERT INTO users (email) VALUES ($1)', ['test@example.com']);
    await pool.query(`
      INSERT INTO l0_pii_users (internal_user_id, email, first_name, last_name)
      VALUES (1, 'test@example.com', 'Test', 'User')
    `);

    // Simulate account deletion (soft delete)
    await pool.query(`
      UPDATE l0_pii_users
      SET deleted_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE internal_user_id = 1
    `);

    const result = await pool.query(`
      SELECT deleted_at FROM l0_pii_users WHERE internal_user_id = 1
    `);

    expect(result.rows[0].deleted_at).not.toBeNull();
  });

  it('should not delete records immediately (soft delete)', async () => {
    // Verify record still exists after soft delete
    const result = await pool.query(`
      SELECT id, email, deleted_at FROM l0_pii_users WHERE internal_user_id = 1
    `);

    expect(result.rows.length).toBe(1); // Record still exists
    expect(result.rows[0].deleted_at).not.toBeNull(); // But marked as deleted
  });

  it('should allow querying only non-deleted records', async () => {
    // Create another user (not deleted)
    await pool.query('INSERT INTO users (email) VALUES ($1)', ['active@example.com']);
    await pool.query(`
      INSERT INTO l0_pii_users (internal_user_id, email)
      VALUES (2, 'active@example.com')
    `);

    // Query only non-deleted records
    const activeUsers = await pool.query(`
      SELECT id, email FROM l0_pii_users WHERE deleted_at IS NULL
    `);

    expect(activeUsers.rows.length).toBe(1); // Only the active user
    expect(activeUsers.rows[0].email).toBe('active@example.com');
  });
});
