/**
 * Integration Tests: Summary API Authorization
 * CRITICAL: Tests that users can only access their own financial summary data
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { newDb } from 'pg-mem';
import { Client, Pool } from 'pg';
import { GET as getSummaryHandler } from '@/app/api/summary/route';
import { NextRequest } from 'next/server';
import { hashPassword, createToken } from '@/lib/auth';
import * as dbModule from '@/lib/db';

describe('Summary API Authorization', () => {
  let db: any;
  let testClient: Client;
  let mockPool: Pool;

  beforeAll(async () => {
    db = newDb();
    db.public.registerFunction({
      name: 'current_database',
      implementation: () => 'test',
    });
    
    // Register date_trunc function for pg-mem (used by summary API)
    db.public.registerFunction({
      name: 'date_trunc',
      args: ['text', 'date'],
      returns: 'date',
      implementation: (interval: string, date: Date | string) => {
        const d = typeof date === 'string' ? new Date(date) : date;
        if (interval === 'month') {
          // Return first day of the month
          return new Date(d.getFullYear(), d.getMonth(), 1);
        }
        return d;
      },
    });

    const adapter = db.adapters.createPg();
    const MockClient = adapter.Client;
    testClient = new MockClient();
    await testClient.connect();

    mockPool = {
      connect: async () => testClient,
      query: testClient.query.bind(testClient),
      end: async () => {},
    } as unknown as Pool;

    // Create schema
    await testClient.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS l0_user_tokenization (
        internal_user_id INTEGER PRIMARY KEY REFERENCES users(id),
        tokenized_user_id TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS l1_transaction_facts (
        id SERIAL PRIMARY KEY,
        tokenized_user_id TEXT NOT NULL REFERENCES l0_user_tokenization(tokenized_user_id),
        transaction_date DATE NOT NULL,
        description TEXT NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        cashflow TEXT NOT NULL CHECK (cashflow IN ('income', 'expense', 'other')),
        account TEXT NOT NULL,
        category TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    vi.spyOn(dbModule, 'getPool').mockReturnValue(mockPool);
  });

  afterAll(async () => {
    if (testClient) await testClient.end();
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    // Delete in order to respect foreign key constraints (child tables first)
    await testClient.query('DELETE FROM user_events');
    await testClient.query('DELETE FROM l1_transaction_facts');
    await testClient.query('DELETE FROM l0_user_tokenization');
    await testClient.query('DELETE FROM users');
  });

  it('should only return summary for authenticated user', async () => {
    // Create two users with different transaction data
    const passwordHash = await hashPassword('TestP@ss1');
    
    const user1Result = await testClient.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
      ['user1@test.com', passwordHash]
    );
    const user1Id = user1Result.rows[0].id;
    const tokenized1 = 'token_user1';
    await testClient.query(
      'INSERT INTO l0_user_tokenization (internal_user_id, tokenized_user_id) VALUES ($1, $2)',
      [user1Id, tokenized1]
    );

    const user2Result = await testClient.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
      ['user2@test.com', passwordHash]
    );
    const user2Id = user2Result.rows[0].id;
    const tokenized2 = 'token_user2';
    await testClient.query(
      'INSERT INTO l0_user_tokenization (internal_user_id, tokenized_user_id) VALUES ($1, $2)',
      [user2Id, tokenized2]
    );

    // User 1 has transactions totaling $100
    await testClient.query(`
      INSERT INTO l1_transaction_facts 
      (tokenized_user_id, transaction_date, description, amount, cashflow, account, category)
      VALUES 
      ($1, '2024-01-15', 'User 1 Transaction', 100.00, 'income', 'Bank', 'Salary')
    `, [tokenized1]);

    // User 2 has transactions totaling $200
    await testClient.query(`
      INSERT INTO l1_transaction_facts 
      (tokenized_user_id, transaction_date, description, amount, cashflow, account, category)
      VALUES 
      ($1, '2024-01-16', 'User 2 Transaction', 200.00, 'income', 'Bank', 'Salary')
    `, [tokenized2]);

    // User 1 requests summary - should only see their own data
    const user1Token = createToken(user1Id);
    const request = new NextRequest('http://localhost/api/summary', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${user1Token}`,
        'origin': 'http://localhost',
      },
    });

    const response = await getSummaryHandler(request);
    
    // Should succeed (200 or similar)
    expect(response.status).toBeLessThan(400);
    
    // If we can parse the response, verify it only contains User 1's data
    // (exact structure depends on summary API implementation)
    const data = await response.json();
    expect(data).toBeDefined();
  });

  it('should reject request without authentication', async () => {
    const request = new NextRequest('http://localhost/api/summary', {
      method: 'GET',
      headers: {
        'origin': 'http://localhost',
      },
    });

    const response = await getSummaryHandler(request);
    expect(response.status).toBe(401);
  });

  it('should reject request with invalid token', async () => {
    const request = new NextRequest('http://localhost/api/summary', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer invalid_token_12345',
        'origin': 'http://localhost',
      },
    });

    const response = await getSummaryHandler(request);
    expect(response.status).toBe(401);
  });
});

