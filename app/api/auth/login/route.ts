import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { verifyPassword, hashPassword, createToken } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { verifyRequestOrigin } from '@/lib/csrf';
import { getClientIpAddress, updateUserIpAddress } from '@/lib/ip-address';
import { logUserLoginEvent } from '@/lib/event-logger';

// Force dynamic rendering (POST endpoint requires runtime request body)
export const dynamic = 'force-dynamic';

// Rate limiting: 5 attempts per 15 minutes per email
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

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
    const { email, password } = body;
    
    // Rate limiting check
    if (email) {
      const rateLimit = checkRateLimit(email, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
      if (!rateLimit.allowed) {
        const resetInMinutes = Math.ceil((rateLimit.resetAt - Date.now()) / 60000);
        return NextResponse.json(
          { 
            error: 'Too many login attempts. Please try again later.',
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
    }

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

    // Find user by email in l0_pii_users, join with l1_user_permissions for auth data
    const userResult = await pool.query(`
      SELECT 
        perm.id,
        pii.email,
        perm.password_hash,
        pii.display_name,
        COALESCE(perm.is_active, true) as is_active
      FROM l0_pii_users pii
      JOIN l1_user_permissions perm ON pii.internal_user_id = perm.id
      WHERE pii.email = $1
    `, [email.toLowerCase()]);

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const user = userResult.rows[0];
    const isActive = user.is_active !== false; // Default to true if NULL

    if (!isActive) {
      return NextResponse.json(
        { error: 'Account has been disabled. Please contact support.' },
        { status: 403 }
      );
    }
    
    // Verify password (supports both bcrypt and legacy SHA-256)
    const isValid = await verifyPassword(password, user.password_hash);
    
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }
    
    // Migrate legacy SHA-256 passwords to bcrypt on successful login
    // Check if hash is legacy format (doesn't start with $2)
    if (!user.password_hash.startsWith('$2')) {
      const newHash = await hashPassword(password);
      await pool.query(
        'UPDATE l1_user_permissions SET password_hash = $1 WHERE id = $2',
        [newHash, user.id]
      );
      console.log('[Login] Migrated legacy password hash to bcrypt for user:', user.id);
    }

    // Note: Onboarding completion check removed - frontend will handle redirecting to onboarding if needed
    // This allows users to log in and complete onboarding at their own pace

    // Increment login attempts counter
    try {
      await pool.query(
        'UPDATE l1_user_permissions SET login_attempts = COALESCE(login_attempts, 0) + 1 WHERE id = $1',
        [user.id]
      );
    } catch (e: any) {
      // Column doesn't exist yet - skip increment
      console.log('[Login] login_attempts column not found, skipping increment');
    }

    // Log IP address
    try {
      const ipAddress = getClientIpAddress(request);
      if (ipAddress) {
        await updateUserIpAddress(user.id, ipAddress);
      }
    } catch (ipError) {
      console.error('[Login] Failed to log IP address:', ipError);
      // Don't fail login if IP logging fails
    }

    // Create token
    const token = createToken(user.id);

    // Log login event for analytics (WAU/MAU tracking)
    try {
      await logUserLoginEvent(user.id);
    } catch (loginEventError) {
      // Don't fail login if event logging fails
      console.error('[Login] Failed to log login event:', loginEventError);
    }

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.display_name || user.email,
      },
    });
  } catch (error: any) {
    console.error('[API] Login error:', error);
    return NextResponse.json(
      { error: 'Login failed', details: error.message },
      { status: 500 }
    );
  }
}

