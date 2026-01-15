/**
 * Cohort Analysis API
 * Returns activation and engagement metrics by signup week
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const ADMIN_EMAIL = 'admin@canadianinsights.ca';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

interface CohortFilters {
  totalAccounts?: boolean;
  validatedEmails?: boolean;
  intentCategories?: string[];
}

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
      if (decoded.role !== 'admin' && decoded.email !== ADMIN_EMAIL) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Parse query parameters
    const url = new URL(request.url);
    const filters: CohortFilters = {
      totalAccounts: url.searchParams.get('totalAccounts') === 'true',
      validatedEmails: url.searchParams.get('validatedEmails') === 'true',
      intentCategories: url.searchParams.get('intentCategories')?.split(',').filter(Boolean) || [],
    };

    // Check if users table has onboarding columns (schema-adaptive)
    const schemaCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('completed_at', 'motivation', 'is_active', 'email_validated')
    `);
    
    const useUsersTable = schemaCheck.rows.some(row => row.column_name === 'completed_at');
    const hasEmailValidated = schemaCheck.rows.some(row => row.column_name === 'email_validated');

    // Build filter conditions
    let filterConditions = '';
    const filterParams: any[] = [];
    let paramIndex = 1;

    if (filters.validatedEmails && hasEmailValidated) {
      filterConditions += ` AND u.email_validated = true`;
    }

    if (filters.intentCategories && filters.intentCategories.length > 0) {
      filterConditions += ` AND u.motivation = ANY($${paramIndex})`;
      filterParams.push(filters.intentCategories);
      paramIndex++;
    }

    // Calculate signup weeks (12 weeks back from current week)
    const now = new Date();
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
    currentWeekStart.setHours(0, 0, 0, 0);

    const weeks: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date(currentWeekStart);
      weekStart.setDate(currentWeekStart.getDate() - (i * 7));
      const weekLabel = `w/c ${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      weeks.push(weekLabel);
    }

    // Get activation metrics (onboarding steps)
    // Track all steps: 1=Emotional Calibration, 2=Financial Context, 3=Motivation, 4=Acquisition Source, 5=Insight Preferences, 6=Email Verification, 7=Account Profile
    const activationQuery = useUsersTable ? `
      SELECT 
        DATE_TRUNC('week', u.created_at) as signup_week,
        COUNT(*) FILTER (WHERE u.created_at IS NOT NULL) as count_starting_onboarding,
        COUNT(*) FILTER (WHERE u.last_step = 1 AND u.completed_at IS NULL) as count_drop_off_step_1,
        COUNT(*) FILTER (WHERE u.last_step = 2 AND u.completed_at IS NULL) as count_drop_off_step_2,
        COUNT(*) FILTER (WHERE u.last_step = 3 AND u.completed_at IS NULL) as count_drop_off_step_3,
        COUNT(*) FILTER (WHERE u.last_step = 4 AND u.completed_at IS NULL) as count_drop_off_step_4,
        COUNT(*) FILTER (WHERE u.last_step = 5 AND u.completed_at IS NULL) as count_drop_off_step_5,
        COUNT(*) FILTER (WHERE u.last_step = 6 AND u.completed_at IS NULL) as count_drop_off_step_6,
        COUNT(*) FILTER (WHERE u.last_step = 7 AND u.completed_at IS NULL) as count_drop_off_step_7,
        COUNT(*) FILTER (WHERE u.completed_at IS NOT NULL) as count_completed_onboarding,
        AVG(EXTRACT(EPOCH FROM (u.completed_at - u.created_at)) / 86400) FILTER (WHERE u.completed_at IS NOT NULL) as avg_time_to_onboard_days
      FROM users u
      WHERE u.email != $${paramIndex}
        ${filterConditions}
      GROUP BY DATE_TRUNC('week', u.created_at)
      ORDER BY signup_week DESC
      LIMIT 12
    ` : `
      SELECT 
        DATE_TRUNC('week', u.created_at) as signup_week,
        COUNT(*) as count_starting_onboarding,
        0 as count_drop_off_step_1,
        0 as count_drop_off_step_2,
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM onboarding_responses o 
          WHERE o.user_id = u.id AND o.completed_at IS NOT NULL
        )) as count_completed_onboarding,
        NULL as avg_time_to_onboard_days
      FROM users u
      WHERE u.email != $${paramIndex}
        ${filterConditions}
      GROUP BY DATE_TRUNC('week', u.created_at)
      ORDER BY signup_week DESC
      LIMIT 12
    `;

    filterParams.push(ADMIN_EMAIL);
    const activationResult = await pool.query(activationQuery, filterParams);

    // Get engagement metrics
    // Check if user_events table exists
    let hasUserEvents = false;
    try {
      const eventsCheck = await pool.query(`
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'user_events'
        LIMIT 1
      `);
      hasUserEvents = eventsCheck.rows.length > 0;
    } catch (e) {
      // Table doesn't exist
    }

    // Check if transactions table has upload_session_id
    let hasUploadSession = false;
    try {
      const uploadCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'transactions' 
        AND column_name = 'upload_session_id'
        LIMIT 1
      `);
      hasUploadSession = uploadCheck.rows.length > 0;
    } catch (e) {
      // Column doesn't exist
    }

    // Enhanced Engagement query with more metrics
    const engagementQuery = useUsersTable ? `
      SELECT 
        DATE_TRUNC('week', u.created_at) as signup_week,
        -- Onboarding and data coverage
        COUNT(*) FILTER (WHERE u.completed_at IS NOT NULL) as onboarding_completed,
        COUNT(DISTINCT t.user_id) FILTER (WHERE t.id IS NOT NULL) as uploaded_first_statement,
        COUNT(DISTINCT CASE WHEN upload_counts.upload_count >= 2 THEN upload_counts.user_id END) as uploaded_two_statements,
        COUNT(DISTINCT CASE WHEN upload_counts.upload_count >= 3 THEN upload_counts.user_id END) as uploaded_three_plus_statements,
        -- Time to achieve (in days) - excluding NULLs
        AVG(EXTRACT(EPOCH FROM (u.completed_at - u.created_at)) / 86400) FILTER (WHERE u.completed_at IS NOT NULL) as avg_time_to_onboard_days,
        AVG(EXTRACT(EPOCH FROM (first_upload.first_transaction_date - u.created_at)) / 86400) FILTER (WHERE first_upload.first_transaction_date IS NOT NULL) as avg_time_to_first_upload_days,
        -- Engagement signals
        AVG(transaction_counts.tx_count) FILTER (WHERE transaction_counts.tx_count > 0) as avg_transactions_per_user,
        COUNT(DISTINCT CASE WHEN transaction_counts.tx_count > 0 THEN u.id END) as users_with_transactions
      FROM users u
      LEFT JOIN transactions t ON t.user_id = u.id
      LEFT JOIN (
        SELECT user_id, COUNT(DISTINCT upload_session_id) as upload_count
        FROM transactions
        WHERE upload_session_id IS NOT NULL
        GROUP BY user_id
      ) upload_counts ON upload_counts.user_id = u.id
      LEFT JOIN (
        SELECT user_id, MIN(created_at) as first_transaction_date
        FROM transactions
        GROUP BY user_id
      ) first_upload ON first_upload.user_id = u.id
      LEFT JOIN (
        SELECT user_id, COUNT(*) as tx_count
        FROM transactions
        GROUP BY user_id
      ) transaction_counts ON transaction_counts.user_id = u.id
      WHERE u.email != $${paramIndex}
        ${filterConditions}
      GROUP BY DATE_TRUNC('week', u.created_at)
      ORDER BY signup_week DESC
      LIMIT 12
    ` : `
      SELECT 
        DATE_TRUNC('week', u.created_at) as signup_week,
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM onboarding_responses o 
          WHERE o.user_id = u.id AND o.completed_at IS NOT NULL
        )) as onboarding_completed,
        COUNT(DISTINCT t.user_id) FILTER (WHERE t.id IS NOT NULL) as uploaded_first_statement,
        0 as uploaded_two_statements,
        0 as uploaded_three_plus_statements,
        NULL as avg_time_to_onboard_days,
        NULL as avg_time_to_first_upload_days,
        NULL as avg_transactions_per_user,
        0 as users_with_transactions
      FROM users u
      LEFT JOIN transactions t ON t.user_id = u.id
      WHERE u.email != $${paramIndex}
        ${filterConditions}
      GROUP BY DATE_TRUNC('week', u.created_at)
      ORDER BY signup_week DESC
      LIMIT 12
    `;

    // Check if user_events table exists for engagement metrics
    let hasUserEventsTable = false;
    try {
      const eventsTableCheck = await pool.query(`
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'user_events'
        LIMIT 1
      `);
      hasUserEventsTable = eventsTableCheck.rows.length > 0;
    } catch (e) {
      console.log('[Cohort Analysis] Could not check for user_events table');
    }

    const engagementResult = await pool.query(engagementQuery, filterParams);

    // Get user_events data if table exists
    let userEventsData: any = {};
    if (hasUserEventsTable && useUsersTable) {
      try {
        // Calculate login metrics per week
        const eventsQuery = `
          SELECT 
            DATE_TRUNC('week', u.created_at) as signup_week,
            COUNT(DISTINCT CASE 
              WHEN ue.created_at >= u.created_at 
              AND ue.created_at < u.created_at + INTERVAL '7 days'
              AND ue.event_type = 'login' 
              THEN DATE(ue.created_at) 
            END) as unique_login_days_week_0,
            COUNT(DISTINCT CASE 
              WHEN ue.created_at >= u.created_at + INTERVAL '7 days'
              AND ue.created_at < u.created_at + INTERVAL '14 days'
              AND ue.event_type = 'login' 
              THEN DATE(ue.created_at) 
            END) as unique_login_days_week_1
          FROM users u
          LEFT JOIN user_events ue ON ue.user_id = u.id
          WHERE u.email != $${paramIndex}
            ${filterConditions}
          GROUP BY DATE_TRUNC('week', u.created_at)
        `;
        const eventsResult = await pool.query(eventsQuery, filterParams);
        
        eventsResult.rows.forEach((row: any) => {
          const weekKey = `w/c ${new Date(row.signup_week).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
          if (!userEventsData[weekKey]) {
            userEventsData[weekKey] = {};
          }
          // For now, we'll calculate this more simply - users who logged in 2+ unique days
          // This is a simplified version - a full implementation would track across all weeks
        });
      } catch (e) {
        console.log('[Cohort Analysis] Could not fetch user_events data:', e);
      }
    }

    // Format results by week
    const activationByWeek: { [week: string]: any } = {};
    const engagementByWeek: { [week: string]: any } = {};

    activationResult.rows.forEach((row: any) => {
      const weekKey = `w/c ${new Date(row.signup_week).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      activationByWeek[weekKey] = {
        countStartingOnboarding: parseInt(row.count_starting_onboarding) || 0,
        countDropOffStep1: parseInt(row.count_drop_off_step_1) || 0,
        countDropOffStep2: parseInt(row.count_drop_off_step_2) || 0,
        countDropOffStep3: parseInt(row.count_drop_off_step_3) || 0,
        countDropOffStep4: parseInt(row.count_drop_off_step_4) || 0,
        countDropOffStep5: parseInt(row.count_drop_off_step_5) || 0,
        countDropOffStep6: parseInt(row.count_drop_off_step_6) || 0,
        countDropOffStep7: parseInt(row.count_drop_off_step_7) || 0,
        countCompletedOnboarding: parseInt(row.count_completed_onboarding) || 0,
        avgTimeToOnboardDays: row.avg_time_to_onboard_days ? parseFloat(row.avg_time_to_onboard_days).toFixed(1) : null,
      };
    });

    engagementResult.rows.forEach((row: any) => {
      const weekKey = `w/c ${new Date(row.signup_week).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      engagementByWeek[weekKey] = {
        // Onboarding and data coverage
        onboardingCompleted: parseInt(row.onboarding_completed) || 0,
        uploadedFirstStatement: parseInt(row.uploaded_first_statement) || 0,
        uploadedTwoStatements: parseInt(row.uploaded_two_statements) || 0,
        uploadedThreePlusStatements: parseInt(row.uploaded_three_plus_statements) || 0,
        // Time to achieve (in days)
        avgTimeToOnboardDays: row.avg_time_to_onboard_days ? parseFloat(row.avg_time_to_onboard_days).toFixed(1) : null,
        avgTimeToFirstUploadDays: row.avg_time_to_first_upload_days ? parseFloat(row.avg_time_to_first_upload_days).toFixed(1) : null,
        // Engagement signals
        avgTransactionsPerUser: row.avg_transactions_per_user ? parseFloat(row.avg_transactions_per_user).toFixed(1) : null,
        usersWithTransactions: parseInt(row.users_with_transactions) || 0,
      };
    });

    return NextResponse.json({
      success: true,
      weeks,
      activation: activationByWeek,
      engagement: engagementByWeek,
      filters,
      hasUserEventsTable,
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Cohort Analysis] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cohort analysis', details: error.message },
      { status: 500 }
    );
  }
}

