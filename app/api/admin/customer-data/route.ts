import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const ADMIN_EMAIL = 'admin@canadianinsights.ca';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

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
      // Check if user is admin (either by role or email)
      if (decoded.role !== 'admin' && decoded.email !== ADMIN_EMAIL) {
        console.error('[Customer Data API] Not admin:', decoded);
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }
    } catch (error) {
      console.error('[Customer Data API] Token verification failed:', error);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check if last_step column exists (schema-adaptive query)
    let hasLastStep = false;
    try {
      const schemaCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'onboarding_responses' AND column_name = 'last_step'
      `);
      hasLastStep = schemaCheck.rows.length > 0;
    } catch (e) {
      console.log('[Customer Data API] Could not check schema, assuming old schema');
    }

    // Fetch all customer data with user emails (schema-adaptive)
    const selectFields = `
      u.email,
      o.first_name,
      o.last_name,
      o.date_of_birth,
      o.recovery_phone,
      o.province_region,
      o.emotional_state,
      o.financial_context,
      o.motivation,
      o.motivation_other,
      o.acquisition_source,
      o.insight_preferences,
      o.insight_other,
      ${hasLastStep ? 'o.last_step,' : ''}
      o.completed_at,
      o.created_at
    `;

    const result = await pool.query(`
      SELECT ${selectFields}
      FROM users u
      LEFT JOIN onboarding_responses o ON u.id = o.user_id
      WHERE u.email != $1
      ORDER BY o.completed_at DESC NULLS LAST, u.created_at DESC
    `, [ADMIN_EMAIL]);

    return NextResponse.json({ 
      success: true,
      customerData: result.rows 
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error fetching customer data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer data', details: error.message },
      { status: 500 }
    );
  }
}

