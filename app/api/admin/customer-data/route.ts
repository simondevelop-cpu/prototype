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

    // Schema-adaptive: Check if onboarding columns exist in users table (post-migration)
    // Also check if there's actual data in users table, otherwise fall back to onboarding_responses
    let useUsersTable = false;
    let hasLastStep = false;
    let hasAcquisitionOther = false;
    try {
      const schemaCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name IN ('completed_at', 'last_step', 'acquisition_other')
      `);
      const hasCompletedAtColumn = schemaCheck.rows.some(row => row.column_name === 'completed_at');
      hasLastStep = schemaCheck.rows.some(row => row.column_name === 'last_step');
      hasAcquisitionOther = schemaCheck.rows.some(row => row.column_name === 'acquisition_other');
      
        // Check if users table has actual onboarding data (not just columns)
        // Check for ANY onboarding fields, not just completed_at
        if (hasCompletedAtColumn) {
          const dataCheck = await pool.query(`
            SELECT COUNT(*) as count
            FROM users
            WHERE (completed_at IS NOT NULL 
              OR emotional_state IS NOT NULL 
              OR motivation IS NOT NULL
              OR financial_context IS NOT NULL)
            AND email != $1
          `, [ADMIN_EMAIL]);
          const usersWithData = parseInt(dataCheck.rows[0]?.count || '0', 10);
        
        // Also check if onboarding_responses has data
        const onboardingCheck = await pool.query(`
          SELECT COUNT(*) as count
          FROM onboarding_responses
        `);
        const onboardingCount = parseInt(onboardingCheck.rows[0]?.count || '0', 10);
        
        // Use users table only if it has data, otherwise prefer onboarding_responses if it has data
        if (usersWithData > 0) {
          useUsersTable = true;
          console.log(`[Customer Data API] Found ${usersWithData} users with onboarding data in users table`);
        } else if (onboardingCount > 0) {
          useUsersTable = false; // Use onboarding_responses instead
          console.log(`[Customer Data API] Users table has columns but no data (${usersWithData} users), using onboarding_responses (${onboardingCount} records)`);
        } else {
          useUsersTable = true; // Use users table structure even if empty
          console.log('[Customer Data API] No data in either table, using users table structure');
        }
        
        console.log('[Customer Data API] Schema and data check:', { 
          useUsersTable, 
          hasLastStep, 
          hasAcquisitionOther,
          usersWithData,
          onboardingCount
        });
      }
    } catch (e) {
      console.log('[Customer Data API] Could not check schema, using fallback:', e);
    }

    // Check if l0_pii_users table exists (migration status)
    let useL0PII = false;
    try {
      const l0Check = await pool.query(`
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'l0_pii_users'
        LIMIT 1
      `);
      useL0PII = l0Check.rows.length > 0;
    } catch (e) {
      console.log('[Customer Data API] Could not check for l0_pii_users, using legacy tables');
    }

    // Fetch all customer data - check BOTH users table AND onboarding_responses
    // This ensures we get data regardless of migration status
    let result;
    
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
      console.log('[Customer Data API] Could not check is_active/email_validated');
    }

    if (useUsersTable) {
      // Use users table (post-migration) - Include ALL variables used in dashboard
      // Add transaction counts, upload counts, and first transaction date for cohort analysis
      const selectFields = `
        u.id as user_id,
        COALESCE(p.email, u.email) as email,
        p.first_name,
        p.last_name,
        p.date_of_birth,
        p.recovery_phone,
        p.province_region,
        u.emotional_state,
        u.financial_context,
        u.motivation,
        u.motivation_other,
        u.acquisition_source,
        ${hasAcquisitionOther ? 'u.acquisition_other,' : ''}
        u.insight_preferences,
        u.insight_other,
        ${hasLastStep ? 'u.last_step,' : ''}
        ${hasIsActive ? 'u.is_active,' : 'true as is_active,'}
        ${hasEmailValidated ? 'u.email_validated,' : 'false as email_validated,'}
        u.completed_at,
        u.created_at,
        u.updated_at,
        COALESCE(transaction_stats.transaction_count, 0) as transaction_count,
        COALESCE(transaction_stats.upload_session_count, 0) as upload_session_count,
        transaction_stats.first_transaction_date
      `;

      result = await pool.query(`
        SELECT ${selectFields}
        FROM users u
        LEFT JOIN l0_pii_users p ON u.id = p.internal_user_id AND p.deleted_at IS NULL
        LEFT JOIN (
          SELECT 
            user_id,
            COUNT(DISTINCT id) as transaction_count,
            COUNT(DISTINCT upload_session_id) FILTER (WHERE upload_session_id IS NOT NULL) as upload_session_count,
            MIN(created_at) as first_transaction_date
          FROM transactions
          GROUP BY user_id
        ) transaction_stats ON transaction_stats.user_id = u.id
        WHERE u.email != $1
        ORDER BY u.completed_at DESC NULLS LAST, u.created_at DESC
      `, [ADMIN_EMAIL]);
      
      console.log(`[Customer Data API] Found ${result.rows.length} users in users table`);
      
      // If no results from users table with onboarding data, check onboarding_responses
      if (result.rows.length === 0 || result.rows.every((row: any) => !row.completed_at && !row.emotional_state && !row.motivation)) {
        console.log('[Customer Data API] No onboarding data in users table, checking onboarding_responses');
        useUsersTable = false; // Force fallback to onboarding_responses
      }
    }
    
    if (!useUsersTable) {
      // Fallback to onboarding_responses table (pre-migration)
      // Check which columns exist in onboarding_responses
      try {
        const schemaCheck = await pool.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'onboarding_responses' 
          AND column_name IN ('last_step', 'acquisition_other')
        `);
        hasLastStep = schemaCheck.rows.some(row => row.column_name === 'last_step');
        hasAcquisitionOther = schemaCheck.rows.some(row => row.column_name === 'acquisition_other');
      } catch (e) {
        console.log('[Customer Data API] Could not check onboarding_responses schema');
      }

      if (useL0PII) {
        // Use L0 PII table for compliance (PII isolation) with onboarding_responses
        const selectFields = `
          u.id as user_id,
          COALESCE(p.email, u.email) as email,
          p.first_name,
          p.last_name,
          p.date_of_birth,
          p.recovery_phone,
          p.province_region,
          o.emotional_state,
          o.financial_context,
          o.motivation,
          o.motivation_other,
          o.acquisition_source,
          ${hasAcquisitionOther ? 'o.acquisition_other,' : ''}
          o.insight_preferences,
          o.insight_other,
          ${hasLastStep ? 'o.last_step,' : ''}
          false as is_active,
          false as email_validated,
          o.completed_at,
          COALESCE(p.created_at, u.created_at) as created_at,
          COALESCE(p.updated_at, o.updated_at) as updated_at,
          0 as transaction_count,
          0 as upload_session_count,
          NULL as first_transaction_date
        `;

        // Get data from onboarding_responses table (when users table doesn't have onboarding data)
        result = await pool.query(`
          SELECT ${selectFields}
          FROM users u
          LEFT JOIN l0_pii_users p ON u.id = p.internal_user_id AND p.deleted_at IS NULL
          INNER JOIN onboarding_responses o ON o.user_id = u.id
          WHERE u.email != $1
          ORDER BY o.completed_at DESC NULLS LAST, u.created_at DESC
        `, [ADMIN_EMAIL]);
      } else {
        // Fallback to legacy onboarding_responses table (pre-migration, no L0 PII)
        const selectFields = `
          u.id as user_id,
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
          ${hasAcquisitionOther ? 'o.acquisition_other,' : ''}
          o.insight_preferences,
          o.insight_other,
          ${hasLastStep ? 'o.last_step,' : ''}
          false as is_active,
          false as email_validated,
          o.completed_at,
          o.created_at,
          o.updated_at,
          0 as transaction_count,
          0 as upload_session_count,
          NULL as first_transaction_date
        `;

        // Get data from onboarding_responses table
        result = await pool.query(`
          SELECT ${selectFields}
          FROM users u
          INNER JOIN onboarding_responses o ON o.user_id = u.id
          WHERE u.email != $1
          ORDER BY o.completed_at DESC NULLS LAST, u.created_at DESC
        `, [ADMIN_EMAIL]);
      }
    }

    console.log(`[Customer Data API] Returning ${result.rows.length} customer records`);
    
    return NextResponse.json({ 
      success: true,
      customerData: result.rows,
      source: useUsersTable ? 'users' : 'onboarding_responses',
      count: result.rows.length
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error fetching customer data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer data', details: error.message },
      { status: 500 }
    );
  }
}

