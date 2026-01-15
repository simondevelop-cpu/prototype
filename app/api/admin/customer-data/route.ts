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

    // Check if migration is complete - users table must have onboarding columns
    // If not migrated, we should NOT use onboarding_responses - migration must be run first
    let hasCompletedAt = false;
    let hasLastStep = false;
    let hasAcquisitionOther = false;
    let hasIsActive = false;
    let hasEmailValidated = false;
    
    try {
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
      
      if (!hasCompletedAt || !schemaCheck.rows.some(row => row.column_name === 'motivation')) {
        return NextResponse.json({ 
          success: false,
          error: 'Migration not complete',
          message: 'Onboarding data migration has not been completed. Please run the migration at /api/admin/migrate-merge-onboarding first.',
          migrationRequired: true
        }, { status: 400 });
      }
    } catch (e) {
      console.error('[Customer Data API] Error checking migration status:', e);
      return NextResponse.json({ 
        success: false,
        error: 'Could not verify migration status',
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

    // Fetch all customer data from users table ONLY (post-migration)
    let result;
    // Use users table ONLY (post-migration) - Include ALL variables used in dashboard
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

    result = await pool.query(`
      SELECT ${selectFields}
      ${fromClause}
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

    console.log(`[Customer Data API] Returning ${result.rows.length} customer records from users table (post-migration)`);
    
    return NextResponse.json({ 
      success: true,
      customerData: result.rows,
      source: 'users',
      count: result.rows.length,
      migrationComplete: true
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error fetching customer data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer data', details: error.message },
      { status: 500 }
    );
  }
}

