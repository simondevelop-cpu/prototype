import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';

export const dynamic = 'force-dynamic';

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

    // Check where data actually exists - be flexible and check both tables
    let hasCompletedAt = false;
    let hasLastStep = false;
    let hasAcquisitionOther = false;
    let hasIsActive = false;
    let hasEmailValidated = false;
    let useUsersTable = false;
    let onboardingResponsesExists = false;
    
    try {
      // Check users table schema
      const schemaCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name IN ('completed_at', 'last_step', 'acquisition_other', 'is_active', 'email_validated', 'motivation', 'emotional_state')
      `);
      hasCompletedAt = schemaCheck.rows.some(row => row.column_name === 'completed_at');
      hasLastStep = schemaCheck.rows.some(row => row.column_name === 'last_step');
      hasAcquisitionOther = schemaCheck.rows.some(row => row.column_name === 'acquisition_other');
      hasIsActive = schemaCheck.rows.some(row => row.column_name === 'is_active');
      hasEmailValidated = schemaCheck.rows.some(row => row.column_name === 'email_validated');
      
      // Check if onboarding_responses table exists
      const onboardingTableCheck = await pool.query(`
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'onboarding_responses'
        LIMIT 1
      `);
      onboardingResponsesExists = onboardingTableCheck.rows.length > 0;
      
      // Check where data actually exists
      if (hasCompletedAt) {
        const usersDataCheck = await pool.query(`
          SELECT COUNT(*) as count
          FROM users
          WHERE (completed_at IS NOT NULL 
            OR motivation IS NOT NULL 
            OR emotional_state IS NOT NULL)
          AND email != $1
        `, [ADMIN_EMAIL]);
        const usersWithData = parseInt(usersDataCheck.rows[0]?.count || '0', 10);
        useUsersTable = usersWithData > 0;
        
        // If users table has columns but no data, check onboarding_responses
        if (!useUsersTable && onboardingResponsesExists) {
          const onboardingDataCheck = await pool.query(`
            SELECT COUNT(*) as count
            FROM onboarding_responses
          `);
          const onboardingCount = parseInt(onboardingDataCheck.rows[0]?.count || '0', 10);
          if (onboardingCount > 0) {
            console.log('[Customer Data API] Users table has columns but no data, using onboarding_responses');
            useUsersTable = false; // Use onboarding_responses
          }
        }
      } else if (onboardingResponsesExists) {
        // No migration yet, use onboarding_responses
        useUsersTable = false;
      } else {
        // No tables with data
        return NextResponse.json({ 
          success: true,
          customerData: [],
          message: 'No onboarding data found. Please ensure migration has been run or onboarding_responses table exists.',
          source: 'none'
        }, { status: 200 });
      }
    } catch (e) {
      console.error('[Customer Data API] Error checking data location:', e);
      return NextResponse.json({ 
        success: false,
        error: 'Could not determine data location',
        details: e instanceof Error ? e.message : 'Unknown error'
      }, { status: 500 });
    }

    // Check if l0_pii_users table exists (for PII isolation)
    let useL0PII = false;
    try {
      const l0Check = await pool.query(`
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'l0_pii_users'
        LIMIT 1
      `);
      useL0PII = l0Check.rows.length > 0;
    } catch (e) {
      console.log('[Customer Data API] Could not check for l0_pii_users');
    }

    // Check if transactions table has upload_session_id column
    let hasUploadSessionId = false;
    try {
      const uploadSessionCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'transactions' 
        AND column_name = 'upload_session_id'
      `);
      hasUploadSessionId = uploadSessionCheck.rows.length > 0;
    } catch (e) {
      console.log('[Customer Data API] Could not check for upload_session_id column');
    }

    // Use appropriate table based on where data exists
    let result;
    
    if (useUsersTable) {
      // Use users table (post-migration) - Include ALL variables used in dashboard
      // Add transaction counts, upload counts, and first transaction date for cohort analysis
      const selectFields = useL0PII ? `
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
    ` : `
      u.id as user_id,
      u.email,
      NULL as first_name,
      NULL as last_name,
      NULL as date_of_birth,
      NULL as recovery_phone,
      NULL as province_region,
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

    const fromClause = useL0PII 
      ? `FROM users u
         LEFT JOIN l0_pii_users p ON u.id = p.internal_user_id AND p.deleted_at IS NULL`
      : `FROM users u`;

    console.log('[Customer Data API] Querying users table, useL0PII:', useL0PII, 'hasLastStep:', hasLastStep, 'hasAcquisitionOther:', hasAcquisitionOther, 'hasUploadSessionId:', hasUploadSessionId);
    
    // First, test if we can query users at all
    try {
      const testQuery = await pool.query(`
        SELECT COUNT(*) as count
        FROM users
        WHERE email != $1
      `, [ADMIN_EMAIL]);
      console.log('[Customer Data API] Test query found', testQuery.rows[0]?.count, 'total users');
    } catch (testError) {
      console.error('[Customer Data API] Test query failed:', testError);
    }
    
    // Build transaction stats subquery based on schema
    const transactionStatsQuery = hasUploadSessionId ? `
      SELECT 
        user_id,
        COUNT(DISTINCT id) as transaction_count,
        COUNT(DISTINCT upload_session_id) FILTER (WHERE upload_session_id IS NOT NULL) as upload_session_count,
        MIN(created_at) as first_transaction_date
      FROM transactions
      GROUP BY user_id
    ` : `
      SELECT 
        user_id,
        COUNT(DISTINCT id) as transaction_count,
        0 as upload_session_count,
        MIN(created_at) as first_transaction_date
      FROM transactions
      GROUP BY user_id
    `;
    
    try {
      // Log the actual query for debugging (first 500 chars)
      const fullQuery = `
        SELECT ${selectFields}
        ${fromClause}
        LEFT JOIN (
          ${transactionStatsQuery}
        ) transaction_stats ON transaction_stats.user_id = u.id
        WHERE u.email != $1
        ORDER BY u.completed_at DESC NULLS LAST, u.created_at DESC
      `;
      console.log('[Customer Data API] Query preview:', fullQuery.substring(0, 500));
      
      result = await pool.query(fullQuery, [ADMIN_EMAIL]);
    } catch (queryError: any) {
      console.error('[Customer Data API] Query failed:', queryError);
      console.error('[Customer Data API] Error message:', queryError.message);
      console.error('[Customer Data API] Error stack:', queryError.stack);
      console.error('[Customer Data API] Query details:', {
        useL0PII,
        hasLastStep,
        hasAcquisitionOther,
        hasIsActive,
        hasEmailValidated,
        selectFieldsPreview: selectFields.substring(0, 200),
        fromClause
      });
      
      // Return a more helpful error
      return NextResponse.json({
        success: false,
        error: 'Query execution failed',
        message: queryError.message || 'Unknown database error',
        details: 'Check server logs for full query details'
      }, { status: 500 });
    }
      
    console.log(`[Customer Data API] Query returned ${result.rows.length} customer records from users table`);
    if (result.rows.length > 0) {
      console.log('[Customer Data API] Sample record:', {
        user_id: result.rows[0].user_id,
        email: result.rows[0].email?.substring(0, 30),
        has_motivation: !!result.rows[0].motivation,
        has_emotional_state: !!result.rows[0].emotional_state,
        has_completed_at: !!result.rows[0].completed_at
      });
    }
    } else {
      // Use onboarding_responses table (pre-migration or data not migrated yet)
      console.log('[Customer Data API] Using onboarding_responses table');
      
      // Check onboarding_responses schema
      let onboardingHasLastStep = false;
      let onboardingHasAcquisitionOther = false;
      try {
        const onboardingSchemaCheck = await pool.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'onboarding_responses' 
          AND column_name IN ('last_step', 'acquisition_other')
        `);
        onboardingHasLastStep = onboardingSchemaCheck.rows.some(row => row.column_name === 'last_step');
        onboardingHasAcquisitionOther = onboardingSchemaCheck.rows.some(row => row.column_name === 'acquisition_other');
      } catch (e) {
        console.log('[Customer Data API] Could not check onboarding_responses schema');
      }
      
      const selectFields = useL0PII ? `
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
        ${onboardingHasAcquisitionOther ? 'o.acquisition_other,' : ''}
        o.insight_preferences,
        o.insight_other,
        ${onboardingHasLastStep ? 'o.last_step,' : ''}
        false as is_active,
        false as email_validated,
        o.completed_at,
        COALESCE(p.created_at, u.created_at) as created_at,
        COALESCE(p.updated_at, o.updated_at) as updated_at,
        COALESCE(transaction_stats.transaction_count, 0) as transaction_count,
        COALESCE(transaction_stats.upload_session_count, 0) as upload_session_count,
        transaction_stats.first_transaction_date
      ` : `
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
        ${onboardingHasAcquisitionOther ? 'o.acquisition_other,' : ''}
        o.insight_preferences,
        o.insight_other,
        ${onboardingHasLastStep ? 'o.last_step,' : ''}
        false as is_active,
        false as email_validated,
        o.completed_at,
        o.created_at,
        o.updated_at,
        COALESCE(transaction_stats.transaction_count, 0) as transaction_count,
        COALESCE(transaction_stats.upload_session_count, 0) as upload_session_count,
        transaction_stats.first_transaction_date
      `;

      const fromClause = useL0PII 
        ? `FROM users u
           LEFT JOIN l0_pii_users p ON u.id = p.internal_user_id AND p.deleted_at IS NULL
           INNER JOIN onboarding_responses o ON o.user_id = u.id`
        : `FROM users u
           INNER JOIN onboarding_responses o ON o.user_id = u.id`;

      // Build transaction stats subquery based on schema
      const transactionStatsQuery = hasUploadSessionId ? `
        SELECT 
          user_id,
          COUNT(DISTINCT id) as transaction_count,
          COUNT(DISTINCT upload_session_id) FILTER (WHERE upload_session_id IS NOT NULL) as upload_session_count,
          MIN(created_at) as first_transaction_date
        FROM transactions
        GROUP BY user_id
      ` : `
        SELECT 
          user_id,
          COUNT(DISTINCT id) as transaction_count,
          0 as upload_session_count,
          MIN(created_at) as first_transaction_date
        FROM transactions
        GROUP BY user_id
      `;

      result = await pool.query(`
        SELECT ${selectFields}
        ${fromClause}
        LEFT JOIN (
          ${transactionStatsQuery}
        ) transaction_stats ON transaction_stats.user_id = u.id
        WHERE u.email != $1
        ORDER BY o.completed_at DESC NULLS LAST, u.created_at DESC
      `, [ADMIN_EMAIL]);
      
      console.log(`[Customer Data API] Returning ${result.rows.length} customer records from onboarding_responses table`);
    }

    console.log(`[Customer Data API] Returning ${result.rows.length} customer records`);
    
    return NextResponse.json({ 
      success: true,
      customerData: result.rows,
      source: useUsersTable ? 'users' : 'onboarding_responses',
      count: result.rows.length,
      migrationComplete: useUsersTable
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error fetching customer data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer data', details: error.message },
      { status: 500 }
    );
  }
}

