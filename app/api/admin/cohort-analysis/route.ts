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
    const activationQuery = useUsersTable ? `
      SELECT 
        DATE_TRUNC('week', u.created_at) as signup_week,
        COUNT(*) FILTER (WHERE u.created_at IS NOT NULL) as count_starting_onboarding,
        COUNT(*) FILTER (WHERE u.last_step >= 1 AND u.completed_at IS NULL) as count_drop_off_step_1,
        COUNT(*) FILTER (WHERE u.last_step >= 2 AND u.completed_at IS NULL) as count_drop_off_step_2,
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

    // Engagement query (simplified for now - will need user_events table for full metrics)
    const engagementQuery = useUsersTable ? `
      SELECT 
        DATE_TRUNC('week', u.created_at) as signup_week,
        COUNT(*) FILTER (WHERE u.completed_at IS NOT NULL) as onboarding_completed,
        COUNT(DISTINCT t.user_id) FILTER (WHERE t.id IS NOT NULL) as uploaded_first_statement,
        COUNT(DISTINCT CASE WHEN upload_counts.upload_count >= 2 THEN t.user_id END) as uploaded_two_statements,
        COUNT(DISTINCT CASE WHEN upload_counts.upload_count >= 3 THEN t.user_id END) as uploaded_three_plus_statements
      FROM users u
      LEFT JOIN transactions t ON t.user_id = u.id
      LEFT JOIN (
        SELECT user_id, COUNT(DISTINCT upload_session_id) as upload_count
        FROM transactions
        WHERE upload_session_id IS NOT NULL
        GROUP BY user_id
      ) upload_counts ON upload_counts.user_id = u.id
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
        0 as uploaded_three_plus_statements
      FROM users u
      LEFT JOIN transactions t ON t.user_id = u.id
      WHERE u.email != $${paramIndex}
        ${filterConditions}
      GROUP BY DATE_TRUNC('week', u.created_at)
      ORDER BY signup_week DESC
      LIMIT 12
    `;

    const engagementResult = await pool.query(engagementQuery, filterParams);

    // Format results by week
    const activationByWeek: { [week: string]: any } = {};
    const engagementByWeek: { [week: string]: any } = {};

    activationResult.rows.forEach((row: any) => {
      const weekKey = `w/c ${new Date(row.signup_week).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      activationByWeek[weekKey] = {
        countStartingOnboarding: parseInt(row.count_starting_onboarding) || 0,
        countDropOffStep1: parseInt(row.count_drop_off_step_1) || 0,
        countDropOffStep2: parseInt(row.count_drop_off_step_2) || 0,
        countCompletedOnboarding: parseInt(row.count_completed_onboarding) || 0,
        avgTimeToOnboardDays: row.avg_time_to_onboard_days ? parseFloat(row.avg_time_to_onboard_days).toFixed(1) : null,
      };
    });

    engagementResult.rows.forEach((row: any) => {
      const weekKey = `w/c ${new Date(row.signup_week).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      engagementByWeek[weekKey] = {
        onboardingCompleted: parseInt(row.onboarding_completed) || 0,
        uploadedFirstStatement: parseInt(row.uploaded_first_statement) || 0,
        uploadedTwoStatements: parseInt(row.uploaded_two_statements) || 0,
        uploadedThreePlusStatements: parseInt(row.uploaded_three_plus_statements) || 0,
      };
    });

    return NextResponse.json({
      success: true,
      weeks,
      activation: activationByWeek,
      engagement: engagementByWeek,
      filters,
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Cohort Analysis] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cohort analysis', details: error.message },
      { status: 500 }
    );
  }
}

