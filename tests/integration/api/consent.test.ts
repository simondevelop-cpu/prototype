/**
 * Integration Tests: Consent API
 * Verifies /api/consent logs consent events into l1_events
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { newDb } from 'pg-mem';
import { Client, Pool } from 'pg';
import { NextRequest } from 'next/server';
import { POST as consentHandler } from '@/app/api/consent/route';
import * as dbModule from '@/lib/db';
import * as authModule from '@/lib/auth';

describe('Consent API', () => {
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

    await testClient.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE
      );

      CREATE TABLE IF NOT EXISTS l0_user_tokenization (
        internal_user_id INTEGER PRIMARY KEY REFERENCES users(id),
        tokenized_user_id TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS l1_events (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        tokenized_user_id TEXT REFERENCES l0_user_tokenization(tokenized_user_id),
        event_type TEXT NOT NULL,
        event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB,
        is_admin BOOLEAN DEFAULT FALSE
      );
    `);

    // Mock getPool to return our test pool
    vi.spyOn(dbModule, 'getPool').mockReturnValue(mockPool);

    // Create a test user
    const userResult = await testClient.query(
      `INSERT INTO users (email) VALUES ('consent@test.com') RETURNING id`
    );
    const userId = userResult.rows[0].id;

    // Create tokenized user ID for event logging
    await testClient.query(
      `INSERT INTO l0_user_tokenization (internal_user_id, tokenized_user_id) 
       VALUES ($1, $2)`,
      [userId, `token_user_${userId}`]
    );

    // Mock verifyToken to return our test user id
    vi.spyOn(authModule, 'verifyToken').mockImplementation((_token: string) => ({
      sub: userId,
      email: 'consent@test.com',
    }) as any);
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

  it('should record a cookie banner consent event', async () => {
    const request = new NextRequest('http://localhost/api/consent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'origin': 'http://localhost',
        'Authorization': 'Bearer test-token',
      },
      body: JSON.stringify({
        consentType: 'cookie_banner',
        choice: 'accept_all',
      }),
    });

    const response = await consentHandler(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    const events = await testClient.query(
      `SELECT event_type, metadata->>'consentType' as consent_type, metadata->>'choice' as choice
       FROM l1_events`
    );

    expect(events.rows.length).toBe(1);
    expect(events.rows[0].event_type).toBe('consent');
    expect(events.rows[0].consent_type).toBe('cookie_banner');
    expect(events.rows[0].choice).toBe('accept_all');
  });

  it('should reject invalid consent type', async () => {
    const request = new NextRequest('http://localhost/api/consent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'origin': 'http://localhost',
        'Authorization': 'Bearer test-token',
      },
      body: JSON.stringify({
        consentType: 'not_a_real_type',
      }),
    });

    const response = await consentHandler(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(String(data.error)).toContain('Invalid consent type');
  });

  it('should require authentication', async () => {
    const request = new NextRequest('http://localhost/api/consent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'origin': 'http://localhost',
      },
      body: JSON.stringify({
        consentType: 'cookie_banner',
      }),
    });

    const response = await consentHandler(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(String(data.error)).toContain('Unauthorized');
  });
});


