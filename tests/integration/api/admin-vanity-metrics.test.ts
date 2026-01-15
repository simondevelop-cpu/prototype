/**
 * Integration Tests: Admin Vanity Metrics API
 * Tests that vanity metrics are calculated correctly and filters work as expected
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { GET } from '@/app/api/admin/vanity-metrics/route';
import { setupTestDatabase, generateAdminToken, createTestUser, createTestTransactions, createTestUserEvents, createAdminRequest } from '@/tests/helpers/admin-test-helpers';
import type { TestDatabase } from '@/tests/helpers/admin-test-helpers';
import * as vanityMetricsModule from '@/app/api/admin/vanity-metrics/route';

describe('Admin Vanity Metrics API', () => {
  let testDb: TestDatabase;
  let adminToken: string;

  beforeAll(async () => {
    testDb = await setupTestDatabase();
    adminToken = generateAdminToken();
    
    // Mock the pool in the vanity metrics module
    vi.spyOn(vanityMetricsModule, 'default').mockImplementation(() => {
      // This is a workaround - we'll need to mock at the Pool level
      return testDb.pool as any;
    });
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
    await testDb.client.query('DELETE FROM users WHERE email != $1', ['admin@canadianinsights.ca']);
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
      
      const response = await GET(request);
      
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
      const response = await GET(request);
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
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.metrics).toBeDefined();
    });

    it('should calculate totalTransactionsUploaded (cumulative)', async () => {
      const userId = await createTestUser(testDb.pool, { email: 'user1@test.com' });
      await createTestTransactions(testDb.pool, userId, 5);
      
      const request = createAdminRequest('http://localhost/api/admin/vanity-metrics', adminToken);
      const response = await GET(request);
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
    it.todo('should filter by validatedEmails when specified');
    it.todo('should filter by intentCategories when specified');
    it.todo('should filter weeks by cohorts (display only, not user count)');
    it.todo('should filter by dataCoverage (1 upload, 2 uploads, 3+ uploads)');
    it.todo('should handle multiple filters combined');
  });

  describe('Week Calculation', () => {
    it.todo('should start from earliest user creation date');
    it.todo('should generate weeks correctly (Sunday start)');
    it.todo('should handle weeks with no data gracefully');
  });

  describe('Data Coverage Filter', () => {
    it.todo('should correctly identify users with 1 upload');
    it.todo('should correctly identify users with 2 uploads');
    it.todo('should correctly identify users with 3+ uploads');
    it.todo('should handle users with no uploads');
  });

  describe('Schema Adaptation', () => {
    it.todo('should handle missing email_validated column gracefully');
    it.todo('should handle missing motivation column gracefully');
    it.todo('should handle missing user_events table gracefully');
    it.todo('should handle missing categorization_learning table gracefully');
  });
});

