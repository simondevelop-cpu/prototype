import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { getPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'canadian-insights-demo-secret-key-change-in-production';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

// Helper to ensure PII is stored in L0 table
async function upsertPII(userId: number, piiData: {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  recoveryPhone?: string;
  provinceRegion?: string;
  email?: string;
}) {
  try {
    // Get user email if not provided
    let email = piiData.email;
    if (!email) {
      const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
      if (userResult.rows.length > 0) {
        email = userResult.rows[0].email;
      }
    }

    // Upsert into l0_pii_users (for compliance - PII isolation)
    await pool.query(
      `INSERT INTO l0_pii_users (
        internal_user_id, email, first_name, last_name, date_of_birth, 
        recovery_phone, province_region, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (internal_user_id) 
      DO UPDATE SET
        email = EXCLUDED.email,
        first_name = COALESCE(EXCLUDED.first_name, l0_pii_users.first_name),
        last_name = COALESCE(EXCLUDED.last_name, l0_pii_users.last_name),
        date_of_birth = COALESCE(EXCLUDED.date_of_birth, l0_pii_users.date_of_birth),
        recovery_phone = COALESCE(EXCLUDED.recovery_phone, l0_pii_users.recovery_phone),
        province_region = COALESCE(EXCLUDED.province_region, l0_pii_users.province_region),
        updated_at = NOW()`,
      [
        userId,
        email || null,
        piiData.firstName || null,
        piiData.lastName || null,
        piiData.dateOfBirth || null,
        piiData.recoveryPhone || null,
        piiData.provinceRegion || null,
      ]
    );
    console.log('[Onboarding API] PII stored in l0_pii_users for user:', userId);
  } catch (error: any) {
    // If l0_pii_users doesn't exist yet (pre-migration), just log and continue
    // This allows graceful fallback during migration
    if (error.code === '42P01') { // Table doesn't exist
      console.log('[Onboarding API] l0_pii_users table not found (pre-migration), skipping PII storage');
    } else {
      console.error('[Onboarding API] Error storing PII:', error);
    }
  }
}

// Save onboarding responses
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const userId = decoded.userId || decoded.id || decoded.sub;
    
    if (!userId) {
      console.error('[Onboarding API] No userId in JWT:', decoded);
      return NextResponse.json({ error: 'Invalid token: no user ID' }, { status: 401 });
    }

    const data = await request.json();
    console.log('[Onboarding API] Completing onboarding for user:', userId);

    // Check if migration is complete - users table must have onboarding columns
    let hasCompletedAt = false;
    try {
      const schemaCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'completed_at'
      `);
      hasCompletedAt = schemaCheck.rows.length > 0;
    } catch (e) {
      console.error('[Onboarding POST API] Could not check schema:', e);
      return NextResponse.json({ 
        error: 'Could not verify migration status',
        details: e instanceof Error ? e.message : 'Unknown error'
      }, { status: 500 });
    }

    if (!hasCompletedAt) {
      return NextResponse.json({ 
        error: 'Migration not complete',
        message: 'Onboarding data migration has not been completed. Please run the migration at /api/admin/migrate-merge-onboarding first.',
        migrationRequired: true
      }, { status: 400 });
    }

    // Use users table ONLY (post-migration)
    console.log('[Onboarding API] Writing to users table (post-migration)');
    const result = await pool.query(
      `UPDATE users SET
        emotional_state = $1,
        financial_context = $2,
        motivation = $3,
        motivation_other = $4,
        acquisition_source = $5,
        acquisition_other = $6,
        insight_preferences = $7,
        insight_other = $8,
        last_step = $9,
        completed_at = $10,
        updated_at = NOW()
      WHERE id = $11
      RETURNING 
        emotional_state, financial_context, motivation, motivation_other,
        acquisition_source, acquisition_other, insight_preferences, insight_other,
        last_step, completed_at, updated_at`,
      [
        data.emotionalState || [],
        data.financialContext || [],
        data.motivation || null,
        data.motivationOther || null,
        data.acquisitionSource || null,
        data.acquisitionOther || null,
        data.insightPreferences || [],
        data.insightOther || null,
        data.lastStep || 7,
        data.completedAt || new Date().toISOString(),
        userId
      ]
    );
    
    // Store PII in L0 table after successful onboarding completion
    await upsertPII(userId, {
      firstName: data.firstName,
      lastName: data.lastName,
      dateOfBirth: data.dateOfBirth,
      recoveryPhone: data.recoveryPhone,
      provinceRegion: data.provinceRegion,
    });


    return NextResponse.json({ 
      success: true, 
      data: result.rows[0] 
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error saving onboarding responses:', error);
    return NextResponse.json(
      { error: 'Failed to save onboarding responses', details: error.message },
      { status: 500 }
    );
  }
}

// Get onboarding responses for current user
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const userId = decoded.userId || decoded.id || decoded.sub;
    
    if (!userId) {
      return NextResponse.json({ error: 'Invalid token: no user ID' }, { status: 401 });
    }

    // Check if migration is complete - users table must have onboarding columns
    let hasCompletedAt = false;
    try {
      const schemaCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'completed_at'
      `);
      hasCompletedAt = schemaCheck.rows.length > 0;
    } catch (e) {
      console.error('[Onboarding GET API] Could not check schema:', e);
      return NextResponse.json({ 
        error: 'Could not verify migration status',
        details: e instanceof Error ? e.message : 'Unknown error'
      }, { status: 500 });
    }

    if (!hasCompletedAt) {
      return NextResponse.json({ 
        error: 'Migration not complete',
        message: 'Onboarding data migration has not been completed. Please run the migration at /api/admin/migrate-merge-onboarding first.',
        migrationRequired: true
      }, { status: 400 });
    }

    // Use users table ONLY (post-migration)
    const result = await pool.query(
      `SELECT 
        emotional_state, financial_context, motivation, motivation_other,
        acquisition_source, acquisition_other, insight_preferences, insight_other,
        last_step, completed_at, updated_at
       FROM users 
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0 || (result.rows[0].completed_at === null && result.rows[0].last_step === 0 && !result.rows[0].motivation)) {
      return NextResponse.json({ data: null }, { status: 200 });
    }

    return NextResponse.json({ 
      success: true, 
      data: result.rows[0] 
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error fetching onboarding responses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch onboarding responses', details: error.message },
      { status: 500 }
    );
  }
}

