import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'canadian-insights-demo-secret-key-change-in-production';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

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

    // Check if last_step column exists (schema-adaptive)
    const schemaCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'onboarding_responses' 
      AND column_name IN ('last_step', 'completed_at')
    `);
    
    const hasLastStep = schemaCheck.rows.some(row => row.column_name === 'last_step');
    const hasCompletedAt = schemaCheck.rows.some(row => row.column_name === 'completed_at');

    if (!hasLastStep || !hasCompletedAt) {
      console.log('[Onboarding Progress API] Old schema detected, skipping progress tracking');
      return NextResponse.json({ 
        success: true, 
        message: 'Progress tracking not available in current schema'
      }, { status: 200 });
    }

    // Find the current incomplete attempt for this user
    const currentAttempt = await pool.query(
      `SELECT id, created_at, last_step FROM onboarding_responses 
       WHERE user_id = $1 AND completed_at IS NULL 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [userId]
    );

    let result;

    // LOGIC: Create a NEW row if:
    // 1. No incomplete attempt exists (first time ever)
    // 2. OR this is step 1 AND the last incomplete attempt was also at step 1 or 0 (indicates a fresh login/retry)
    const shouldCreateNewRow = 
      currentAttempt.rows.length === 0 || 
      (data.lastStep === 1 && (currentAttempt.rows[0].last_step === 0 || currentAttempt.rows[0].last_step === 1));

    if (currentAttempt.rows.length > 0 && !shouldCreateNewRow) {
      // Update existing incomplete attempt (continuing same session)
      const attemptId = currentAttempt.rows[0].id;
      console.log('[Onboarding Progress API] Updating existing attempt:', attemptId, 'from step', currentAttempt.rows[0].last_step, 'to step', data.lastStep);
      
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
          updated_at = NOW()
        WHERE id = $15
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
          data.lastStep || 0,
          attemptId
        ]
      );
    } else {
      // Create new attempt (first time OR fresh retry after incomplete)
      console.log('[Onboarding Progress API] Creating NEW attempt for user', userId, 'at step', data.lastStep);
      
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
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NULL, NOW())
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
          data.lastStep || 0,
        ]
      );
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

