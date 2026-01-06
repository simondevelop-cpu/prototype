import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { hashPassword, createToken } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { verifyRequestOrigin } from '@/lib/csrf';
import { validatePasswordStrength } from '@/lib/password-validation';

// Force dynamic rendering (POST endpoint requires runtime request body)
export const dynamic = 'force-dynamic';

// Rate limiting: 3 registrations per hour per email/IP
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function POST(request: NextRequest) {
  try {
    // CSRF protection: Verify Origin header
    if (!verifyRequestOrigin(request)) {
      return NextResponse.json(
        { error: 'Invalid request origin' },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const { email, password, name } = body;
    
    // Rate limiting check (use email or IP)
    const identifier = email || request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimit = checkRateLimit(identifier, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
    if (!rateLimit.allowed) {
      const resetInMinutes = Math.ceil((rateLimit.resetAt - Date.now()) / 60000);
      return NextResponse.json(
        { 
          error: 'Too many registration attempts. Please try again later.',
          retryAfter: resetInMinutes,
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
            'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
            'X-RateLimit-Remaining': String(rateLimit.remaining),
            'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetAt / 1000)),
          },
        }
      );
    }

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        {
          error: 'Password does not meet requirements',
          details: passwordValidation.errors,
        },
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
    // Using subqueries to avoid pg-mem bug with COUNT(DISTINCT CASE WHEN ...)
    const existingUser = await pool.query(
      `SELECT u.id, u.email,
              COALESCE((SELECT COUNT(*) FROM transactions WHERE user_id = u.id), 0) as transaction_count,
              COALESCE((SELECT COUNT(*) FROM onboarding_responses WHERE user_id = u.id AND completed_at IS NOT NULL), 0) as completed_onboarding_count
       FROM users u
       WHERE u.email = $1`,
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
      // Allow re-registration: delete old incomplete onboarding attempts and keep user
      console.log('[Register] User exists with incomplete onboarding, allowing fresh start:', email);
      
      // Delete all incomplete onboarding attempts for this user
      await pool.query(
        'DELETE FROM onboarding_responses WHERE user_id = $1 AND completed_at IS NULL',
        [user.id]
      );
      
      // Increment login attempts (counts as a login) - schema-adaptive
      try {
        await pool.query(
          'UPDATE users SET login_attempts = COALESCE(login_attempts, 0) + 1 WHERE id = $1',
          [user.id]
        );
      } catch (e: any) {
        // Column doesn't exist yet - skip increment (will be added by migration)
        console.log('[Register] login_attempts column not found, skipping increment');
      }
      
      // Return the existing user (no need to create new one)
      const token = createToken(user.id);
      
      return NextResponse.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.display_name || user.email,
        },
      });
    }

    // Create user with bcrypt password hash
    const passwordHash = await hashPassword(password);
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

