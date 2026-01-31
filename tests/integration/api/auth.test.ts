/**
 * Integration Tests: Authentication API Routes
 * Tests actual API endpoints with full request/response cycle
 * Uses pg-mem for database and mocks getPool to use test database
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { newDb } from 'pg-mem';
import { Client, Pool } from 'pg';
import { POST as loginHandler } from '@/app/api/auth/login/route';
import { POST as registerHandler } from '@/app/api/auth/register/route';
import { NextRequest } from 'next/server';
import { hashPassword } from '@/lib/auth';
import * as dbModule from '@/lib/db';

describe('Authentication API', () => {
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

    // Create a mock Pool that uses our test client
    mockPool = {
      connect: async () => testClient,
      query: testClient.query.bind(testClient),
      end: async () => {},
    } as unknown as Pool;

    // Create schema - all tables needed by auth routes
    await testClient.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        date DATE NOT NULL,
        description TEXT NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        category TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS onboarding_responses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        completed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_events (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB
      );
    `);

    // Mock getPool to return our test pool
    vi.spyOn(dbModule, 'getPool').mockReturnValue(mockPool);
  });

  afterAll(async () => {
    if (testClient) {
      await testClient.end();
    }
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    // Clear all tables before each test
    // Delete in order to respect foreign key constraints (child tables first)
    await testClient.query('DELETE FROM user_events');
    await testClient.query('DELETE FROM onboarding_responses');
    await testClient.query('DELETE FROM transactions');
    await testClient.query('DELETE FROM users');
  });

  describe('POST /api/auth/register', () => {
    describe('Happy Path', () => {
      it('should register a new user with valid credentials', async () => {
        const request = new NextRequest('http://localhost/api/auth/register', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'origin': 'http://localhost',
          },
          body: JSON.stringify({
            email: 'newuser@test.com',
            password: 'StrongP@ss1',
            name: 'Test User',
            consentAccepted: true,
          }),
        });

        const response = await registerHandler(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toHaveProperty('token');
        expect(data).toHaveProperty('user');
        expect(data.user.email).toBe('newuser@test.com');
      });

      it('should hash passwords with bcrypt', async () => {
        const request = new NextRequest('http://localhost/api/auth/register', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'origin': 'http://localhost',
          },
          body: JSON.stringify({
            email: 'hashtest@test.com',
            password: 'StrongP@ss1',
            name: 'Test User',
            consentAccepted: true,
          }),
        });

        await registerHandler(request);

        const result = await testClient.query(
          'SELECT password_hash FROM users WHERE email = $1',
          ['hashtest@test.com']
        );

        const hash = result.rows[0].password_hash;
        expect(hash).toMatch(/^\$2[aby]\$/); // bcrypt hash format
      });
    });

    describe('Unhappy Path', () => {
      it('should reject weak passwords', async () => {
        const request = new NextRequest('http://localhost/api/auth/register', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'origin': 'http://localhost',
          },
          body: JSON.stringify({
            email: 'weak@test.com',
            password: 'weak',
            name: 'Test User',
            consentAccepted: true,
          }),
        });

        const response = await registerHandler(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('Password');
      });

      it('should reject duplicate email addresses', async () => {
        // Register first user
        const request1 = new NextRequest('http://localhost/api/auth/register', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'origin': 'http://localhost',
          },
          body: JSON.stringify({
            email: 'duplicate@test.com',
            password: 'StrongP@ss1',
            name: 'Test User',
            consentAccepted: true,
          }),
        });
        const response1 = await registerHandler(request1);
        const data1 = await response1.json();
        const userId = data1.user.id;

        // Mark onboarding as completed (so duplicate registration is rejected)
        await testClient.query(
          'INSERT INTO onboarding_responses (user_id, completed_at) VALUES ($1, CURRENT_TIMESTAMP)',
          [userId]
        );

        // Try to register again with same email - should be rejected
        const request2 = new NextRequest('http://localhost/api/auth/register', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'origin': 'http://localhost',
          },
          body: JSON.stringify({
            email: 'duplicate@test.com',
            password: 'StrongP@ss2',
            name: 'Test User 2',
            consentAccepted: true,
          }),
        });

        const response = await registerHandler(request2);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('already registered');
      });

      it('should require consentAccepted for registration', async () => {
        const request = new NextRequest('http://localhost/api/auth/register', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'origin': 'http://localhost',
          },
          body: JSON.stringify({
            email: 'noconsent@test.com',
            password: 'StrongP@ss1',
            name: 'No Consent User',
            // consentAccepted omitted on purpose
          }),
        });

        const response = await registerHandler(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(String(data.error)).toContain('accept the Terms and Conditions and Privacy Policy');
      });
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a test user for login tests
      const passwordHash = await hashPassword('TestP@ss1');
      const userResult = await testClient.query(
        'INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id',
        ['logintest@test.com', passwordHash, 'Login Test User']
      );
      const userId = userResult.rows[0].id;
      
      // Create completed onboarding response (required for login)
      await testClient.query(
        'INSERT INTO onboarding_responses (user_id, completed_at) VALUES ($1, CURRENT_TIMESTAMP)',
        [userId]
      );
    });

    describe('Happy Path', () => {
      it('should login with valid credentials', async () => {
        const request = new NextRequest('http://localhost/api/auth/login', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'origin': 'http://localhost',
          },
          body: JSON.stringify({
            email: 'logintest@test.com',
            password: 'TestP@ss1',
          }),
        });

        const response = await loginHandler(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toHaveProperty('token');
        expect(data).toHaveProperty('user');
        expect(data.user.email).toBe('logintest@test.com');
      });
    });

    describe('Unhappy Path', () => {
      it('should reject invalid credentials', async () => {
        const request = new NextRequest('http://localhost/api/auth/login', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'origin': 'http://localhost',
          },
          body: JSON.stringify({
            email: 'logintest@test.com',
            password: 'WrongPassword1!',
          }),
        });

        const response = await loginHandler(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toContain('Invalid credentials');
      });
    });
  });
});
