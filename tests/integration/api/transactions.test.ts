/**
 * Integration Tests: Transactions API Routes
 * Tests transaction CRUD operations and authorization
 * CRITICAL: Verifies users can only access their own transactions
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { newDb } from 'pg-mem';
import { Client, Pool } from 'pg';
import { GET as getTransactionsHandler } from '@/app/api/transactions/route';
import { POST as createTransactionHandler } from '@/app/api/transactions/create/route';
import { PUT as updateTransactionHandler } from '@/app/api/transactions/update/route';
import { DELETE as deleteTransactionHandler } from '@/app/api/transactions/delete/route';
import { NextRequest } from 'next/server';
import { hashPassword, createToken } from '@/lib/auth';
import * as dbModule from '@/lib/db';

describe('Transactions API', () => {
  let db: any;
  let testClient: Client;
  let mockPool: Pool;

  beforeAll(async () => {
    db = newDb();
    
    db.public.registerFunction({
      name: 'current_database',
      implementation: () => 'test',
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
    await testClient.query('DELETE FROM l1_transaction_facts');
    await testClient.query('DELETE FROM l0_user_tokenization');
    await testClient.query('DELETE FROM users');
  });

  describe('POST /api/transactions/create', () => {
    it('should create a transaction for authenticated user', async () => {
      // Create user and tokenization
      const passwordHash = await hashPassword('TestP@ss1');
      const userResult = await testClient.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
        ['user1@test.com', passwordHash]
      );
      const userId = userResult.rows[0].id;
      await testClient.query(
        'INSERT INTO l0_user_tokenization (internal_user_id, tokenized_user_id) VALUES ($1, $2)',
        [userId, 'token_user1']
      );

      const token = createToken(userId);
      const request = new NextRequest('http://localhost/api/transactions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'origin': 'http://localhost',
        },
        body: JSON.stringify({
          date: '2024-01-15',
          description: 'Test Transaction',
          amount: -50.00,
          cashflow: 'expense',
          category: 'Food',
          account: 'Credit Card',
        }),
      });

      const response = await createTransactionHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.transaction.description).toBe('Test Transaction');
      expect(data.transaction.amount).toBe(-50.00);
    });

    it('should reject transaction creation without authentication', async () => {
      const request = new NextRequest('http://localhost/api/transactions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'origin': 'http://localhost',
        },
        body: JSON.stringify({
          date: '2024-01-15',
          description: 'Test Transaction',
          amount: -50.00,
          cashflow: 'expense',
        }),
      });

      const response = await createTransactionHandler(request);
      expect(response.status).toBe(401);
    });

    it('should reject transaction with missing required fields', async () => {
      const passwordHash = await hashPassword('TestP@ss1');
      const userResult = await testClient.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
        ['user2@test.com', passwordHash]
      );
      const userId = userResult.rows[0].id;
      await testClient.query(
        'INSERT INTO l0_user_tokenization (internal_user_id, tokenized_user_id) VALUES ($1, $2)',
        [userId, 'token_user2']
      );

      const token = createToken(userId);
      const request = new NextRequest('http://localhost/api/transactions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'origin': 'http://localhost',
        },
        body: JSON.stringify({
          description: 'Test Transaction',
          // Missing date, amount, cashflow
        }),
      });

      const response = await createTransactionHandler(request);
      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/transactions', () => {
    it('should return transactions for authenticated user', async () => {
      // Create user and tokenization
      const passwordHash = await hashPassword('TestP@ss1');
      const userResult = await testClient.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
        ['user3@test.com', passwordHash]
      );
      const userId = userResult.rows[0].id;
      const tokenizedId = 'token_user3';
      await testClient.query(
        'INSERT INTO l0_user_tokenization (internal_user_id, tokenized_user_id) VALUES ($1, $2)',
        [userId, tokenizedId]
      );

      // Create transactions
      await testClient.query(`
        INSERT INTO l1_transaction_facts 
        (tokenized_user_id, transaction_date, description, amount, cashflow, account, category)
        VALUES 
        ($1, '2024-01-15', 'Transaction 1', -25.00, 'expense', 'Credit Card', 'Food'),
        ($1, '2024-01-16', 'Transaction 2', 100.00, 'income', 'Bank', 'Salary')
      `, [tokenizedId]);

      const token = createToken(userId);
      const request = new NextRequest('http://localhost/api/transactions', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'origin': 'http://localhost',
        },
      });

      const response = await getTransactionsHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('transactions');
      expect(Array.isArray(data.transactions)).toBe(true);
      expect(data.transactions.length).toBe(2);
      expect(data.transactions[0].description).toBe('Transaction 2'); // Ordered by date DESC
    });

    it('should reject request without authentication', async () => {
      const request = new NextRequest('http://localhost/api/transactions', {
        method: 'GET',
        headers: {
          'origin': 'http://localhost',
        },
      });

      const response = await getTransactionsHandler(request);
      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/transactions/update', () => {
    it('should update transaction for authenticated user', async () => {
      // Create user and transaction
      const passwordHash = await hashPassword('TestP@ss1');
      const userResult = await testClient.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
        ['user4@test.com', passwordHash]
      );
      const userId = userResult.rows[0].id;
      const tokenizedId = 'token_user4';
      await testClient.query(
        'INSERT INTO l0_user_tokenization (internal_user_id, tokenized_user_id) VALUES ($1, $2)',
        [userId, tokenizedId]
      );

      const txResult = await testClient.query(`
        INSERT INTO l1_transaction_facts 
        (tokenized_user_id, transaction_date, description, amount, cashflow, account, category)
        VALUES ($1, '2024-01-15', 'Original', -50.00, 'expense', 'Credit Card', 'Food')
        RETURNING id
      `, [tokenizedId]);
      const txId = txResult.rows[0].id;

      const token = createToken(userId);
      const request = new NextRequest('http://localhost/api/transactions/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'origin': 'http://localhost',
        },
        body: JSON.stringify({
          id: txId,
          description: 'Updated Description',
          category: 'Groceries',
        }),
      });

      const response = await updateTransactionHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.transaction.description).toBe('Updated Description');
      expect(data.transaction.category).toBe('Groceries');
    });

    it('should reject update without transaction ID', async () => {
      const passwordHash = await hashPassword('TestP@ss1');
      const userResult = await testClient.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
        ['user5@test.com', passwordHash]
      );
      const userId = userResult.rows[0].id;

      const token = createToken(userId);
      const request = new NextRequest('http://localhost/api/transactions/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'origin': 'http://localhost',
        },
        body: JSON.stringify({
          description: 'Updated',
        }),
      });

      const response = await updateTransactionHandler(request);
      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/transactions/delete', () => {
    it('should delete transaction for authenticated user', async () => {
      // Create user and transaction
      const passwordHash = await hashPassword('TestP@ss1');
      const userResult = await testClient.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
        ['user6@test.com', passwordHash]
      );
      const userId = userResult.rows[0].id;
      const tokenizedId = 'token_user6';
      await testClient.query(
        'INSERT INTO l0_user_tokenization (internal_user_id, tokenized_user_id) VALUES ($1, $2)',
        [userId, tokenizedId]
      );

      const txResult = await testClient.query(`
        INSERT INTO l1_transaction_facts 
        (tokenized_user_id, transaction_date, description, amount, cashflow, account, category)
        VALUES ($1, '2024-01-15', 'To Delete', -30.00, 'expense', 'Credit Card', 'Food')
        RETURNING id
      `, [tokenizedId]);
      const txId = txResult.rows[0].id;

      const token = createToken(userId);
      const request = new NextRequest(`http://localhost/api/transactions/delete?id=${txId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'origin': 'http://localhost',
        },
      });

      const response = await deleteTransactionHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify transaction is deleted
      const checkResult = await testClient.query(
        'SELECT id FROM l1_transaction_facts WHERE id = $1',
        [txId]
      );
      expect(checkResult.rows.length).toBe(0);
    });

    it('should reject delete without transaction ID', async () => {
      const passwordHash = await hashPassword('TestP@ss1');
      const userResult = await testClient.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
        ['user7@test.com', passwordHash]
      );
      const userId = userResult.rows[0].id;

      const token = createToken(userId);
      const request = new NextRequest('http://localhost/api/transactions/delete', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'origin': 'http://localhost',
        },
      });

      const response = await deleteTransactionHandler(request);
      expect(response.status).toBe(400);
    });
  });

  describe('Authorization - User Data Isolation', () => {
    it('should prevent user from accessing another user\'s transactions', async () => {
      // Create two users
      const passwordHash = await hashPassword('TestP@ss1');
      const user1Result = await testClient.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
        ['user8@test.com', passwordHash]
      );
      const user1Id = user1Result.rows[0].id;
      const tokenized1 = 'token_user8';
      await testClient.query(
        'INSERT INTO l0_user_tokenization (internal_user_id, tokenized_user_id) VALUES ($1, $2)',
        [user1Id, tokenized1]
      );

      const user2Result = await testClient.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
        ['user9@test.com', passwordHash]
      );
      const user2Id = user2Result.rows[0].id;
      const tokenized2 = 'token_user9';
      await testClient.query(
        'INSERT INTO l0_user_tokenization (internal_user_id, tokenized_user_id) VALUES ($1, $2)',
        [user2Id, tokenized2]
      );

      // User 1 creates a transaction
      const txResult = await testClient.query(`
        INSERT INTO l1_transaction_facts 
        (tokenized_user_id, transaction_date, description, amount, cashflow, account, category)
        VALUES ($1, '2024-01-15', 'User 1 Transaction', -100.00, 'expense', 'Credit Card', 'Food')
        RETURNING id
      `, [tokenized1]);
      const txId = txResult.rows[0].id;

      // User 2 tries to access User 1's transaction
      const user2Token = createToken(user2Id);
      const request = new NextRequest(`http://localhost/api/transactions/delete?id=${txId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user2Token}`,
          'origin': 'http://localhost',
        },
      });

      const response = await deleteTransactionHandler(request);
      expect(response.status).toBe(404); // Should not find transaction (belongs to different user)

      // Verify transaction still exists
      const checkResult = await testClient.query(
        'SELECT id FROM l1_transaction_facts WHERE id = $1',
        [txId]
      );
      expect(checkResult.rows.length).toBe(1); // Transaction should still exist
    });

    it('should only return transactions for the authenticated user', async () => {
      // Create two users
      const passwordHash = await hashPassword('TestP@ss1');
      const user1Result = await testClient.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
        ['user10@test.com', passwordHash]
      );
      const user1Id = user1Result.rows[0].id;
      const tokenized1 = 'token_user10';
      await testClient.query(
        'INSERT INTO l0_user_tokenization (internal_user_id, tokenized_user_id) VALUES ($1, $2)',
        [user1Id, tokenized1]
      );

      const user2Result = await testClient.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
        ['user11@test.com', passwordHash]
      );
      const user2Id = user2Result.rows[0].id;
      const tokenized2 = 'token_user11';
      await testClient.query(
        'INSERT INTO l0_user_tokenization (internal_user_id, tokenized_user_id) VALUES ($1, $2)',
        [user2Id, tokenized2]
      );

      // Each user creates transactions
      await testClient.query(`
        INSERT INTO l1_transaction_facts 
        (tokenized_user_id, transaction_date, description, amount, cashflow, account, category)
        VALUES ($1, '2024-01-15', 'User 1 Transaction', -50.00, 'expense', 'Credit Card', 'Food')
      `, [tokenized1]);

      await testClient.query(`
        INSERT INTO l1_transaction_facts 
        (tokenized_user_id, transaction_date, description, amount, cashflow, account, category)
        VALUES ($1, '2024-01-16', 'User 2 Transaction', -75.00, 'expense', 'Credit Card', 'Food')
      `, [tokenized2]);

      // User 1 requests transactions - should only see their own
      const user1Token = createToken(user1Id);
      const request = new NextRequest('http://localhost/api/transactions', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user1Token}`,
          'origin': 'http://localhost',
        },
      });

      const response = await getTransactionsHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('transactions');
      expect(data.transactions.length).toBe(1);
      expect(data.transactions[0].description).toBe('User 1 Transaction');
    });
  });
});

