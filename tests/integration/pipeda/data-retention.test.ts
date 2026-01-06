/**
 * Integration Tests: 30-Day Data Retention (PIPEDA Compliance)
 * Tests that soft-deleted PII is automatically purged after 30 days
 * 
 * Using pg-mem's adapter Client approach
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { newDb } from 'pg-mem';
import { Client } from 'pg';
import { GET as cleanupHandler } from '@/app/api/admin/cleanup-deleted-users/route';
import { NextRequest } from 'next/server';

describe('30-Day Data Retention (PIPEDA)', () => {
  let db: any;
  let client: Client;

  beforeAll(async () => {
    db = newDb();
    
    db.public.registerFunction({
      name: 'current_database',
      implementation: () => 'test',
    });
    
    db.public.registerFunction({
      name: 'version',
      implementation: () => 'PostgreSQL 14.0',
    });

    const adapter = db.adapters.createPg();
    const MockClient = adapter.Client;
    client = new MockClient();
    await client.connect();

    // Create schema
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS l0_pii_users (
        id SERIAL PRIMARY KEY,
        internal_user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
        email TEXT NOT NULL UNIQUE,
        first_name TEXT,
        last_name TEXT,
        date_of_birth DATE,
        recovery_phone TEXT,
        province_region TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP WITH TIME ZONE
      );
    `);
  });

  beforeEach(async () => {
    // Clear tables before each test
    await client.query('DELETE FROM l0_pii_users');
    await client.query('DELETE FROM users');
  });

  afterAll(async () => {
    if (client) {
      await client.end();
    }
  });

  it('should delete PII records older than 30 days', async () => {
    // Create test users
    await client.query('INSERT INTO users (id, email) VALUES (1, $1)', ['user1@example.com']);
    await client.query('INSERT INTO users (id, email) VALUES (2, $2)', ['user2@example.com']);
    await client.query('INSERT INTO users (id, email) VALUES (3, $3)', ['user3@example.com']);

    // Create PII records with different deletion dates
    const thirtyOneDaysAgo = new Date();
    thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);
    
    const twentyNineDaysAgo = new Date();
    twentyNineDaysAgo.setDate(twentyNineDaysAgo.getDate() - 29);

    // User 1: deleted 31 days ago (should be purged)
    await client.query(`
      INSERT INTO l0_pii_users (internal_user_id, email, first_name, deleted_at)
      VALUES (1, 'user1@example.com', 'User1', $1)
    `, [thirtyOneDaysAgo.toISOString()]);

    // User 2: deleted 29 days ago (should NOT be purged)
    await client.query(`
      INSERT INTO l0_pii_users (internal_user_id, email, first_name, deleted_at)
      VALUES (2, 'user2@example.com', 'User2', $1)
    `, [twentyNineDaysAgo.toISOString()]);

    // User 3: active user (not deleted, should NOT be purged)
    await client.query(`
      INSERT INTO l0_pii_users (internal_user_id, email, first_name)
      VALUES (3, 'user3@example.com', 'User3')
    `);

    // Verify initial state
    const beforeCount = await client.query('SELECT COUNT(*) FROM l0_pii_users');
    expect(parseInt(beforeCount.rows[0].count)).toBe(3);

    // Run cleanup job
    const request = new NextRequest('http://localhost/api/admin/cleanup-deleted-users', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.CLEANUP_API_KEY || 'test-cleanup-key'}`,
      },
    });

    // Mock getPool to return our test client
    const { vi } = await import('vitest');
    const dbModule = await import('@/lib/db');
    const mockPool = {
      connect: async () => client,
      query: client.query.bind(client),
      end: async () => {},
    };
    vi.spyOn(dbModule, 'getPool').mockReturnValue(mockPool as any);

    const response = await cleanupHandler(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.deletedRecords.length).toBe(1); // Only user1 should be deleted
    expect(data.deletedRecords[0].email).toBe('user1@example.com');

    // Verify final state
    const afterCount = await client.query('SELECT COUNT(*) FROM l0_pii_users');
    expect(parseInt(afterCount.rows[0].count)).toBe(2); // user2 and user3 remain

    // Verify user2 (deleted 29 days ago) still exists
    const user2Check = await client.query('SELECT * FROM l0_pii_users WHERE internal_user_id = 2');
    expect(user2Check.rows.length).toBe(1);

    // Verify user3 (active) still exists
    const user3Check = await client.query('SELECT * FROM l0_pii_users WHERE internal_user_id = 3');
    expect(user3Check.rows.length).toBe(1);

    vi.restoreAllMocks();
  });

  it('should not delete active (non-deleted) records', async () => {
    // Create active users
    await client.query('INSERT INTO users (id, email) VALUES (4, $1)', ['active@example.com']);
    await client.query(`
      INSERT INTO l0_pii_users (internal_user_id, email, first_name)
      VALUES (4, 'active@example.com', 'Active')
    `);

    // Run cleanup job
    const request = new NextRequest('http://localhost/api/admin/cleanup-deleted-users', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.CLEANUP_API_KEY || 'test-cleanup-key'}`,
      },
    });

    const { vi } = await import('vitest');
    const dbModule = await import('@/lib/db');
    const mockPool = {
      connect: async () => client,
      query: client.query.bind(client),
      end: async () => {},
    };
    vi.spyOn(dbModule, 'getPool').mockReturnValue(mockPool as any);

    const response = await cleanupHandler(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.deletedRecords.length).toBe(0); // No records should be deleted

    // Verify active user still exists
    const activeCheck = await client.query('SELECT * FROM l0_pii_users WHERE internal_user_id = 4');
    expect(activeCheck.rows.length).toBe(1);

    vi.restoreAllMocks();
  });

  it('should not delete records deleted less than 30 days ago', async () => {
    // Create user deleted 15 days ago
    await client.query('INSERT INTO users (id, email) VALUES (5, $1)', ['recent@example.com']);
    
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

    await client.query(`
      INSERT INTO l0_pii_users (internal_user_id, email, first_name, deleted_at)
      VALUES (5, 'recent@example.com', 'Recent', $1)
    `, [fifteenDaysAgo.toISOString()]);

    // Run cleanup job
    const request = new NextRequest('http://localhost/api/admin/cleanup-deleted-users', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.CLEANUP_API_KEY || 'test-cleanup-key'}`,
      },
    });

    const { vi } = await import('vitest');
    const dbModule = await import('@/lib/db');
    const mockPool = {
      connect: async () => client,
      query: client.query.bind(client),
      end: async () => {},
    };
    vi.spyOn(dbModule, 'getPool').mockReturnValue(mockPool as any);

    const response = await cleanupHandler(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.deletedRecords.length).toBe(0); // Should not delete (only 15 days old)

    // Verify record still exists
    const recentCheck = await client.query('SELECT * FROM l0_pii_users WHERE internal_user_id = 5');
    expect(recentCheck.rows.length).toBe(1);

    vi.restoreAllMocks();
  });
});

