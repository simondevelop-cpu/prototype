import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { hashPassword, createToken } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { verifyRequestOrigin } from '@/lib/csrf';
import { validatePasswordStrength } from '@/lib/password-validation';
import { logConsentEvent } from '@/lib/event-logger';
import { getClientIpAddress, updateUserIpAddress } from '@/lib/ip-address';
import { getTokenizedUserId } from '@/lib/tokenization';

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
    const { email, password, name, consentAccepted } = body;
    
    // Require consent for registration
    if (!consentAccepted) {
      return NextResponse.json(
        { error: 'You must accept the Terms and Conditions and Privacy Policy to create an account.' },
        { status: 400 }
      );
    }
    
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

    // Check if email is on beta/pre-approved list
    const pool = getPool();
    if (!pool) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    // Check if beta_emails table exists and if email is pre-approved
    let isBetaEmail = false;
    try {
      const tableCheck = await pool.query(`
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'beta_emails'
        LIMIT 1
      `);
      
      if (tableCheck.rows.length > 0) {
        // Check if table has any entries at all
        const countCheck = await pool.query('SELECT COUNT(*) as count FROM beta_emails');
        const emailCount = parseInt(countCheck.rows[0]?.count || '0', 10);
        
        // If table is empty, allow registration (backward compatibility - treat empty as "all emails allowed")
        if (emailCount === 0) {
          console.log('[Register] beta_emails table exists but is empty, allowing registration');
          isBetaEmail = true;
        } else {
          // Table has entries, check if this email is in the list
          const betaCheck = await pool.query(
            'SELECT email FROM beta_emails WHERE email = $1',
            [email.toLowerCase()]
          );
          isBetaEmail = betaCheck.rows.length > 0;
        }
      } else {
        // If table doesn't exist yet, allow registration (backward compatibility)
        console.log('[Register] beta_emails table does not exist, allowing registration');
        isBetaEmail = true;
      }
    } catch (e) {
      console.error('[Register] Error checking beta emails:', e);
      // On error, allow registration (fail open for backward compatibility)
      isBetaEmail = true;
    }

    if (!isBetaEmail) {
      return NextResponse.json(
        { error: 'This email is not on the beta access list. Please contact support to request access.' },
        { status: 403 }
      );
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      const requirementsText = 'Password must meet the following requirements:\n' +
        '• At least 8 characters long\n' +
        '• At least one uppercase letter (A-Z)\n' +
        '• At least one lowercase letter (a-z)\n' +
        '• At least one number (0-9)\n' +
        '• At least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)';
      
      return NextResponse.json(
        {
          error: 'Password does not meet requirements',
          message: requirementsText,
          details: passwordValidation.errors,
        },
        { status: 400 }
      );
    }

    // Check if user exists
    // Using separate queries to avoid pg-mem limitations with correlated subqueries
    const userResult = await pool.query(
      'SELECT id, email FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      // User doesn't exist, proceed with registration
      const passwordHash = await hashPassword(password);
      
      // Check if email_validated column exists, and set it to true by default
      // Schema-adaptive: handle both cases
      let hasEmailValidated = false;
      try {
        const columnCheck = await pool.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'users' 
          AND column_name = 'email_validated'
        `);
        hasEmailValidated = columnCheck.rows.length > 0;
      } catch (e) {
        console.log('[Register] Could not check email_validated column, skipping');
      }
      
      const result = hasEmailValidated
        ? await pool.query(
            'INSERT INTO users (email, password_hash, display_name, email_validated) VALUES ($1, $2, $3, $4) RETURNING id, email, display_name',
            [email.toLowerCase(), passwordHash, name || email, true]
          )
        : await pool.query(
            'INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, email, display_name',
            [email.toLowerCase(), passwordHash, name || email]
          );

      const user = result.rows[0];
      const token = createToken(user.id);

      // Log IP address
      try {
        const ipAddress = getClientIpAddress(request);
        if (ipAddress) {
          // Create PII record if it doesn't exist, and log IP
          const pool = getPool();
          if (pool) {
            await pool.query(
              `INSERT INTO l0_pii_users (internal_user_id, email, ip_address, ip_address_updated_at)
               VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
               ON CONFLICT (internal_user_id) 
               DO UPDATE SET ip_address = EXCLUDED.ip_address, ip_address_updated_at = CURRENT_TIMESTAMP`,
              [user.id, email.toLowerCase(), ipAddress]
            );
          }
        }
      } catch (ipError) {
        console.error('[Register] Failed to log IP address:', ipError);
        // Don't fail registration if IP logging fails
      }

      // Log consent event
      try {
        await logConsentEvent(user.id, 'account_creation', {
          version: '1.0', // TODO: Update with actual version from database
          scope: 'terms_and_privacy',
          timestamp: new Date().toISOString(),
        });
      } catch (consentError) {
        console.error('[Register] Failed to log consent event:', consentError);
        // Don't fail registration if consent logging fails
      }

      return NextResponse.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.display_name || user.email,
        },
      });
    }

    // User exists - check transactions and onboarding
    const userId = userResult.rows[0].id;
    // Check l1_transaction_facts (new architecture)
    const tokenizedUserId = await getTokenizedUserId(userId);
    let transactionCount = { rows: [{ count: '0' }] };
    if (tokenizedUserId) {
      try {
        transactionCount = await pool.query(
          'SELECT COUNT(*) as count FROM l1_transaction_facts WHERE tokenized_user_id = $1',
          [tokenizedUserId]
        );
      } catch (error) {
        console.error('[Register] Error checking l1_transaction_facts:', error);
        // If table doesn't exist, assume 0 transactions
        transactionCount = { rows: [{ count: '0' }] };
      }
    }
    // Check onboarding - use l1_onboarding_responses if exists, otherwise fallback to onboarding_responses
    let onboardingCount;
    try {
      onboardingCount = await pool.query(
        'SELECT COUNT(*) as count FROM l1_onboarding_responses WHERE user_id = $1 AND completed_at IS NOT NULL',
        [userId]
      );
    } catch (error) {
      // Fallback to legacy table name if migration not complete
      try {
        onboardingCount = await pool.query(
          'SELECT COUNT(*) as count FROM onboarding_responses WHERE user_id = $1 AND completed_at IS NOT NULL',
          [userId]
        );
      } catch (fallbackError) {
        console.error('[Register] Error checking onboarding:', fallbackError);
        onboardingCount = { rows: [{ count: '0' }] };
      }
    }

    const user = userResult.rows[0];
    const txCount = parseInt(transactionCount.rows[0]?.count || '0');
    const completedOnboarding = parseInt(onboardingCount.rows[0]?.count || '0');
    const isSpecialAccount = ['test@gmail.com', 'test2@gmail.com', 'demo@canadianinsights.ca'].includes(email.toLowerCase());
    
    // Block registration if:
    // 1. It's a special account (always active), OR
    // 2. User has transactions, OR
    // 3. User has completed onboarding
    if (isSpecialAccount || txCount > 0 || completedOnboarding > 0) {
      return NextResponse.json(
        { error: 'This email is already registered. Please sign in instead.' },
        { status: 400 }
      );
    }
    
    // User exists but never completed onboarding and has no transactions
    // Allow re-registration: delete old incomplete onboarding attempts and keep user
    console.log('[Register] User exists with incomplete onboarding, allowing fresh start:', email);
    
    // Get full user data
    const fullUserResult = await pool.query(
      'SELECT id, email, display_name FROM users WHERE id = $1',
      [userId]
    );
    const fullUser = fullUserResult.rows[0];
    
    // Delete all incomplete onboarding attempts for this user
    await pool.query(
      'DELETE FROM onboarding_responses WHERE user_id = $1 AND completed_at IS NULL',
      [userId]
    );
    
    // Increment login attempts (counts as a login) - schema-adaptive
    try {
      await pool.query(
        'UPDATE users SET login_attempts = COALESCE(login_attempts, 0) + 1 WHERE id = $1',
        [userId]
      );
    } catch (e: any) {
      // Column doesn't exist yet - skip increment (will be added by migration)
      console.log('[Register] login_attempts column not found, skipping increment');
    }
    
    // Return the existing user (no need to create new one)
    const token = createToken(userId);
    
    return NextResponse.json({
      token,
      user: {
        id: fullUser.id,
        email: fullUser.email,
        name: fullUser.display_name || fullUser.email,
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

