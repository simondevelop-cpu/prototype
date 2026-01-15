/**
 * Vanity Metrics API
 * Returns weekly metrics (Total users, WAU, New users, Transactions, Unique banks)
 * Weekly from beginning of November to now
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

interface VanityFilters {
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
    // Use pipe delimiter for intent categories to avoid splitting on commas within values
    // The pipe character might be URL encoded as %7C, so decode it first
    const intentCategoriesParam = decodeURIComponent(url.searchParams.get('intentCategories') || '');
    let intentCategories: string[] = [];
    if (intentCategoriesParam) {
      // Try pipe delimiter first (new format) - check for both | and %7C
      const normalizedParam = intentCategoriesParam.replace(/%7C/g, '|');
      if (normalizedParam.includes('|')) {
        intentCategories = normalizedParam.split('|').map(s => s.trim()).filter(Boolean);
      } else {
        // Fallback to comma for backward compatibility, but this will break if values contain commas
        intentCategories = normalizedParam.split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    
    const filters: VanityFilters = {
      totalAccounts: url.searchParams.get('totalAccounts') === 'true',
      validatedEmails: url.searchParams.get('validatedEmails') === 'true',
      intentCategories,
      cohorts: url.searchParams.get('cohorts')?.split(',').filter(Boolean) || [],
      dataCoverage: url.searchParams.get('dataCoverage')?.split(',').filter(Boolean) || [],
    };
    
    console.log('[Vanity Metrics] Raw intentCategories param:', url.searchParams.get('intentCategories'));
    console.log('[Vanity Metrics] Decoded intentCategories param:', intentCategoriesParam);
    console.log('[Vanity Metrics] Parsed intentCategories:', intentCategories);

    // Check if users table has required columns (schema-adaptive)
    const schemaCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('email_validated', 'motivation')
    `);
    
    const hasEmailValidated = schemaCheck.rows.some(row => row.column_name === 'email_validated');
    const hasMotivation = schemaCheck.rows.some(row => row.column_name === 'motivation');

    // Build filter conditions
    let filterConditions = '';
    const filterParams: any[] = [];
    let paramIndex = 1;

    console.log('[Vanity Metrics] Received filters:', {
      totalAccounts: filters.totalAccounts,
      validatedEmails: filters.validatedEmails,
      intentCategories: filters.intentCategories,
      cohorts: filters.cohorts,
      dataCoverage: filters.dataCoverage,
      hasEmailValidated,
      hasMotivation
    });

    // Note: totalAccounts = true means show all accounts (no filter)
    // totalAccounts = false means don't show anything (shouldn't happen, but handle it)
    // validatedEmails = true means only show validated emails
    if (filters.validatedEmails && hasEmailValidated) {
      filterConditions += ` AND u.email_validated = true`;
      console.log('[Vanity Metrics] Applied validatedEmails filter');
    }

    if (filters.intentCategories && filters.intentCategories.length > 0 && hasMotivation) {
      filterConditions += ` AND u.motivation = ANY($${paramIndex}::text[])`;
      filterParams.push(filters.intentCategories);
      console.log('[Vanity Metrics] Applied intentCategories filter:', filters.intentCategories);
      paramIndex++;
    }

    // Note: Cohort filter in vanity metrics should NOT filter users in the WHERE clause
    // It should only control which week columns are displayed in the frontend
    // Users should be counted across all weeks, but only selected week columns are shown
    // So we don't add cohort filter to filterConditions here - it's handled in the weeks array filtering

    filterParams.push(ADMIN_EMAIL);
    const adminEmailParamIndex = paramIndex;
    paramIndex++;

    // Find the earliest user creation date to start from
    const earliestUserCheck = await pool.query(`
      SELECT MIN(created_at) as earliest_date
      FROM users
      WHERE email != $1
    `, [ADMIN_EMAIL]);
    
    const earliestDateStr = earliestUserCheck.rows[0]?.earliest_date;
    let weekStartDate: Date;
    
    if (earliestDateStr) {
      // Start from the earliest user's creation date (rounded to start of week)
      weekStartDate = new Date(earliestDateStr);
      // Round to start of week (Sunday)
      const dayOfWeek = weekStartDate.getDay();
      weekStartDate.setDate(weekStartDate.getDate() - dayOfWeek);
      weekStartDate.setHours(0, 0, 0, 0);
    } else {
      // Fallback: if no users, start from 12 weeks ago
      weekStartDate = new Date();
      weekStartDate.setDate(weekStartDate.getDate() - (12 * 7));
      weekStartDate.setDate(weekStartDate.getDate() - weekStartDate.getDay()); // Round to Sunday
      weekStartDate.setHours(0, 0, 0, 0);
    }

    // Calculate weeks from earliest user to current week
    const now = new Date();
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
    currentWeekStart.setHours(0, 0, 0, 0);

    // Calculate number of weeks
    const weeksDiff = Math.ceil((currentWeekStart.getTime() - weekStartDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const numWeeks = Math.max(1, weeksDiff + 1); // At least 1 week

    // Generate all possible weeks
    const allWeeks: string[] = [];
    for (let i = 0; i < numWeeks; i++) {
      const weekStart = new Date(weekStartDate);
      weekStart.setDate(weekStartDate.getDate() + (i * 7));
      const weekLabel = `w/c ${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      allWeeks.push(weekLabel);
    }
    
    // Filter weeks based on cohort filter (if specified)
    // If cohorts filter is empty, show all weeks
    const weeks = filters.cohorts && filters.cohorts.length > 0
      ? allWeeks.filter(week => filters.cohorts!.includes(week))
      : allWeeks;
    
    console.log('[Vanity Metrics] All weeks:', allWeeks);
    console.log('[Vanity Metrics] Filtered weeks:', weeks);
    console.log('[Vanity Metrics] Cohort filter:', filters.cohorts);

    // Get metrics for each week (only for weeks that should be displayed)
    const metrics: { [week: string]: any } = {};
    
    // Log total users before filtering for debugging
    // Build params array correctly - ADMIN_EMAIL is first, then filter params
    const totalUsersCheckParams = filterParams.length > 0 
      ? [ADMIN_EMAIL, ...filterParams] 
      : [ADMIN_EMAIL];
    const totalUsersCheck = await pool.query(`
      SELECT COUNT(*) as count
      FROM users u
      WHERE u.email != $1
        ${filterConditions}
    `, totalUsersCheckParams);
    console.log('[Vanity Metrics] Total users matching filters (excluding cohort):', parseInt(totalUsersCheck.rows[0]?.count) || 0);
    console.log('[Vanity Metrics] Filter conditions:', filterConditions);
    console.log('[Vanity Metrics] Filter params:', filterParams);

    for (let i = 0; i < numWeeks; i++) {
      const weekStart = new Date(weekStartDate);
      weekStart.setDate(weekStartDate.getDate() + (i * 7));
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      const weekKey = `w/c ${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;

      // Total users (cumulative up to end of week)
      // Use DATE_TRUNC to ensure we're comparing dates correctly
      // Note: Cohort filter does NOT filter users - it only controls which columns are displayed
      const totalUsersQuery = `
        SELECT COUNT(*) as count
        FROM users u
        WHERE u.email != $${adminEmailParamIndex}
          AND DATE_TRUNC('day', u.created_at) <= DATE_TRUNC('day', $${paramIndex}::date)
          ${filterConditions}
      `;
      const totalUsersResult = await pool.query(totalUsersQuery, [...filterParams, weekEnd.toISOString().split('T')[0]]);
      let totalUsers = parseInt(totalUsersResult.rows[0]?.count) || 0;
      
      if (i === 0) {
        console.log(`[Vanity Metrics] Week ${weekKey}: Total users before data coverage filter:`, totalUsers);
        console.log(`[Vanity Metrics] Week ${weekKey}: Filter conditions:`, filterConditions);
        console.log(`[Vanity Metrics] Week ${weekKey}: Filter params:`, filterParams);
      }
      
      // Apply data coverage filter to total users if specified
      if (filters.dataCoverage && filters.dataCoverage.length > 0 && totalUsers > 0) {
        const usersWithCoverageQuery = `
          SELECT u.id, COUNT(DISTINCT t.id) as tx_count
          FROM users u
          LEFT JOIN transactions t ON t.user_id = u.id
          WHERE u.email != $${adminEmailParamIndex}
            AND DATE_TRUNC('day', u.created_at) <= DATE_TRUNC('day', $${paramIndex}::date)
            ${filterConditions}
          GROUP BY u.id
        `;
        const usersWithCoverage = await pool.query(usersWithCoverageQuery, [...filterParams, weekEnd.toISOString().split('T')[0]]);
        totalUsers = usersWithCoverage.rows.filter((user: any) => {
          const txCount = parseInt(user.tx_count) || 0;
          if (filters.dataCoverage!.includes('1 upload') && txCount >= 1) return true;
          if (filters.dataCoverage!.includes('2 uploads') && txCount >= 2) return true;
          if (filters.dataCoverage!.includes('3+ uploads') && txCount >= 3) return true;
          return false;
        }).length;
      }

      // Weekly Active Users (users who logged in during the week)
      // Check if user_events table exists
      let wau = 0;
      try {
        const eventsCheck = await pool.query(`
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'user_events'
          LIMIT 1
        `);
        if (eventsCheck.rows.length > 0) {
          const wauQuery = `
            SELECT COUNT(DISTINCT e.user_id) as count
            FROM user_events e
            JOIN users u ON u.id = e.user_id
            WHERE e.event_type = 'login'
              AND e.event_timestamp >= $${paramIndex}::timestamp
              AND e.event_timestamp <= $${paramIndex + 1}::timestamp
              AND u.email != $${adminEmailParamIndex}
              ${filterConditions}
          `;
          const wauResult = await pool.query(wauQuery, [weekStart, weekEnd, ...filterParams]);
          wau = parseInt(wauResult.rows[0]?.count) || 0;
        }
      } catch (e) {
        // user_events table doesn't exist, WAU = 0
      }

      // New users per week - use DATE_TRUNC to ensure proper date comparison
      const newUsersQuery = `
        SELECT COUNT(*) as count
        FROM users u
        WHERE u.email != $${adminEmailParamIndex}
          AND DATE_TRUNC('day', u.created_at) >= DATE_TRUNC('day', $${paramIndex}::date)
          AND DATE_TRUNC('day', u.created_at) <= DATE_TRUNC('day', $${paramIndex + 1}::date)
          ${filterConditions}
      `;
      const newUsersResult = await pool.query(newUsersQuery, [...filterParams, weekStart.toISOString().split('T')[0], weekEnd.toISOString().split('T')[0]]);
      let newUsers = parseInt(newUsersResult.rows[0]?.count) || 0;

      // Apply data coverage filter to new users if specified
      if (filters.dataCoverage && filters.dataCoverage.length > 0 && newUsers > 0) {
        const newUsersWithCoverageQuery = `
          SELECT u.id, COUNT(DISTINCT t.id) as tx_count
          FROM users u
          LEFT JOIN transactions t ON t.user_id = u.id
          WHERE u.email != $${adminEmailParamIndex}
            AND DATE_TRUNC('day', u.created_at) >= DATE_TRUNC('day', $${paramIndex}::date)
            AND DATE_TRUNC('day', u.created_at) <= DATE_TRUNC('day', $${paramIndex + 1}::date)
            ${filterConditions}
          GROUP BY u.id
        `;
        const newUsersWithCoverage = await pool.query(newUsersWithCoverageQuery, [...filterParams, weekStart.toISOString().split('T')[0], weekEnd.toISOString().split('T')[0]]);
        newUsers = newUsersWithCoverage.rows.filter((user: any) => {
          const txCount = parseInt(user.tx_count) || 0;
          if (filters.dataCoverage!.includes('1 upload') && txCount >= 1) return true;
          if (filters.dataCoverage!.includes('2 uploads') && txCount >= 2) return true;
          if (filters.dataCoverage!.includes('3+ uploads') && txCount >= 3) return true;
          return false;
        }).length;
      }

      // Total transactions uploaded (in the week) - apply data coverage filter if specified
      let transactionsQuery = `
        SELECT COUNT(*) as count
        FROM transactions t
        JOIN users u ON u.id = t.user_id
        WHERE u.email != $${adminEmailParamIndex}
          AND t.created_at >= $${paramIndex}::timestamp
          AND t.created_at <= $${paramIndex + 1}::timestamp
          ${filterConditions}
      `;
      let totalTransactions = 0;
      
      if (filters.dataCoverage && filters.dataCoverage.length > 0) {
        // Get users matching data coverage criteria
        const usersWithCoverageQuery = `
          SELECT DISTINCT u.id
          FROM users u
          LEFT JOIN transactions t2 ON t2.user_id = u.id
          WHERE u.email != $${adminEmailParamIndex}
            ${filterConditions}
          GROUP BY u.id
          HAVING 
            ${filters.dataCoverage.includes('1 upload') ? 'COUNT(DISTINCT t2.id) >= 1' : 'false'}
            ${filters.dataCoverage.includes('2 uploads') ? 'OR COUNT(DISTINCT t2.id) >= 2' : ''}
            ${filters.dataCoverage.includes('3+ uploads') ? 'OR COUNT(DISTINCT t2.id) >= 3' : ''}
        `;
        const usersWithCoverage = await pool.query(usersWithCoverageQuery, filterParams);
        const userIds = usersWithCoverage.rows.map((r: any) => r.id);
        if (userIds.length > 0) {
          const filteredTransactionsQuery = `
            SELECT COUNT(*) as count
            FROM transactions t
            WHERE t.user_id = ANY($1::int[])
              AND t.created_at >= $2::timestamp
              AND t.created_at <= $3::timestamp
          `;
          const filteredResult = await pool.query(filteredTransactionsQuery, [userIds, weekStart, weekEnd]);
          totalTransactions = parseInt(filteredResult.rows[0]?.count) || 0;
        }
      } else {
        const transactionsResult = await pool.query(transactionsQuery, [...filterParams, weekStart, weekEnd]);
        totalTransactions = parseInt(transactionsResult.rows[0]?.count) || 0;
      }

      // Total unique banks uploaded (in the week)
      const banksQuery = `
        SELECT COUNT(DISTINCT t.account) as count
        FROM transactions t
        JOIN users u ON u.id = t.user_id
        WHERE u.email != $${adminEmailParamIndex}
          AND t.created_at >= $${paramIndex}::timestamp
          AND t.created_at <= $${paramIndex + 1}::timestamp
          AND t.account IS NOT NULL
          ${filterConditions}
      `;
      const banksResult = await pool.query(banksQuery, [...filterParams, weekStart, weekEnd]);
      const uniqueBanks = parseInt(banksResult.rows[0]?.count) || 0;

      metrics[weekKey] = {
        totalUsers,
        weeklyActiveUsers: wau,
        newUsers,
        totalTransactionsUploaded: totalTransactions,
        totalUniqueBanksUploaded: uniqueBanks,
      };
    }

    // Only return metrics for weeks that should be displayed
    const filteredMetrics: { [week: string]: any } = {};
    weeks.forEach(week => {
      if (metrics[week]) {
        filteredMetrics[week] = metrics[week];
      }
    });
    
    console.log('[Vanity Metrics] Returning', Object.keys(filteredMetrics).length, 'weeks of metrics');
    console.log('[Vanity Metrics] Sample metric (first week):', filteredMetrics[weeks[0]]);
    
    return NextResponse.json({
      success: true,
      weeks,
      metrics: filteredMetrics,
      filters,
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Vanity Metrics] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vanity metrics', details: error.message },
      { status: 500 }
    );
  }
}
