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

    // Create schema
    await testClient.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
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
    // Clear users table before each test
    await testClient.query('DELETE FROM users');
  });

  describe('POST /api/auth/register', () => {
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
        }),
      });

      const response = await registerHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('token');
      expect(data).toHaveProperty('user');
      expect(data.user.email).toBe('newuser@test.com');
    });

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
        }),
      });

      const response = await registerHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Password');
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
        }),
      });
      await registerHandler(request1);

      // Try to register again with same email
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
        }),
      });

      const response = await registerHandler(request2);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('already registered');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a test user for login tests
      const passwordHash = await hashPassword('TestP@ss1');
      await testClient.query(
        'INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3)',
        ['logintest@test.com', passwordHash, 'Login Test User']
      );
    });

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
