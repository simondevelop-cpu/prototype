/**
 * Integration Tests: Account Export API Authorization
 * Verifies users can only export their own data
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { newDb } from 'pg-mem';
import { Client, Pool } from 'pg';
import { GET as exportHandler } from '@/app/api/account/export/route';
import { NextRequest } from 'next/server';
import { hashPassword, createToken } from '@/lib/auth';
import * as dbModule from '@/lib/db';

describe('Account Export API Authorization', () => {
  let db: any;
  let testClient: Client;
  let mockPool: Pool;

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
        display_name TEXT,
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
        merchant TEXT,
        amount NUMERIC(12, 2) NOT NULL,
        cashflow TEXT NOT NULL CHECK (cashflow IN ('income', 'expense', 'other')),
        account TEXT NOT NULL,
        category TEXT NOT NULL,
        label TEXT DEFAULT '',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS onboarding_responses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        emotional_state TEXT,
        financial_context TEXT,
        motivation TEXT,
        completed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    vi.spyOn(dbModule, 'getPool').mockReturnValue(mockPool);
  });

  afterAll(async () => {
    if (testClient) {
      await testClient.end();
    }
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    await testClient.query('DELETE FROM onboarding_responses');
    await testClient.query('DELETE FROM l1_transaction_facts');
    await testClient.query('DELETE FROM l0_user_tokenization');
    await testClient.query('DELETE FROM l0_pii_users');
    await testClient.query('DELETE FROM users');
  });

  describe('Happy Path', () => {
    it('should export data for authenticated user', async () => {
      // Create user with PII
      const passwordHash = await hashPassword('TestP@ss1');
      const userResult = await testClient.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
        ['export@test.com', passwordHash]
      );
      const userId = userResult.rows[0].id;
      const tokenizedId = 'token_export';
      await testClient.query(
        'INSERT INTO l0_user_tokenization (internal_user_id, tokenized_user_id) VALUES ($1, $2)',
        [userId, tokenizedId]
      );
      await testClient.query(
        'INSERT INTO l0_pii_users (internal_user_id, email, first_name, last_name) VALUES ($1, $2, $3, $4)',
        [userId, 'export@test.com', 'Export', 'User']
      );

      // Create transactions
      await testClient.query(`
        INSERT INTO l1_transaction_facts 
        (tokenized_user_id, transaction_date, description, amount, cashflow, account, category)
        VALUES ($1, '2024-01-15', 'Test Transaction', -50.00, 'expense', 'Credit Card', 'Food')
      `, [tokenizedId]);

      const token = createToken(userId);
      const request = new NextRequest('http://localhost/api/account/export?format=json', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'origin': 'http://localhost',
        },
      });

      const response = await exportHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('profile');
      expect(data).toHaveProperty('transactions');
      expect(data.profile.email).toBe('export@test.com');
      expect(data.transactions.length).toBe(1);
    });
  });

  describe('Unhappy Path', () => {
    it('should reject request without authentication', async () => {
      const request = new NextRequest('http://localhost/api/account/export', {
        method: 'GET',
        headers: {
          'origin': 'http://localhost',
        },
      });

      const response = await exportHandler(request);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('Unauthorized');
    });

    it('should reject request with invalid token', async () => {
      const request = new NextRequest('http://localhost/api/account/export', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer invalid-token',
          'origin': 'http://localhost',
        },
      });

      const response = await exportHandler(request);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('Invalid token');
    });

    it('should only export data for the authenticated user', async () => {
      // Create user 1
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
      await testClient.query(
        'INSERT INTO l0_pii_users (internal_user_id, email, first_name) VALUES ($1, $2, $3)',
        [user1Id, 'user1@test.com', 'User1']
      );

      // Create user 2
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
      await testClient.query(
        'INSERT INTO l0_pii_users (internal_user_id, email, first_name) VALUES ($1, $2, $3)',
        [user2Id, 'user2@test.com', 'User2']
      );

      // User 1 creates transaction
      await testClient.query(`
        INSERT INTO l1_transaction_facts 
        (tokenized_user_id, transaction_date, description, amount, cashflow, account, category)
        VALUES ($1, '2024-01-15', 'User1 Transaction', -50.00, 'expense', 'Credit Card', 'Food')
      `, [tokenized1]);

      // User 2 creates transaction
      await testClient.query(`
        INSERT INTO l1_transaction_facts 
        (tokenized_user_id, transaction_date, description, amount, cashflow, account, category)
        VALUES ($1, '2024-01-16', 'User2 Transaction', -100.00, 'expense', 'Credit Card', 'Shopping')
      `, [tokenized2]);

      // User 1 exports data - should only see their own
      const user1Token = createToken(user1Id);
      const request = new NextRequest('http://localhost/api/account/export', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user1Token}`,
          'origin': 'http://localhost',
        },
      });

      const response = await exportHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.profile.email).toBe('user1@test.com');
      expect(data.transactions.length).toBe(1);
      expect(data.transactions[0].description).toBe('User1 Transaction');
      expect(data.transactions[0].description).not.toBe('User2 Transaction');
    });
  });
});

