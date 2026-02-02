/**
 * Integration Tests: Event Logging
 * Verifies that events are properly logged to l1_events table
 * Tests login, transaction edit, bulk edit, and statement upload events
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { newDb } from 'pg-mem';
import { Client, Pool } from 'pg';
import { NextRequest } from 'next/server';
import { POST as loginHandler } from '@/app/api/auth/login/route';
import { PUT as updateTransactionHandler } from '@/app/api/transactions/update/route';
import { POST as bulkUpdateHandler } from '@/app/api/transactions/bulk-update/route';
import * as dbModule from '@/lib/db';
import * as authModule from '@/lib/auth';
import { hashPassword } from '@/lib/auth';

describe('Event Logging', () => {
  let db: any;
  let testClient: Client;
  let mockPool: Pool;
  let testUserId: number;
  let testTokenizedUserId: string;

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

      CREATE TABLE IF NOT EXISTS l1_events (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        tokenized_user_id TEXT REFERENCES l0_user_tokenization(tokenized_user_id),
        event_type TEXT NOT NULL,
        event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB,
        is_admin BOOLEAN DEFAULT FALSE,
        session_id TEXT
      );
    `);

    vi.spyOn(dbModule, 'getPool').mockReturnValue(mockPool);

    // Create test user
    const passwordHash = await hashPassword('testpassword123');
    const userResult = await testClient.query(
      `INSERT INTO users (email, password_hash) VALUES ('eventtest@test.com', $1) RETURNING id`,
      [passwordHash]
    );
    testUserId = userResult.rows[0].id;
    testTokenizedUserId = `token_user_${testUserId}`;

    // Create tokenized user ID
    await testClient.query(
      `INSERT INTO l0_user_tokenization (internal_user_id, tokenized_user_id) 
       VALUES ($1, $2)`,
      [testUserId, testTokenizedUserId]
    );

    // Create a test transaction
    await testClient.query(
      `INSERT INTO l1_transaction_facts 
       (tokenized_user_id, transaction_date, description, merchant, amount, cashflow, account, category, label)
       VALUES ($1, CURRENT_DATE, 'Test Transaction', 'Test Merchant', 100.00, 'expense', 'Test Account', 'Food', '')`,
      [testTokenizedUserId]
    );
  });

  afterAll(async () => {
    if (testClient) {
      await testClient.end();
    }
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    await testClient.query('DELETE FROM l1_events');
  });

  describe('Login Event Logging', () => {
    it('should log login event when user logs in', async () => {
      const request = new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'origin': 'http://localhost',
        },
        body: JSON.stringify({
          email: 'eventtest@test.com',
          password: 'testpassword123',
        }),
      });

      const response = await loginHandler(request);
      expect(response.status).toBe(200);

      const events = await testClient.query(
        `SELECT event_type, user_id FROM l1_events WHERE event_type = 'login'`
      );

      expect(events.rows.length).toBe(1);
      expect(events.rows[0].event_type).toBe('login');
      expect(events.rows[0].user_id).toBe(testUserId);
    });
  });

  describe('Transaction Edit Event Logging', () => {
    it('should log transaction edit event when transaction is updated', async () => {
      // Get transaction ID
      const txResult = await testClient.query(
        `SELECT id FROM l1_transaction_facts WHERE tokenized_user_id = $1 LIMIT 1`,
        [testTokenizedUserId]
      );
      const txId = txResult.rows[0].id;

      // Create token
      const token = authModule.createToken(testUserId);

      const request = new NextRequest('http://localhost/api/transactions/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'origin': 'http://localhost',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: txId,
          description: 'Updated Description',
          category: 'Groceries',
        }),
      });

      const response = await updateTransactionHandler(request);
      expect(response.status).toBe(200);

      const events = await testClient.query(
        `SELECT event_type, user_id, metadata FROM l1_events WHERE event_type = 'transaction_edit'`
      );

      expect(events.rows.length).toBe(1);
      expect(events.rows[0].event_type).toBe('transaction_edit');
      expect(events.rows[0].user_id).toBe(testUserId);
      
      const metadata = typeof events.rows[0].metadata === 'string' 
        ? JSON.parse(events.rows[0].metadata) 
        : events.rows[0].metadata;
      expect(metadata.transactionId).toBe(txId);
      expect(metadata.changes).toBeDefined();
      expect(metadata.changes.length).toBeGreaterThan(0);
    });
  });

  describe('Bulk Edit Event Logging', () => {
    it('should log bulk edit event when multiple transactions are updated', async () => {
      // Create another transaction
      await testClient.query(
        `INSERT INTO l1_transaction_facts 
         (tokenized_user_id, transaction_date, description, merchant, amount, cashflow, account, category, label)
         VALUES ($1, CURRENT_DATE, 'Test Transaction 2', 'Test Merchant 2', 200.00, 'expense', 'Test Account', 'Food', '')`,
        [testTokenizedUserId]
      );

      // Get transaction IDs
      const txResult = await testClient.query(
        `SELECT id FROM l1_transaction_facts WHERE tokenized_user_id = $1`,
        [testTokenizedUserId]
      );
      const txIds = txResult.rows.map((r: any) => r.id);

      // Create token
      const token = authModule.createToken(testUserId);

      const request = new NextRequest('http://localhost/api/transactions/bulk-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'origin': 'http://localhost',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          transactionIds: txIds,
          updates: {
            category: 'Groceries',
          },
        }),
      });

      const response = await bulkUpdateHandler(request);
      expect(response.status).toBe(200);

      const events = await testClient.query(
        `SELECT event_type, user_id, metadata FROM l1_events WHERE event_type = 'bulk_edit'`
      );

      expect(events.rows.length).toBe(1);
      expect(events.rows[0].event_type).toBe('bulk_edit');
      expect(events.rows[0].user_id).toBe(testUserId);
      
      const metadata = typeof events.rows[0].metadata === 'string' 
        ? JSON.parse(events.rows[0].metadata) 
        : events.rows[0].metadata;
      expect(metadata.transactionIds).toBeDefined();
      expect(Array.isArray(metadata.transactionIds)).toBe(true);
      expect(metadata.transactionIds.length).toBe(txIds.length);
    });
  });
});

