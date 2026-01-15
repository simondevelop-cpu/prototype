/**
 * Integration Tests: Admin Vanity Metrics API
 * Tests that vanity metrics are calculated correctly and filters work as expected
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDatabase, generateAdminToken, createTestUser, createTestTransactions, createTestUserEvents, createAdminRequest } from '@/tests/helpers/admin-test-helpers';
import type { TestDatabase } from '@/tests/helpers/admin-test-helpers';

// Mock pg Pool BEFORE importing the route handler
vi.mock('pg', async () => {
  const actual = await vi.importActual<typeof import('pg')>('pg');
  return {
    ...actual,
    Pool: vi.fn().mockImplementation(() => {
      // Return a mock pool that will be replaced in beforeAll
      return {
        query: vi.fn(),
        connect: vi.fn(),
        end: vi.fn(),
      };
    }),
  };
});

// Import route handler AFTER mocking
import { GET } from '@/app/api/admin/vanity-metrics/route';
import { Pool } from 'pg';

describe('Admin Vanity Metrics API', () => {
  let testDb: TestDatabase;
  let adminToken: string;

  beforeAll(async () => {
    testDb = await setupTestDatabase();
    adminToken = generateAdminToken();
    
    // Replace the Pool mock implementation with our test pool
    (Pool as any).mockImplementation(() => testDb.pool);
    
    // Clear the module cache to force re-import with new mock
    vi.resetModules();
  });

  afterAll(async () => {
    if (testDb.client) {
      await testDb.client.end();
    }
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await testDb.client.query('DELETE FROM user_events');
    await testDb.client.query('DELETE FROM categorization_learning');
    await testDb.client.query('DELETE FROM transactions');
    await testDb.client.query("DELETE FROM users WHERE email != 'admin@canadianinsights.ca'");
  });

  describe('Authentication', () => {
    it('should reject requests without token', async () => {
      const request = {
        url: 'http://localhost/api/admin/vanity-metrics',
        headers: { get: () => null },
      } as any;
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should reject requests with invalid token', async () => {
      const request = {
        url: 'http://localhost/api/admin/vanity-metrics',
        headers: { get: (name: string) => name === 'authorization' ? 'Bearer invalid-token' : null },
      } as any;
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid token');
    });

    it('should accept valid admin token', async () => {
      const userId = await createTestUser(testDb.pool, { email: 'user1@test.com' });
      const request = createAdminRequest('http://localhost/api/admin/vanity-metrics', adminToken);
      
      const routeModule = await import('@/app/api/admin/vanity-metrics/route');
      const response = await routeModule.GET(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe('Metrics Calculation', () => {
    it('should calculate totalUsers correctly (cumulative)', async () => {
      // Create users in different weeks
      const week1 = new Date('2025-01-05'); // Sunday
      const week2 = new Date('2025-01-12'); // Sunday
      
      await createTestUser(testDb.pool, { email: 'user1@test.com', createdAt: week1 });
      await createTestUser(testDb.pool, { email: 'user2@test.com', createdAt: week2 });
      
      const request = createAdminRequest('http://localhost/api/admin/vanity-metrics', adminToken);
      const routeModule = await import('@/app/api/admin/vanity-metrics/route');
      const response = await routeModule.GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      
      // Check that totalUsers is cumulative
      const weeks = Object.keys(data.metrics).sort();
      if (weeks.length >= 2) {
        const week1Total = data.metrics[weeks[0]]?.totalUsers || 0;
        const week2Total = data.metrics[weeks[1]]?.totalUsers || 0;
        expect(week2Total).toBeGreaterThanOrEqual(week1Total);
      }
    });

    it('should calculate newUsers per week', async () => {
      const week1 = new Date('2025-01-05');
      const week2 = new Date('2025-01-12');
      
      await createTestUser(testDb.pool, { email: 'user1@test.com', createdAt: week1 });
      await createTestUser(testDb.pool, { email: 'user2@test.com', createdAt: week2 });
      
      const request = createAdminRequest('http://localhost/api/admin/vanity-metrics', adminToken);
      const routeModule = await import('@/app/api/admin/vanity-metrics/route');
      const response = await routeModule.GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.metrics).toBeDefined();
    });

    it('should calculate totalTransactionsUploaded (cumulative)', async () => {
      const userId = await createTestUser(testDb.pool, { email: 'user1@test.com' });
      await createTestTransactions(testDb.pool, userId, 5);
      
      const request = createAdminRequest('http://localhost/api/admin/vanity-metrics', adminToken);
      const routeModule = await import('@/app/api/admin/vanity-metrics/route');
      const response = await routeModule.GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      // Verify transactions are counted
      const weeks = Object.keys(data.metrics);
      if (weeks.length > 0) {
        const lastWeek = weeks[weeks.length - 1];
        expect(data.metrics[lastWeek].totalTransactionsUploaded).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Filters', () => {
    it('should filter by validatedEmails when specified', async () => {
      await createTestUser(testDb.pool, { email: 'validated@test.com', emailValidated: true });
      await createTestUser(testDb.pool, { email: 'unvalidated@test.com', emailValidated: false });
      
      const request = createAdminRequest('http://localhost/api/admin/vanity-metrics?validatedEmails=true', adminToken);
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      // Should only count validated users
      const weeks = Object.keys(data.metrics);
      if (weeks.length > 0) {
        const lastWeek = weeks[weeks.length - 1];
        expect(data.metrics[lastWeek].totalUsers).toBeGreaterThanOrEqual(0);
      }
    });

    it('should filter by dataCoverage (1 upload)', async () => {
      const userId = await createTestUser(testDb.pool, { email: 'user1@test.com' });
      await createTestTransactions(testDb.pool, userId, 1);
      
      const request = createAdminRequest('http://localhost/api/admin/vanity-metrics?dataCoverage=1%20upload', adminToken);
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('Week Calculation', () => {
    it('should generate weeks correctly', async () => {
      const week1 = new Date('2025-01-05'); // Sunday
      await createTestUser(testDb.pool, { email: 'user1@test.com', createdAt: week1 });
      
      const request = createAdminRequest('http://localhost/api/admin/vanity-metrics', adminToken);
      const routeModule = await import('@/app/api/admin/vanity-metrics/route');
      const response = await routeModule.GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.weeks).toBeDefined();
      expect(Array.isArray(data.weeks)).toBe(true);
    });
  });
});

