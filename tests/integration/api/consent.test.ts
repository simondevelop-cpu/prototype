/**
 * Integration Tests: Consent API
 * Verifies /api/consent logs consent events into user_events
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

      CREATE TABLE IF NOT EXISTS user_events (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        event_type TEXT NOT NULL,
        event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB
      );
    `);

    // Mock getPool to return our test pool
    vi.spyOn(dbModule, 'getPool').mockReturnValue(mockPool);

    // Create a test user
    await testClient.query(
      `INSERT INTO users (email) VALUES ('consent@test.com') RETURNING id`
    );

    // Mock verifyToken to return our test user id
    vi.spyOn(authModule, 'verifyToken').mockImplementation((_token: string) => ({
      userId: 1,
      email: 'consent@test.com',
      role: 'user',
    }) as any);
  });

  afterAll(async () => {
    if (testClient) {
      await testClient.end();
    }
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    await testClient.query('DELETE FROM user_events');
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
       FROM user_events`
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


