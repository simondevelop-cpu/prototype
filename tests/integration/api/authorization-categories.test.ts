/**
 * Integration Tests: Categories API Authorization
 * Verifies users can only access their own category data
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { newDb } from 'pg-mem';
import { Client, Pool } from 'pg';
import { GET as getCategoriesHandler } from '@/app/api/categories/route';
import { NextRequest } from 'next/server';
import { hashPassword, createToken } from '@/lib/auth';
import * as dbModule from '@/lib/db';
import dayjs from 'dayjs';

describe('Categories API Authorization', () => {
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

    // Register DATE_TRUNC function for pg-mem
    db.public.registerFunction({
      name: 'date_trunc',
      args: ['text', 'date'],
      returns: 'date',
      implementation: (interval: string, date: Date | string) => {
        const d = typeof date === 'string' ? dayjs(date) : dayjs(date);
        if (interval === 'month') {
          return d.startOf('month').toDate();
        } else if (interval === 'year') {
          return d.startOf('year').toDate();
        } else if (interval === 'day') {
          return d.startOf('day').toDate();
        }
        return d.toDate();
      },
    });

    // Register ABS function for pg-mem
    db.public.registerFunction({
      name: 'abs',
      args: ['float'],
      returns: 'float',
      implementation: (value: number) => Math.abs(value),
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

  describe('Happy Path', () => {
    it('should return categories for authenticated user', async () => {
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

      // Create transactions for user 1
      await testClient.query(`
        INSERT INTO l1_transaction_facts 
        (tokenized_user_id, transaction_date, description, amount, cashflow, account, category)
        VALUES 
        ($1, '2024-01-15', 'Groceries', -50.00, 'expense', 'Credit Card', 'Food'),
        ($1, '2024-01-20', 'Gas Station', -30.00, 'expense', 'Credit Card', 'Transport')
      `, [tokenized1]);

      const user1Token = createToken(user1Id);
      const request = new NextRequest('http://localhost/api/categories?cashflow=expense', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user1Token}`,
          'origin': 'http://localhost',
        },
      });

      const response = await getCategoriesHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('categories');
      expect(Array.isArray(data.categories)).toBe(true);
      expect(data.categories.length).toBeGreaterThan(0);
      // Should only see user 1's categories
      const categoryNames = data.categories.map((c: any) => c.category);
      expect(categoryNames).toContain('Food');
      expect(categoryNames).toContain('Transport');
    });
  });

  describe('Unhappy Path', () => {
    it('should reject request without authentication', async () => {
      const request = new NextRequest('http://localhost/api/categories', {
        method: 'GET',
        headers: {
          'origin': 'http://localhost',
        },
      });

      const response = await getCategoriesHandler(request);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('Unauthorized');
    });

    it('should reject request with invalid token', async () => {
      const request = new NextRequest('http://localhost/api/categories', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer invalid-token',
          'origin': 'http://localhost',
        },
      });

      const response = await getCategoriesHandler(request);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('Invalid token');
    });

    it('should only return categories for the authenticated user', async () => {
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

      // User 1 creates transaction with category "Food"
      await testClient.query(`
        INSERT INTO l1_transaction_facts 
        (tokenized_user_id, transaction_date, description, amount, cashflow, account, category)
        VALUES ($1, '2024-01-15', 'Groceries', -50.00, 'expense', 'Credit Card', 'Food')
      `, [tokenized1]);

      // User 2 creates transaction with category "Shopping"
      await testClient.query(`
        INSERT INTO l1_transaction_facts 
        (tokenized_user_id, transaction_date, description, amount, cashflow, account, category)
        VALUES ($1, '2024-01-16', 'Clothing Store', -100.00, 'expense', 'Credit Card', 'Shopping')
      `, [tokenized2]);

      // User 1 requests categories - should only see "Food"
      const user1Token = createToken(user1Id);
      const request = new NextRequest('http://localhost/api/categories?cashflow=expense', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user1Token}`,
          'origin': 'http://localhost',
        },
      });

      const response = await getCategoriesHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('categories');
      const categoryNames = data.categories.map((c: any) => c.category);
      expect(categoryNames).toContain('Food');
      expect(categoryNames).not.toContain('Shopping'); // User 2's category should not appear
    });
  });
});

