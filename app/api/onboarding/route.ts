import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'canadian-insights-demo-secret-key-change-in-production';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

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
    const userId = decoded.userId || decoded.id;
    
    if (!userId) {
      console.error('[Onboarding API] No userId in JWT:', decoded);
      return NextResponse.json({ error: 'Invalid token: no user ID' }, { status: 401 });
    }

    const data = await request.json();
    console.log('[Onboarding API] Saving for user:', userId);

    // Always INSERT new row (allow multiple attempts per user)
    const result = await pool.query(
      `INSERT INTO onboarding_responses (
        user_id,
        emotional_state,
        financial_context,
        motivation,
        motivation_other,
        acquisition_source,
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
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
      RETURNING *`,
      [
        userId,
        data.emotionalState || [],
        data.financialContext || [],
        data.motivation || null,
        data.motivationOther || null,
        data.acquisitionSource || null,
        data.insightPreferences || [],
        data.insightOther || null,
        data.firstName || null,
        data.lastName || null,
        data.dateOfBirth || null,
        data.recoveryPhone || null,
        data.provinceRegion || null,
        7, // last_step = 7 means completed
      ]
    );

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
    const userId = decoded.userId || decoded.id;
    
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

