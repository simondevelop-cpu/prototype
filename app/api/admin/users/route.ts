import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
});

/**
 * GET /api/admin/users
 * Fetch all registered users with stats
 */
export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Check if login_attempts column exists (schema-adaptive)
    let hasLoginAttempts = false;
    try {
      const schemaCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'login_attempts'
      `);
      hasLoginAttempts = schemaCheck.rows.length > 0;
    } catch (e) {
      console.log('[Users API] Could not check schema');
    }

    // Schema-adaptive: Check if onboarding columns exist in users table (post-migration)
    let useUsersTable = false;
    try {
      const schemaCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'completed_at'
      `);
      useUsersTable = schemaCheck.rows.length > 0;
    } catch (e) {
      console.log('[Users API] Could not check schema');
    }

    // Check if is_active and email_validated columns exist
    let hasIsActive = false;
    let hasEmailValidated = false;
    try {
      const activeCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name IN ('is_active', 'email_validated')
      `);
      hasIsActive = activeCheck.rows.some(row => row.column_name === 'is_active');
      hasEmailValidated = activeCheck.rows.some(row => row.column_name === 'email_validated');
    } catch (e) {
      console.log('[Users API] Could not check is_active/email_validated columns');
    }

    // Fetch all users with transaction count, onboarding completion, and login attempts
    const selectFields = hasLoginAttempts 
      ? 'u.id, u.email, u.created_at, COALESCE(u.login_attempts, 0) as login_attempts'
      : 'u.id, u.email, u.created_at, 0 as login_attempts';
    
    const activeFields = hasIsActive && hasEmailValidated
      ? ', COALESCE(u.is_active, true) as is_active, COALESCE(u.email_validated, false) as email_validated'
      : hasIsActive
      ? ', COALESCE(u.is_active, true) as is_active, false as email_validated'
      : hasEmailValidated
      ? ', true as is_active, COALESCE(u.email_validated, false) as email_validated'
      : ', true as is_active, false as email_validated';
    
    const groupByFields = hasLoginAttempts && hasIsActive && hasEmailValidated
      ? 'u.id, u.email, u.created_at, u.login_attempts, u.is_active, u.email_validated'
      : hasLoginAttempts
      ? 'u.id, u.email, u.created_at, u.login_attempts'
      : 'u.id, u.email, u.created_at';

    let result;
    if (useUsersTable) {
      // Use users table (post-migration) - Single source of truth
      result = await pool.query(`
        SELECT 
          ${selectFields}${activeFields},
          COUNT(DISTINCT t.id) as transaction_count,
          MAX(t.created_at) as last_activity,
          COUNT(DISTINCT CASE WHEN u.completed_at IS NOT NULL THEN u.id END) as completed_onboarding_count
        FROM users u
        LEFT JOIN transactions t ON u.id = t.user_id
        WHERE u.email != $1
        GROUP BY ${groupByFields}${hasIsActive && hasEmailValidated ? ', u.is_active, u.email_validated' : ''}
        ORDER BY u.created_at DESC
      `, [ADMIN_EMAIL]);
    } else {
      // Fallback to onboarding_responses table (pre-migration)
      result = await pool.query(`
        SELECT 
          ${selectFields},
          COUNT(DISTINCT t.id) as transaction_count,
          MAX(t.created_at) as last_activity,
          COUNT(DISTINCT CASE WHEN o.completed_at IS NOT NULL THEN o.id END) as completed_onboarding_count
        FROM users u
        LEFT JOIN transactions t ON u.id = t.user_id
        LEFT JOIN onboarding_responses o ON u.id = o.user_id
        GROUP BY ${groupByFields}
        ORDER BY u.created_at DESC
      `);
    }

    const users = result.rows.map(row => {
      const transactionCount = parseInt(row.transaction_count) || 0;
      const completedOnboarding = parseInt(row.completed_onboarding_count) || 0;
      const loginAttempts = parseInt(row.login_attempts) || 0;
      
      return {
        id: row.id,
        email: row.email,
        created_at: row.created_at,
        transaction_count: transactionCount,
        last_activity: row.last_activity,
        login_attempts: loginAttempts,
        status: (transactionCount > 0 || completedOnboarding > 0) ? 'Active Account' : 'Failed to log in',
        is_active: row.is_active !== undefined ? row.is_active : true, // Include is_active if available
        email_validated: row.email_validated !== undefined ? row.email_validated : false, // Include email_validated if available
      };
    });

    return NextResponse.json({
      users,
      count: users.length,
    });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    
    if (error.message?.includes('does not exist')) {
      return NextResponse.json({
        users: [],
        count: 0,
        warning: 'Tables not initialized yet',
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch users', details: error.message },
      { status: 500 }
    );
  }
}

