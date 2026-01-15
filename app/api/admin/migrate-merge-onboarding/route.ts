/**
 * Migration: Merge onboarding_responses into users table
 * Date: January 14, 2026
 * Purpose: Merge non-PII onboarding columns from onboarding_responses into users table
 *          Maintaining PII isolation in l0_pii_users
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.role !== 'admin' && decoded.email !== ADMIN_EMAIL) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    console.log('[Merge Onboarding Migration] Starting migration...');
    const migrations: string[] = [];
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // STEP 1: Add onboarding columns to users table
      console.log('[Merge Onboarding Migration] Adding columns to users table...');
      
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS emotional_state TEXT[]`);
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS financial_context TEXT[]`);
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS motivation TEXT`);
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS motivation_other TEXT`);
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS acquisition_source TEXT`);
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS acquisition_other TEXT`);
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS insight_preferences TEXT[]`);
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS insight_other TEXT`);
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_step INTEGER DEFAULT 0`);
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE`);
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`);
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`);
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_validated BOOLEAN DEFAULT FALSE`);
      
      migrations.push('✅ Added onboarding columns to users table');
      migrations.push('✅ Added is_active and email_validated columns');

      // STEP 2: Create indexes
      console.log('[Merge Onboarding Migration] Creating indexes...');
      
      await client.query(`CREATE INDEX IF NOT EXISTS idx_users_motivation ON users(motivation)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_users_completed_at ON users(completed_at) WHERE completed_at IS NOT NULL`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_users_email_validated ON users(email_validated)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_users_last_step ON users(last_step)`);
      
      migrations.push('✅ Created indexes for filtering/analytics');

      // STEP 3: Migrate data from onboarding_responses to users
      console.log('[Merge Onboarding Migration] Migrating data...');
      
      const migrateResult = await client.query(`
        UPDATE users u
        SET 
          emotional_state = o.emotional_state,
          financial_context = o.financial_context,
          motivation = o.motivation,
          motivation_other = o.motivation_other,
          acquisition_source = o.acquisition_source,
          acquisition_other = o.acquisition_other,
          insight_preferences = o.insight_preferences,
          insight_other = o.insight_other,
          last_step = COALESCE(o.last_step, 0),
          completed_at = o.completed_at,
          updated_at = COALESCE(o.updated_at, o.created_at, NOW())
        FROM (
          SELECT DISTINCT ON (user_id)
            user_id,
            emotional_state,
            financial_context,
            motivation,
            motivation_other,
            acquisition_source,
            acquisition_other,
            insight_preferences,
            insight_other,
            last_step,
            completed_at,
            updated_at,
            created_at
          FROM onboarding_responses
          ORDER BY user_id, created_at DESC
        ) o
        WHERE u.id = o.user_id
          AND EXISTS (
            SELECT 1 FROM onboarding_responses o2 
            WHERE o2.user_id = u.id
          )
      `);
      
      migrations.push(`✅ Migrated data for ${migrateResult.rowCount} users`);

      await client.query('COMMIT');
      console.log('[Merge Onboarding Migration] ✅ Migration completed successfully');

      return NextResponse.json({
        success: true,
        message: 'Migration completed successfully',
        migrations,
        rowsMigrated: migrateResult.rowCount
      }, { status: 200 });

    } catch (error: any) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('[Merge Onboarding Migration] Error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Migration failed', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check migration status
export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.role !== 'admin' && decoded.email !== ADMIN_EMAIL) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check if columns exist in users table
    const schemaCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('completed_at', 'motivation', 'emotional_state', 'is_active', 'email_validated')
    `);

    const existingColumns = schemaCheck.rows.map(row => row.column_name);
    const hasCompletedAt = existingColumns.includes('completed_at');
    const hasMotivation = existingColumns.includes('motivation');
    const hasEmotionalState = existingColumns.includes('emotional_state');
    const hasIsActive = existingColumns.includes('is_active');
    const hasEmailValidated = existingColumns.includes('email_validated');

    // Check data migration status
    let migratedCount = 0;
    let totalWithOnboarding = 0;
    if (hasCompletedAt) {
      const dataCheck = await pool.query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(completed_at) as users_with_completed_at,
          COUNT(motivation) as users_with_motivation
        FROM users
      `);
      
      const stats = dataCheck.rows[0];
      migratedCount = parseInt(stats.users_with_motivation) || 0;
      
      const onboardingCheck = await pool.query(`
        SELECT COUNT(DISTINCT user_id) as total
        FROM onboarding_responses
      `);
      totalWithOnboarding = parseInt(onboardingCheck.rows[0]?.total) || 0;
    }

    // Investigate unmigrated users: Check if there are users with onboarding_responses but NULL in users table
    let unmigratedUsers: any[] = [];
    if (hasCompletedAt) {
      try {
        // More thorough check: Find users with ANY onboarding_responses entry where users table has NULL
        // Use DISTINCT ON to get one row per user with their latest onboarding response
        const unmigratedCheck = await pool.query(`
          SELECT DISTINCT ON (u.id)
            u.id,
            u.email,
            o.motivation as onboarding_motivation,
            o.completed_at as onboarding_completed_at,
            u.motivation as users_motivation,
            u.completed_at as users_completed_at,
            (
              SELECT COUNT(*) 
              FROM onboarding_responses o2 
              WHERE o2.user_id = u.id
            ) as total_onboarding_entries
          FROM users u
          INNER JOIN (
            SELECT DISTINCT ON (user_id)
              user_id,
              motivation,
              completed_at,
              created_at
            FROM onboarding_responses
            ORDER BY user_id, created_at DESC
          ) o ON u.id = o.user_id
          WHERE u.motivation IS NULL
          ORDER BY u.id, o.created_at DESC
          LIMIT 10
        `);
        unmigratedUsers = unmigratedCheck.rows;
        console.log(`[Migration Status] Found ${unmigratedUsers.length} unmigrated users with data to migrate`);
        if (unmigratedUsers.length > 0) {
          console.log('[Migration Status] Unmigrated users:', unmigratedUsers.map(u => ({ id: u.id, email: u.email })));
        }
      } catch (e) {
        console.log('[Migration Status] Could not check unmigrated users:', e);
      }
      
      // Also check: Are there users with onboarding_responses but ALL NULL values?
      try {
        const allNullCheck = await pool.query(`
          SELECT 
            COUNT(DISTINCT o.user_id) as count
          FROM onboarding_responses o
          INNER JOIN users u ON u.id = o.user_id
          WHERE u.motivation IS NULL
            AND o.motivation IS NULL
            AND o.completed_at IS NULL
            AND o.emotional_state IS NULL
            AND o.financial_context IS NULL
            AND o.insight_preferences IS NULL
        `);
        const allNullCount = parseInt(allNullCheck.rows[0]?.count) || 0;
        console.log(`[Migration Status] Found ${allNullCount} users with onboarding_responses but all NULL values (nothing to migrate)`);
      } catch (e) {
        // Ignore
      }
    }

    return NextResponse.json({
      migrationCompleted: hasCompletedAt && hasMotivation && hasEmotionalState && hasIsActive && hasEmailValidated,
      columnsExist: {
        completed_at: hasCompletedAt,
        motivation: hasMotivation,
        emotional_state: hasEmotionalState,
        is_active: hasIsActive,
        email_validated: hasEmailValidated
      },
      dataMigration: {
        migratedCount,
        totalWithOnboarding,
        percentageMigrated: totalWithOnboarding > 0 ? Math.round((migratedCount / totalWithOnboarding) * 100) : 0,
        unmigratedUsers: unmigratedUsers,
        unmigratedCount: unmigratedUsers.length,
        explanation: unmigratedUsers.length === 0 
          ? `All ${totalWithOnboarding} users with onboarding data have been migrated. The remaining ${totalWithOnboarding - migratedCount} users likely have NULL values in onboarding_responses (nothing to migrate).`
          : `${unmigratedUsers.length} user(s) have onboarding data that wasn't migrated. Re-running migration may fix this.`
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Merge Onboarding Migration] Status check error:', error);
    return NextResponse.json(
      { error: 'Status check failed', details: error.message },
      { status: 500 }
    );
  }
}

