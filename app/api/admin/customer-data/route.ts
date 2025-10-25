import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'canadian-insights-demo-secret-key-change-in-production';
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
      if (decoded.email !== ADMIN_EMAIL) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Fetch all customer data with user emails
    const result = await pool.query(`
      SELECT 
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
        o.completed_at,
        o.created_at
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

