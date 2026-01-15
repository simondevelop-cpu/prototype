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
      useUsersTable = schemaCheck.rows.some(row => row.column_name === 'completed_at');
      hasLastStep = schemaCheck.rows.some(row => row.column_name === 'last_step');
      hasAcquisitionOther = schemaCheck.rows.some(row => row.column_name === 'acquisition_other');
      console.log('[Customer Data API] Schema check:', { useUsersTable, hasLastStep, hasAcquisitionOther });
    } catch (e) {
      console.log('[Customer Data API] Could not check schema, using fallback');
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

    // Fetch all customer data - use users table if migrated, fallback to onboarding_responses
    let result;
    if (useUsersTable) {
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
    } else {
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
          o.completed_at,
          COALESCE(p.created_at, u.created_at) as created_at,
          COALESCE(p.updated_at, o.updated_at) as updated_at
        `;

        result = await pool.query(`
          SELECT ${selectFields}
          FROM users u
          LEFT JOIN l0_pii_users p ON u.id = p.internal_user_id AND p.deleted_at IS NULL
          LEFT JOIN LATERAL (
            SELECT *
            FROM onboarding_responses
            WHERE user_id = u.id
            ORDER BY created_at DESC
            LIMIT 1
          ) o ON true
          WHERE u.email != $1
          ORDER BY o.completed_at DESC NULLS LAST, u.created_at DESC
        `, [ADMIN_EMAIL]);
      } else {
        // Fallback to legacy onboarding_responses table (pre-migration)
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
          ${hasAcquisitionOther ? 'o.acquisition_other,' : ''}
          o.insight_preferences,
          o.insight_other,
          ${hasLastStep ? 'o.last_step,' : ''}
          o.completed_at,
          o.created_at,
          o.updated_at
        `;

        result = await pool.query(`
          SELECT ${selectFields}
          FROM users u
          LEFT JOIN LATERAL (
            SELECT *
            FROM onboarding_responses
            WHERE user_id = u.id
            ORDER BY created_at DESC
            LIMIT 1
          ) o ON true
          WHERE u.email != $1
          ORDER BY o.completed_at DESC NULLS LAST, u.created_at DESC
        `, [ADMIN_EMAIL]);
      }
    }

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

