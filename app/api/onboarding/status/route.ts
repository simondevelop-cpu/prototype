import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'canadian-insights-demo-secret-key-change-in-production';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

// Check if user has completed onboarding
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const userId = decoded.userId || decoded.id || decoded.sub;
    
    if (!userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check if this is a special account (demo/test accounts bypass onboarding)
    const userResult = await pool.query(
      'SELECT email FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const userEmail = userResult.rows[0].email.toLowerCase();
    const specialAccounts = ['test@gmail.com', 'test2@gmail.com', 'demo@canadianinsights.ca'];
    const isSpecialAccount = specialAccounts.includes(userEmail);
    
    // Special accounts don't need onboarding
    if (isSpecialAccount) {
      return NextResponse.json({ 
        hasCompleted: true,
        lastStep: 0,
        needsOnboarding: false
      }, { status: 200 });
    }

    // Check if user has completed onboarding
    const result = await pool.query(
      `SELECT 
        COUNT(DISTINCT CASE WHEN completed_at IS NOT NULL THEN id END) as completed_count,
        MAX(last_step) as last_step
       FROM onboarding_responses 
       WHERE user_id = $1`,
      [userId]
    );

    const completedCount = parseInt(result.rows[0]?.completed_count) || 0;
    const lastStep = parseInt(result.rows[0]?.last_step) || 0;
    const hasCompleted = completedCount > 0;

    return NextResponse.json({ 
      hasCompleted,
      lastStep,
      needsOnboarding: !hasCompleted
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Onboarding Status API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check onboarding status', details: error.message },
      { status: 500 }
    );
  }
}

