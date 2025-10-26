import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { hashPassword, createToken } from '@/lib/auth';

// Force dynamic rendering (POST endpoint requires runtime request body)
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const pool = getPool();
    if (!pool) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    // Check if user exists
    const existingUser = await pool.query(
      `SELECT u.id, u.email, 
              COUNT(DISTINCT t.id) as transaction_count,
              COUNT(DISTINCT CASE WHEN o.completed_at IS NOT NULL THEN o.id END) as completed_onboarding_count
       FROM users u
       LEFT JOIN transactions t ON u.id = t.user_id
       LEFT JOIN onboarding_responses o ON u.id = o.user_id
       WHERE u.email = $1
       GROUP BY u.id, u.email`,
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      const user = existingUser.rows[0];
      const transactionCount = parseInt(user.transaction_count) || 0;
      const completedOnboarding = parseInt(user.completed_onboarding_count) || 0;
      const isSpecialAccount = ['test@gmail.com', 'test2@gmail.com', 'demo@canadianinsights.ca'].includes(email.toLowerCase());
      
      // Block registration if:
      // 1. It's a special account (always active), OR
      // 2. User has transactions, OR
      // 3. User has completed onboarding
      if (isSpecialAccount || transactionCount > 0 || completedOnboarding > 0) {
        return NextResponse.json(
          { error: 'This email is already registered. Please sign in instead.' },
          { status: 400 }
        );
      }
      
      // User exists but never completed onboarding and has no transactions
      // Allow them to sign in (they'll be redirected to continue onboarding)
      console.log('[Register] User exists but incomplete onboarding, redirecting to sign in:', email);
      return NextResponse.json(
        { error: 'This email is already registered. Please sign in to continue your setup.' },
        { status: 400 }
      );
    }

    // Create user
    const passwordHash = hashPassword(password);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, email, display_name',
      [email.toLowerCase(), passwordHash, name || email]
    );

    const user = result.rows[0];

    // Create token
    const token = createToken(user.id);

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.display_name || user.email,
      },
    });
  } catch (error: any) {
    console.error('[API] Register error:', error);
    return NextResponse.json(
      { error: 'Registration failed', details: error.message },
      { status: 500 }
    );
  }
}

