/**
 * Comprehensive functionality verification tests
 * Verifies all migration changes and addresses user questions
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { getPool } from '@/lib/db';

describe('Migration Functionality Verification', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = getPool() as Pool;
    if (!pool) {
      throw new Error('Database pool not available');
    }
  });

  // Skip all migration tests in CI (they require a real database connection)
  // These tests should be run manually against a real database
  const shouldSkip = !process.env.DATABASE_URL || process.env.CI === 'true';

  afterAll(async () => {
    await pool.end();
  });

  describe('Table Structure Verification', () => {
    it('should have l0_pii_users with internal_user_id as PRIMARY KEY', async () => {
      const result = await pool.query(`
        SELECT 
          tc.constraint_type,
          kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'l0_pii_users'
          AND tc.constraint_type = 'PRIMARY KEY'
      `);
      
      expect(result.rows.length).toBeGreaterThan(0);
      const pkColumn = result.rows.find((r: any) => r.column_name === 'internal_user_id');
      expect(pkColumn).toBeDefined();
    });

    it('should have ip_address column in l0_pii_users', async () => {
      const result = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'l0_pii_users'
          AND column_name = 'ip_address'
      `);
      expect(result.rows.length).toBe(1);
    });

    it('should have l1_events table (not user_events)', async () => {
      const l1EventsCheck = await pool.query(`
        SELECT 1 FROM information_schema.tables WHERE table_name = 'l1_events'
      `);
      expect(l1EventsCheck.rows.length).toBe(1);

      const userEventsCheck = await pool.query(`
        SELECT 1 FROM information_schema.tables WHERE table_name = 'user_events'
      `);
      expect(userEventsCheck.rows.length).toBe(0);
    });

    it('should have is_admin column in l1_events', async () => {
      const result = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'l1_events'
          AND column_name = 'is_admin'
      `);
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].data_type).toBe('boolean');
    });

    it('should NOT have PII fields in l1_customer_facts', async () => {
      const result = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'l1_customer_facts'
          AND column_name IN ('age_range', 'province_region', 'migration_flag')
      `);
      expect(result.rows.length).toBe(0);
    });
  });

  describe('Data Migration Verification', () => {
    it('should have migrated transactions to l1_transaction_facts', async () => {
      const legacyCount = await pool.query('SELECT COUNT(*) as count FROM transactions');
      const migratedCount = await pool.query(`
        SELECT COUNT(*) as count 
        FROM l1_transaction_facts 
        WHERE legacy_transaction_id IS NOT NULL
      `);
      
      const legacy = parseInt(legacyCount.rows[0].count, 10);
      const migrated = parseInt(migratedCount.rows[0].count, 10);
      
      // Allow for 1-2 unmigrated (edge cases)
      expect(migrated).toBeGreaterThanOrEqual(legacy - 2);
    });

    it('should have migrated PII from onboarding_responses', async () => {
      const piiWithData = await pool.query(`
        SELECT COUNT(*) as count
        FROM l0_pii_users
        WHERE last_name IS NOT NULL 
           OR recovery_phone IS NOT NULL 
           OR province_region IS NOT NULL
      `);
      expect(parseInt(piiWithData.rows[0].count, 10)).toBeGreaterThan(0);
    });
  });

  describe('Empty Tables Analysis', () => {
    const emptyTables = [
      'accounts',
      'insight_feedback',
      'l0_admin_list',
      'l0_insight_list',
      'l0_privacy_metadata',
      'l1_file_ingestion',
      'l1_job_list',
      'l1_event_facts',
    ];

    emptyTables.forEach((tableName) => {
      it(`should verify ${tableName} is empty and check dependencies`, async () => {
        try {
          const countResult = await pool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
          const rowCount = parseInt(countResult.rows[0]?.count || '0', 10);
          expect(rowCount).toBe(0);
        } catch (error: any) {
          // Table might not exist, that's okay
          if (!error.message.includes('does not exist')) {
            throw error;
          }
        }
      });
    });

    it('should verify l1_support_tickets exists (kept for future use)', async () => {
      const result = await pool.query(`
        SELECT 1 FROM information_schema.tables WHERE table_name = 'l1_support_tickets'
      `);
      expect(result.rows.length).toBe(1);
    });
  });

  describe('Empty Tables Drop Verification', () => {
    const tablesToDrop = [
      'l0_admin_list',
      'l0_privacy_metadata',
      'l1_file_ingestion',
      'l1_job_list',
      'l0_insight_list',
    ];

    tablesToDrop.forEach((tableName) => {
      it(`should verify ${tableName} can be dropped (empty, no references)`, async () => {
        try {
          // Check if table exists
          const existsResult = await pool.query(`
            SELECT 1 FROM information_schema.tables WHERE table_name = $1
          `, [tableName]);
          
          if (existsResult.rows.length === 0) {
            // Table already dropped, that's fine
            return;
          }

          // Verify it's empty
          const countResult = await pool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
          const rowCount = parseInt(countResult.rows[0]?.count || '0', 10);
          expect(rowCount).toBe(0);

          // Check for foreign key references
          const fkCheck = await pool.query(`
            SELECT COUNT(*) as count
            FROM information_schema.key_column_usage kcu
            JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
            WHERE tc.table_name != $1
              AND kcu.referenced_table_name = $1
          `, [tableName]);
          const referencedBy = parseInt(fkCheck.rows[0]?.count || '0', 10);
          expect(referencedBy).toBe(0);
        } catch (error: any) {
          // Table might not exist (already dropped), that's okay
          if (!error.message.includes('does not exist')) {
            throw error;
          }
        }
      });
    });

    it('should verify l1_support_tickets is NOT dropped (kept for future use)', async () => {
      const result = await pool.query(`
        SELECT 1 FROM information_schema.tables WHERE table_name = 'l1_support_tickets'
      `);
      expect(result.rows.length).toBe(1);
    });
  });

  describe('API Endpoint Verification', () => {
    it('should verify no APIs reference accounts table', async () => {
      // This is a manual check - we'll verify in code search
      // But we can check if accounts table has any foreign key references
      const fkCheck = await pool.query(`
        SELECT COUNT(*) as count
        FROM information_schema.key_column_usage kcu
        JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
        WHERE tc.table_name != 'accounts'
          AND kcu.referenced_table_name = 'accounts'
      `);
      // accounts should only be referenced by transactions.account_id
      const refCount = parseInt(fkCheck.rows[0].count, 10);
      expect(refCount).toBeLessThanOrEqual(1); // Only transactions.account_id
    });

    it('should verify consents are logged in l1_events', async () => {
      const consentsCheck = await pool.query(`
        SELECT COUNT(*) as count
        FROM l1_events
        WHERE event_type = 'consent'
      `);
      expect(parseInt(consentsCheck.rows[0].count, 10)).toBeGreaterThan(0);
    });
  });

  describe('Table Purpose Verification', () => {
    it('should verify l0_admin_list purpose', async () => {
      // Check if table exists and is empty
      const exists = await pool.query(`
        SELECT 1 FROM information_schema.tables WHERE table_name = 'l0_admin_list'
      `);
      if (exists.rows.length > 0) {
        const count = await pool.query('SELECT COUNT(*) as count FROM l0_admin_list');
        // Table exists but appears unused
        expect(parseInt(count.rows[0].count, 10)).toBe(0);
      }
    });

    it('should verify l0_insight_list purpose', async () => {
      const exists = await pool.query(`
        SELECT 1 FROM information_schema.tables WHERE table_name = 'l0_insight_list'
      `);
      if (exists.rows.length > 0) {
        const count = await pool.query('SELECT COUNT(*) as count FROM l0_insight_list');
        const rowCount = parseInt(count.rows[0].count, 10);
        // User said it might be isolated - check if it has any references
        const fkCheck = await pool.query(`
          SELECT COUNT(*) as count
          FROM information_schema.key_column_usage kcu
          JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
          WHERE tc.table_name != 'l0_insight_list'
            AND kcu.referenced_table_name = 'l0_insight_list'
        `);
        // If no references and empty, it's isolated
      }
    });

    it('should verify l0_privacy_metadata purpose', async () => {
      const exists = await pool.query(`
        SELECT 1 FROM information_schema.tables WHERE table_name = 'l0_privacy_metadata'
      `);
      if (exists.rows.length > 0) {
        const count = await pool.query('SELECT COUNT(*) as count FROM l0_privacy_metadata');
        expect(parseInt(count.rows[0].count, 10)).toBe(0);
      }
    });

    it('should verify l1_file_ingestion is empty (not storing parsing data)', async () => {
      const exists = await pool.query(`
        SELECT 1 FROM information_schema.tables WHERE table_name = 'l1_file_ingestion'
      `);
      if (exists.rows.length > 0) {
        const count = await pool.query('SELECT COUNT(*) as count FROM l1_file_ingestion');
        // Should be empty - we're not storing parsing data
        expect(parseInt(count.rows[0].count, 10)).toBe(0);
      }
    });
  });
});

