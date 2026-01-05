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

    // Check if last_step column exists (schema-adaptive)
    const schemaCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'onboarding_responses' 
      AND column_name IN ('last_step', 'completed_at')
    `);
    
    const hasLastStep = schemaCheck.rows.some(row => row.column_name === 'last_step');
    const hasCompletedAt = schemaCheck.rows.some(row => row.column_name === 'completed_at');

    let result;
    
    if (hasLastStep && hasCompletedAt) {
      // Check if there's an incomplete attempt to update
      const currentAttempt = await pool.query(
        `SELECT id FROM onboarding_responses 
         WHERE user_id = $1 AND completed_at IS NULL 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [userId]
      );

      if (currentAttempt.rows.length > 0) {
        // Update existing incomplete attempt with completion
        const attemptId = currentAttempt.rows[0].id;
        console.log('[Onboarding API] Completing existing attempt:', attemptId);
        
        result = await pool.query(
          `UPDATE onboarding_responses SET
            emotional_state = $1,
            financial_context = $2,
            motivation = $3,
            motivation_other = $4,
            acquisition_source = $5,
            acquisition_other = $6,
            insight_preferences = $7,
            insight_other = $8,
            first_name = $9,
            last_name = $10,
            date_of_birth = $11,
            recovery_phone = $12,
            province_region = $13,
            last_step = $14,
            completed_at = $15,
            updated_at = NOW()
          WHERE id = $16
          RETURNING *`,
          [
            data.emotionalState || [],
            data.financialContext || [],
            data.motivation || null,
            data.motivationOther || null,
            data.acquisitionSource || null,
            data.acquisitionOther || null,
            data.insightPreferences || [],
            data.insightOther || null,
            data.firstName || null,
            data.lastName || null,
            data.dateOfBirth || null,
            data.recoveryPhone || null,
            data.provinceRegion || null,
            7, // Completed all steps
            data.completedAt || new Date().toISOString(),
            attemptId
          ]
        );
      } else {
        // No incomplete attempt found, create new completed entry
        console.log('[Onboarding API] Creating new completed entry');
        result = await pool.query(
          `INSERT INTO onboarding_responses (
          user_id,
          emotional_state,
          financial_context,
          motivation,
          motivation_other,
          acquisition_source,
          acquisition_other,
          insight_preferences,
          insight_other,
          first_name,
          last_name,
          date_of_birth,
          recovery_phone,
          province_region,
          last_step,
          completed_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
        RETURNING *`,
        [
          userId,
          data.emotionalState || [],
          data.financialContext || [],
          data.motivation || null,
          data.motivationOther || null,
          data.acquisitionSource || null,
          data.acquisitionOther || null,
          data.insightPreferences || [],
          data.insightOther || null,
          data.firstName || null,
          data.lastName || null,
          data.dateOfBirth || null,
          data.recoveryPhone || null,
          data.provinceRegion || null,
          data.lastStep || 7,
          data.completedAt || new Date().toISOString(),
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
      } else {
        // No incomplete attempt found, create new completed entry
        console.log('[Onboarding API] Creating new completed entry');
        result = await pool.query(
          `INSERT INTO onboarding_responses (
          user_id,
          emotional_state,
          financial_context,
          motivation,
          motivation_other,
          acquisition_source,
          acquisition_other,
          insight_preferences,
          insight_other,
          first_name,
          last_name,
          date_of_birth,
          recovery_phone,
          province_region,
          last_step,
          completed_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
        RETURNING *`,
        [
          userId,
          data.emotionalState || [],
          data.financialContext || [],
          data.motivation || null,
          data.motivationOther || null,
          data.acquisitionSource || null,
          data.acquisitionOther || null,
          data.insightPreferences || [],
          data.insightOther || null,
          data.firstName || null,
          data.lastName || null,
          data.dateOfBirth || null,
          data.recoveryPhone || null,
          data.provinceRegion || null,
          data.lastStep || 7,
          data.completedAt || new Date().toISOString(),
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
      }
    } else {
      // Old schema without last_step/completed_at
      console.log('[Onboarding API] Using old schema (no last_step/completed_at columns)');
      result = await pool.query(
        `INSERT INTO onboarding_responses (
          user_id,
          emotional_state,
          financial_context,
          motivation,
          motivation_other,
          acquisition_source,
          acquisition_other,
          insight_preferences,
          insight_other,
          first_name,
          last_name,
          date_of_birth,
          recovery_phone,
          province_region,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
        RETURNING *`,
        [
          userId,
          data.emotionalState || [],
          data.financialContext || [],
          data.motivation || null,
          data.motivationOther || null,
          data.acquisitionSource || null,
          data.acquisitionOther || null,
          data.insightPreferences || [],
          data.insightOther || null,
          data.firstName || null,
          data.lastName || null,
          data.dateOfBirth || null,
          data.recoveryPhone || null,
          data.provinceRegion || null,
        ]
      );
      
      // Store PII in L0 table (even for old schema)
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

    const result = await pool.query(
      'SELECT * FROM onboarding_responses WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
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

