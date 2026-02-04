/**
 * Cohort Analysis API
 * Returns activation and engagement metrics by signup week
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

interface CohortFilters {
  totalAccounts?: boolean;
  validatedEmails?: boolean;
  intentCategories?: string[];
  cohorts?: string[];
  dataCoverage?: string[];
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
      intentCategories: url.searchParams.get('intentCategories')?.split('|').filter(Boolean) || [],
      cohorts: url.searchParams.get('cohorts')?.split(',').filter(Boolean) || [],
      dataCoverage: url.searchParams.get('dataCoverage')?.split(',').filter(Boolean) || [],
    };

    // Check if l1_user_permissions and l0_pii_users exist (post-migration)
    const permissionsTableCheck = await pool.query(`
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'l1_user_permissions'
      LIMIT 1
    `);
    const piiTableCheck = await pool.query(`
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'l0_pii_users'
      LIMIT 1
    `);
    
    if (permissionsTableCheck.rows.length === 0 || piiTableCheck.rows.length === 0) {
      return NextResponse.json({
        success: true,
        activation: {},
        engagement: {},
        weeks: [],
        message: 'Migration not complete. l1_user_permissions and l0_pii_users tables required.'
      }, { status: 200 });
    }
    
    // Check if email_validated column exists in l1_user_permissions
    const emailValidatedCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'l1_user_permissions' 
      AND column_name = 'email_validated'
    `);
    const hasEmailValidated = emailValidatedCheck.rows.length > 0;
    
    // Check if onboarding_responses table exists and get the correct table name
    const onboardingTableCheck = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_name IN ('onboarding_responses', 'l1_onboarding_responses')
      LIMIT 1
    `);
    const onboardingResponsesExists = onboardingTableCheck.rows.length > 0;
    const onboardingTableName = onboardingResponsesExists ? onboardingTableCheck.rows[0].table_name : null;

    // Build filter conditions
    let filterConditions = '';
    const filterParams: any[] = [];
    let paramIndex = 1;

    if (filters.validatedEmails && hasEmailValidated) {
      filterConditions += ` AND perm.email_validated = true`;
    }

    if (filters.intentCategories && filters.intentCategories.length > 0 && onboardingResponsesExists) {
      // Intent categories come from onboarding_responses.motivation
      filterConditions += ` AND EXISTS (
        SELECT 1 FROM onboarding_responses o 
        WHERE o.user_id = perm.id 
        AND o.motivation = ANY($${paramIndex}::text[])
      )`;
      filterParams.push(filters.intentCategories);
      paramIndex++;
    }

    // Filter by cohorts (signup weeks) - only filter users if cohorts are specified
    if (filters.cohorts && filters.cohorts.length > 0) {
      const cohortDates = filters.cohorts.map(cohort => {
        const match = cohort.match(/w\/c (\d+) (\w+) (\d+)/);
        if (match) {
          const day = parseInt(match[1]);
          const monthName = match[2];
          const year = parseInt(match[3]);
          const monthMap: { [key: string]: number } = {
            'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
            'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
          };
          const month = monthMap[monthName] ?? 0;
          return new Date(year, month, day);
        }
        return null;
      }).filter(Boolean) as Date[];
      
      if (cohortDates.length > 0) {
        const dateConditions = cohortDates.map((date, idx) => {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          weekStart.setHours(0, 0, 0, 0);
          return `(DATE_TRUNC('week', perm.created_at) = DATE_TRUNC('week', $${paramIndex + idx}::timestamp))`;
        }).join(' OR ');
        filterConditions += ` AND (${dateConditions})`;
        cohortDates.forEach(date => {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          weekStart.setHours(0, 0, 0, 0);
          filterParams.push(weekStart);
          paramIndex++;
        });
      }
    }

    // Get activation metrics (onboarding steps) - from l1_user_permissions and onboarding_responses
    // Track all steps: 1=Emotional Calibration, 2=Financial Context, 3=Motivation, 4=Acquisition Source, 5=Insight Preferences, 6=Email Verification, 7=Account Profile
    const activationQuery = onboardingResponsesExists ? `
      SELECT 
        DATE_TRUNC('week', perm.created_at) as signup_week,
        COUNT(*) FILTER (WHERE perm.created_at IS NOT NULL) as count_starting_onboarding,
        COUNT(*) FILTER (WHERE o.last_step = 1 AND o.completed_at IS NULL) as count_drop_off_step_1,
        COUNT(*) FILTER (WHERE o.last_step = 2 AND o.completed_at IS NULL) as count_drop_off_step_2,
        COUNT(*) FILTER (WHERE o.last_step = 3 AND o.completed_at IS NULL) as count_drop_off_step_3,
        COUNT(*) FILTER (WHERE o.last_step = 4 AND o.completed_at IS NULL) as count_drop_off_step_4,
        COUNT(*) FILTER (WHERE o.last_step = 5 AND o.completed_at IS NULL) as count_drop_off_step_5,
        COUNT(*) FILTER (WHERE o.last_step = 6 AND o.completed_at IS NULL) as count_drop_off_step_6,
        COUNT(*) FILTER (WHERE o.last_step = 7 AND o.completed_at IS NULL) as count_drop_off_step_7,
        COUNT(*) FILTER (WHERE o.completed_at IS NOT NULL) as count_completed_onboarding,
        AVG(EXTRACT(EPOCH FROM (o.completed_at - perm.created_at)) / 86400) FILTER (WHERE o.completed_at IS NOT NULL) as avg_time_to_onboard_days
      FROM l1_user_permissions perm
      JOIN l0_pii_users pii ON perm.id = pii.internal_user_id
      ${onboardingTableName ? `LEFT JOIN ${onboardingTableName} o ON perm.id = o.user_id` : ''}
      WHERE pii.email != $${paramIndex}
        ${filterConditions}
      GROUP BY DATE_TRUNC('week', perm.created_at)
      ORDER BY signup_week DESC
      LIMIT 12
    ` : `
      SELECT 
        DATE_TRUNC('week', perm.created_at) as signup_week,
        COUNT(*) as count_starting_onboarding,
        0 as count_drop_off_step_1,
        0 as count_drop_off_step_2,
        0 as count_drop_off_step_3,
        0 as count_drop_off_step_4,
        0 as count_drop_off_step_5,
        0 as count_drop_off_step_6,
        0 as count_drop_off_step_7,
        ${onboardingTableName ? `COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM ${onboardingTableName} o 
          WHERE o.user_id = perm.id AND o.completed_at IS NOT NULL
        ))` : '0'} as count_completed_onboarding,
        NULL as avg_time_to_onboard_days
      FROM l1_user_permissions perm
      JOIN l0_pii_users pii ON perm.id = pii.internal_user_id
      WHERE pii.email != $${paramIndex}
        ${filterConditions}
      GROUP BY DATE_TRUNC('week', perm.created_at)
      ORDER BY signup_week DESC
      LIMIT 12
    `;

    filterParams.push(ADMIN_EMAIL);
    
    // Helper function to format week consistently (adjust PostgreSQL Monday-start to Sunday-start for display)
    const formatWeekLabel = (weekDate: any): string => {
      if (!weekDate) return '';
      const weekStart = new Date(weekDate);
      const dayOfWeek = weekStart.getDay();
      const adjustedWeekStart = new Date(weekStart);
      if (dayOfWeek !== 0) {
        adjustedWeekStart.setDate(weekStart.getDate() - dayOfWeek);
      }
      adjustedWeekStart.setHours(0, 0, 0, 0);
      return `w/c ${adjustedWeekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    };
    
    // Execute activation query to get actual signup weeks from data
    const activationResult = await pool.query(activationQuery, filterParams);
    
    // Extract weeks from activation query results
    const weeksSet = new Set<string>();
    activationResult.rows.forEach((row: any) => {
      if (row.signup_week) {
        weeksSet.add(formatWeekLabel(row.signup_week));
      }
    });
    
    // Sort weeks (most recent first) and ensure unique
    const weeks = Array.from(weeksSet).sort((a, b) => {
      // Parse dates more carefully - handle format "DD MMM YYYY" (e.g., "20 Oct 2025")
      const parseDate = (str: string) => {
        const parts = str.replace('w/c ', '').trim().split(' ');
        if (parts.length === 3) {
          const months: { [key: string]: number } = {
            'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
            'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
          };
          const day = parseInt(parts[0]);
          const month = months[parts[1]] ?? 0;
          const year = parseInt(parts[2]);
          return new Date(year, month, day);
        }
        // Fallback to standard date parsing
        return new Date(str.replace('w/c ', ''));
      };
      try {
        const dateA = parseDate(a);
        const dateB = parseDate(b);
        return dateB.getTime() - dateA.getTime();
      } catch (e) {
        // Fallback to string comparison if parsing fails
        return b.localeCompare(a);
      }
    });
    
    // If no weeks from data, fall back to last 12 weeks
    if (weeks.length === 0) {
      const now = new Date();
      const currentWeekStart = new Date(now);
      currentWeekStart.setDate(now.getDate() - now.getDay());
      currentWeekStart.setHours(0, 0, 0, 0);
      
      for (let i = 11; i >= 0; i--) {
        const weekStart = new Date(currentWeekStart);
        weekStart.setDate(currentWeekStart.getDate() - (i * 7));
        const weekLabel = `w/c ${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
        weeks.push(weekLabel);
      }
    }

    // Get engagement metrics
    // Using l1_event_facts as the single source of truth

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

    // Enhanced Engagement query - Single source of truth (l1_transaction_facts only)
    // Build upload_counts subquery - use statement_upload events from l1_event_facts (upload_session_id not in l1_transaction_facts)
    const uploadCountsSubquery = `
      SELECT 
        ut.internal_user_id as user_id,
        COUNT(DISTINCT tf.id) as upload_count
      FROM l1_user_permissions perm
      LEFT JOIN l0_user_tokenization ut ON perm.id = ut.internal_user_id
      LEFT JOIN l1_transaction_facts tf ON ut.tokenized_user_id = tf.tokenized_user_id
      WHERE tf.id IS NOT NULL
      GROUP BY ut.internal_user_id
    `;
    
    // Build unique banks subquery - extract bank name from account field
    // Account field format: "RBC Credit Card", "TD Chequing", "Scotiabank Savings", etc.
    const uniqueBanksSubquery = `
      SELECT 
        ut.internal_user_id as user_id,
        COUNT(DISTINCT 
          CASE 
            WHEN tf.account IS NOT NULL THEN
              CASE 
                WHEN tf.account ILIKE 'RBC%' THEN 'RBC'
                WHEN tf.account ILIKE 'TD%' OR tf.account ILIKE 'Toronto-Dominion%' THEN 'TD'
                WHEN tf.account ILIKE 'Scotiabank%' OR tf.account ILIKE 'Bank of Nova Scotia%' THEN 'Scotiabank'
                WHEN tf.account ILIKE 'BMO%' OR tf.account ILIKE 'Bank of Montreal%' THEN 'BMO'
                WHEN tf.account ILIKE 'CIBC%' OR tf.account ILIKE 'Canadian Imperial%' THEN 'CIBC'
                WHEN tf.account ILIKE 'Tangerine%' OR tf.account ILIKE 'ING Direct%' THEN 'Tangerine'
                ELSE NULL
              END
            ELSE NULL
          END
        ) as unique_bank_count
      FROM l1_user_permissions perm
      LEFT JOIN l0_user_tokenization ut ON perm.id = ut.internal_user_id
      LEFT JOIN l1_transaction_facts tf ON ut.tokenized_user_id = tf.tokenized_user_id
      WHERE tf.account IS NOT NULL
      GROUP BY ut.internal_user_id
    `;
    
    const engagementQuery = onboardingResponsesExists ? `
      SELECT 
        DATE_TRUNC('week', perm.created_at) as signup_week,
        -- Onboarding and data coverage
        COUNT(DISTINCT perm.id) FILTER (WHERE o.completed_at IS NOT NULL) as onboarding_completed,
        COUNT(DISTINCT CASE WHEN tf.id IS NOT NULL THEN perm.id END) as uploaded_first_statement,
        COUNT(DISTINCT CASE WHEN upload_counts.upload_count >= 2 THEN upload_counts.user_id END) as uploaded_two_statements,
        COUNT(DISTINCT CASE WHEN upload_counts.upload_count >= 3 THEN upload_counts.user_id END) as uploaded_three_plus_statements,
        -- Unique banks metrics
        COUNT(DISTINCT CASE WHEN bank_counts.unique_bank_count >= 2 THEN perm.id END) as uploaded_more_than_one_bank,
        COUNT(DISTINCT CASE WHEN bank_counts.unique_bank_count >= 3 THEN perm.id END) as uploaded_more_than_two_banks,
        -- Time to achieve (in days) - excluding NULLs
        AVG(EXTRACT(EPOCH FROM (o.completed_at - perm.created_at)) / 86400) FILTER (WHERE o.completed_at IS NOT NULL) as avg_time_to_onboard_days,
        -- First upload metrics split by first day vs after first day
        -- "First day" means the same calendar day (DATE() comparison)
        COUNT(DISTINCT CASE WHEN first_upload.first_transaction_date IS NOT NULL AND DATE(first_upload.first_transaction_date) = DATE(perm.created_at) THEN perm.id END) as users_uploaded_first_day,
        -- For first day uploads, calculate time in minutes directly (not days) since it's always < 24 hours
        AVG(EXTRACT(EPOCH FROM (first_upload.first_transaction_date - perm.created_at)) / 60) FILTER (WHERE first_upload.first_transaction_date IS NOT NULL AND DATE(first_upload.first_transaction_date) = DATE(perm.created_at)) as avg_time_to_first_upload_first_day_minutes,
        COUNT(DISTINCT CASE WHEN first_upload.first_transaction_date IS NOT NULL AND DATE(first_upload.first_transaction_date) > DATE(perm.created_at) THEN perm.id END) as users_uploaded_after_first_day,
        AVG(EXTRACT(EPOCH FROM (first_upload.first_transaction_date - perm.created_at)) / 86400) FILTER (WHERE first_upload.first_transaction_date IS NOT NULL AND DATE(first_upload.first_transaction_date) > DATE(perm.created_at)) as avg_time_to_first_upload_after_first_day_days,
        -- Engagement signals
        AVG(transaction_counts.tx_count) FILTER (WHERE transaction_counts.tx_count > 0) as avg_transactions_per_user,
        COUNT(DISTINCT CASE WHEN transaction_counts.tx_count > 0 THEN perm.id END) as users_with_transactions
      FROM l1_user_permissions perm
      JOIN l0_pii_users pii ON perm.id = pii.internal_user_id
      ${onboardingTableName ? `LEFT JOIN ${onboardingTableName} o ON perm.id = o.user_id` : ''}
      LEFT JOIN l0_user_tokenization ut ON perm.id = ut.internal_user_id
      LEFT JOIN l1_transaction_facts tf ON ut.tokenized_user_id = tf.tokenized_user_id
      LEFT JOIN (
        ${uploadCountsSubquery}
      ) upload_counts ON upload_counts.user_id = perm.id
      LEFT JOIN (
        ${uniqueBanksSubquery}
      ) bank_counts ON bank_counts.user_id = perm.id
      LEFT JOIN (
        SELECT 
          ut.internal_user_id as user_id,
          MIN(tf.created_at) as first_transaction_date
        FROM l1_user_permissions perm2
        LEFT JOIN l0_user_tokenization ut ON perm2.id = ut.internal_user_id
        LEFT JOIN l1_transaction_facts tf ON ut.tokenized_user_id = tf.tokenized_user_id
        WHERE tf.id IS NOT NULL
        GROUP BY ut.internal_user_id
      ) first_upload ON first_upload.user_id = perm.id
      LEFT JOIN (
        SELECT 
          ut.internal_user_id as user_id,
          COUNT(*) as tx_count
        FROM l1_user_permissions perm2
        LEFT JOIN l0_user_tokenization ut ON perm2.id = ut.internal_user_id
        LEFT JOIN l1_transaction_facts tf ON ut.tokenized_user_id = tf.tokenized_user_id
        WHERE tf.id IS NOT NULL
        GROUP BY ut.internal_user_id
      ) transaction_counts ON transaction_counts.user_id = perm.id
      WHERE pii.email != $${paramIndex}
        ${filterConditions}
      GROUP BY DATE_TRUNC('week', perm.created_at)
      ORDER BY signup_week DESC
      LIMIT 12
    ` : `
      SELECT 
        DATE_TRUNC('week', perm.created_at) as signup_week,
        ${onboardingTableName ? `COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM ${onboardingTableName} o 
          WHERE o.user_id = perm.id AND o.completed_at IS NOT NULL
        ))` : '0'} as onboarding_completed,
        COUNT(DISTINCT CASE WHEN tf.id IS NOT NULL THEN perm.id END) as uploaded_first_statement,
        0 as uploaded_two_statements,
        0 as uploaded_three_plus_statements,
        0 as uploaded_more_than_one_bank,
        0 as uploaded_more_than_two_banks,
        NULL as avg_time_to_onboard_days,
        NULL as avg_time_to_first_upload_days,
        NULL as avg_transactions_per_user,
        0 as users_with_transactions
      FROM l1_user_permissions perm
      JOIN l0_pii_users pii ON perm.id = pii.internal_user_id
      LEFT JOIN l0_user_tokenization ut ON perm.id = ut.internal_user_id
      LEFT JOIN l1_transaction_facts tf ON ut.tokenized_user_id = tf.tokenized_user_id
      WHERE pii.email != $${paramIndex}
        ${filterConditions}
      GROUP BY DATE_TRUNC('week', perm.created_at)
      ORDER BY signup_week DESC
      LIMIT 12
    `;

    // Use l1_event_facts for engagement metrics
    const eventsTable = 'l1_event_facts';

    // Execute engagement query and extract weeks
    let engagementResult;
    try {
      engagementResult = await pool.query(engagementQuery, filterParams);
      
      // Extract weeks from engagement query results
      engagementResult.rows.forEach((row: any) => {
        if (row.signup_week) {
          weeksSet.add(formatWeekLabel(row.signup_week));
        }
      });
    } catch (error: any) {
      console.error('[Cohort Analysis] Error fetching engagement data:', error);
      engagementResult = { rows: [] };
    }

    // Get l1_event_facts data for engagement metrics
    let userEventsData: any = {};
    try {
      // Calculate login metrics per week
      const eventsQuery = `
        SELECT 
          DATE_TRUNC('week', perm.created_at) as signup_week,
          COUNT(DISTINCT CASE 
            WHEN ue.event_timestamp >= perm.created_at 
            AND ue.event_timestamp < perm.created_at + INTERVAL '7 days'
            AND ue.event_type = 'login' 
            THEN DATE(ue.event_timestamp) 
          END) as unique_login_days_week_0,
          COUNT(DISTINCT CASE 
            WHEN ue.event_timestamp >= perm.created_at + INTERVAL '7 days'
            AND ue.event_timestamp < perm.created_at + INTERVAL '14 days'
            AND ue.event_type = 'login' 
            THEN DATE(ue.event_timestamp) 
          END) as unique_login_days_week_1
        FROM l1_user_permissions perm
        JOIN l0_pii_users pii ON perm.id = pii.internal_user_id
        LEFT JOIN l0_user_tokenization ut ON perm.id = ut.internal_user_id
        LEFT JOIN l1_event_facts ue ON ue.tokenized_user_id = ut.tokenized_user_id
        WHERE pii.email != $${paramIndex}
          ${filterConditions}
        GROUP BY DATE_TRUNC('week', perm.created_at)
      `;
      const eventsResult = await pool.query(eventsQuery, filterParams);
        
      eventsResult.rows.forEach((row: any) => {
        const weekKey = `w/c ${new Date(row.signup_week).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
        if (!userEventsData[weekKey]) {
          userEventsData[weekKey] = {};
        }
      });
    } catch (e) {
      // Could not fetch l1_event_facts data
      console.error('[Cohort Analysis] Error fetching engagement data:', e);
    }

    // Format results by week
    const activationByWeek: { [week: string]: any } = {};
    const engagementByWeek: { [week: string]: any } = {};

    activationResult.rows.forEach((row: any) => {
      const weekKey = formatWeekLabel(row.signup_week);
      const starting = parseInt(row.count_starting_onboarding) || 0;
      const completed = parseInt(row.count_completed_onboarding) || 0;
      const dropOffs = 
        (parseInt(row.count_drop_off_step_1) || 0) +
        (parseInt(row.count_drop_off_step_2) || 0) +
        (parseInt(row.count_drop_off_step_3) || 0) +
        (parseInt(row.count_drop_off_step_4) || 0) +
        (parseInt(row.count_drop_off_step_5) || 0) +
        (parseInt(row.count_drop_off_step_6) || 0) +
        (parseInt(row.count_drop_off_step_7) || 0);
      // Calculate users who started but didn't complete and weren't caught by drop-off tracking
      const startedButNotCompleted = Math.max(0, starting - completed - dropOffs);
      
      activationByWeek[weekKey] = {
        countStartingOnboarding: starting,
        countDropOffStep1: parseInt(row.count_drop_off_step_1) || 0,
        countDropOffStep2: parseInt(row.count_drop_off_step_2) || 0,
        countDropOffStep3: parseInt(row.count_drop_off_step_3) || 0,
        countDropOffStep4: parseInt(row.count_drop_off_step_4) || 0,
        countDropOffStep5: parseInt(row.count_drop_off_step_5) || 0,
        countDropOffStep6: parseInt(row.count_drop_off_step_6) || 0,
        countDropOffStep7: parseInt(row.count_drop_off_step_7) || 0,
        countCompletedOnboarding: completed,
        countStartedButNotCompleted: startedButNotCompleted,
        // Convert days to minutes (multiply by 1440 minutes per day)
        avgTimeToOnboardMinutes: row.avg_time_to_onboard_days ? Math.round(parseFloat(row.avg_time_to_onboard_days) * 1440) : null,
      };
    });

    engagementResult.rows.forEach((row: any) => {
      const weekKey = formatWeekLabel(row.signup_week);
      engagementByWeek[weekKey] = {
        // Onboarding and data coverage
        onboardingCompleted: parseInt(row.onboarding_completed) || 0,
        uploadedFirstStatement: parseInt(row.uploaded_first_statement) || 0,
        uploadedTwoStatements: parseInt(row.uploaded_two_statements) || 0,
        uploadedThreePlusStatements: parseInt(row.uploaded_three_plus_statements) || 0,
        // Unique banks metrics
        uploadedMoreThanOneBank: parseInt(row.uploaded_more_than_one_bank) || 0,
        uploadedMoreThanTwoBanks: parseInt(row.uploaded_more_than_two_banks) || 0,
        // Time to achieve (in minutes - converted from days)
        avgTimeToOnboardMinutes: row.avg_time_to_onboard_days ? Math.round(parseFloat(row.avg_time_to_onboard_days) * 1440) : null,
        // First upload metrics split by first day vs after first day
        usersUploadedFirstDay: parseInt(row.users_uploaded_first_day) || 0,
        avgTimeToFirstUploadFirstDayMinutes: row.avg_time_to_first_upload_first_day_minutes ? Math.round(parseFloat(row.avg_time_to_first_upload_first_day_minutes)) : null,
        usersUploadedAfterFirstDay: parseInt(row.users_uploaded_after_first_day) || 0,
        avgTimeToFirstUploadAfterFirstDayDays: row.avg_time_to_first_upload_after_first_day_days ? parseFloat(row.avg_time_to_first_upload_after_first_day_days).toFixed(1) : null,
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
      hasUserEventsTable: true, // l1_event_facts is always used now
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Cohort Analysis] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cohort analysis', details: error.message },
      { status: 500 }
    );
  }
}

