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
          COUNT(DISTINCT COALESCE(tf.id, t.id)) as transaction_count,
          MAX(COALESCE(tf.created_at, t.created_at)) as last_activity,
          COUNT(DISTINCT CASE WHEN u.completed_at IS NOT NULL THEN u.id END) as completed_onboarding_count
        FROM users u
        LEFT JOIN l0_user_tokenization ut ON u.id = ut.internal_user_id
        LEFT JOIN l1_transaction_facts tf ON ut.tokenized_user_id = tf.tokenized_user_id
        LEFT JOIN transactions t ON u.id = t.user_id AND tf.id IS NULL
        WHERE u.email != $1
        GROUP BY ${groupByFields}${hasIsActive && hasEmailValidated ? ', u.is_active, u.email_validated' : ''}
        ORDER BY u.created_at DESC
      `, [ADMIN_EMAIL]);
    } else {
      // Fallback to onboarding_responses table (pre-migration)
      result = await pool.query(`
        SELECT 
          ${selectFields},
          COUNT(DISTINCT COALESCE(tf.id, t.id)) as transaction_count,
          MAX(COALESCE(tf.created_at, t.created_at)) as last_activity,
          COUNT(DISTINCT CASE WHEN o.completed_at IS NOT NULL THEN o.id END) as completed_onboarding_count
        FROM users u
        LEFT JOIN l0_user_tokenization ut ON u.id = ut.internal_user_id
        LEFT JOIN l1_transaction_facts tf ON ut.tokenized_user_id = tf.tokenized_user_id
        LEFT JOIN transactions t ON u.id = t.user_id AND tf.id IS NULL
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
        // Consent-related fields are populated in a follow-up step below (schema-adaptive)
        account_creation_consent_at: null,
        cookie_consent_choice: null,
        cookie_consent_at: null,
        first_upload_consent_at: null,
      };
    });

    // Enrich users with consent information from user_events (schema-adaptive)
    try {
      // Check if user_events table exists
      const tableCheck = await pool.query(`
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_name = 'user_events'
        LIMIT 1
      `);

      if (tableCheck.rows.length > 0 && users.length > 0) {
        const userIds = users.map(u => u.id);

        // Fetch latest consent events per user and consentType
        const consentResult = await pool.query(`
          SELECT DISTINCT ON (user_id, metadata->>'consentType')
            user_id,
            metadata->>'consentType' AS consent_type,
            metadata->>'choice' AS choice,
            event_timestamp,
            metadata
          FROM l1_events
          WHERE event_type = 'consent'
            AND user_id = ANY($1::int[])
          ORDER BY user_id, metadata->>'consentType', event_timestamp DESC
        `, [userIds]);

        const consentByUser: Record<number, any> = {};
        for (const row of consentResult.rows) {
          const uid = row.user_id as number;
          if (!consentByUser[uid]) consentByUser[uid] = {};
          consentByUser[uid][row.consent_type] = {
            choice: row.choice,
            event_timestamp: row.event_timestamp,
          };
        }

        // Attach consent info to users
        users.forEach(user => {
          const info = consentByUser[user.id] || {};
          const accountCreation = info['account_creation'];
          const cookieBanner = info['cookie_banner'];
          const firstUpload = info['first_upload'];

          user.account_creation_consent_at = accountCreation?.event_timestamp || null;
          user.cookie_consent_choice = cookieBanner?.choice || null;
          user.cookie_consent_at = cookieBanner?.event_timestamp || null;
          
          // If user has transactions but no first_upload consent event, they likely gave consent before logging was added
          // Show a note that consent was given (implied by having transactions) but timestamp is unavailable
          if (!firstUpload && user.transaction_count > 0) {
            user.first_upload_consent_at = 'Consent given (pre-logging)';
          } else {
            user.first_upload_consent_at = firstUpload?.event_timestamp || null;
          }
        });
      }
    } catch (e) {
      console.log('[Users API] Could not enrich users with consent events:', e);
      // Continue without consent enrichment
    }

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

