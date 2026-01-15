import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

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

    // Only upsert if we have at least one PII field
    if (!piiData.firstName && !piiData.lastName && !piiData.dateOfBirth && !piiData.recoveryPhone && !piiData.provinceRegion) {
      return; // No PII to store yet
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
  } catch (error: any) {
    // If l0_pii_users doesn't exist yet (pre-migration), just log and continue
    if (error.code === '42P01') { // Table doesn't exist
      // Silent - pre-migration, no action needed
    } else {
      console.error('[Onboarding Progress API] Error storing PII:', error);
    }
  }
}

// Update progress for current onboarding attempt (UPSERT)
export async function PUT(request: NextRequest) {
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
      console.error('[Onboarding Progress API] No userId in JWT:', decoded);
      return NextResponse.json({ error: 'Invalid token: no user ID' }, { status: 401 });
    }

    const data = await request.json();
    console.log('[Onboarding Progress API] Updating for user:', userId, 'lastStep:', data.lastStep);

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
      console.error('[Onboarding Progress API] Could not check schema:', e);
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
    console.log('[Onboarding Progress API] Writing to users table (post-migration)');
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
        updated_at = NOW()
      WHERE id = $10
      RETURNING 
        emotional_state, financial_context, motivation, motivation_other,
        acquisition_source, acquisition_other, insight_preferences, insight_other,
        last_step, updated_at`,
      [
        data.emotionalState || [],
        data.financialContext || [],
        data.motivation || null,
        data.motivationOther || null,
        data.acquisitionSource || null,
        data.acquisitionOther || null,
        data.insightPreferences || [],
        data.insightOther || null,
        data.lastStep || 0,
        userId
      ]
    );
    
    // Store PII in L0 table when PII fields are updated
    if (data.firstName || data.lastName || data.dateOfBirth || data.recoveryPhone || data.provinceRegion) {
      await upsertPII(userId, {
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth,
        recoveryPhone: data.recoveryPhone,
        provinceRegion: data.provinceRegion,
      });
    }


    return NextResponse.json({ 
      success: true, 
      data: result.rows[0] 
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error updating onboarding progress:', error);
    return NextResponse.json(
      { error: 'Failed to update progress', details: error.message },
      { status: 500 }
    );
  }
}

