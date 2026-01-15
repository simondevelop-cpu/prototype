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
    const filters: VanityFilters = {
      totalAccounts: url.searchParams.get('totalAccounts') === 'true',
      validatedEmails: url.searchParams.get('validatedEmails') === 'true',
      intentCategories: url.searchParams.get('intentCategories')?.split(',').filter(Boolean) || [],
      cohorts: url.searchParams.get('cohorts')?.split(',').filter(Boolean) || [],
      dataCoverage: url.searchParams.get('dataCoverage')?.split(',').filter(Boolean) || [],
    };

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

    // Note: totalAccounts = true means show all accounts (no filter)
    // totalAccounts = false means don't show anything (shouldn't happen, but handle it)
    // validatedEmails = true means only show validated emails
    if (filters.validatedEmails && hasEmailValidated) {
      filterConditions += ` AND u.email_validated = true`;
    }

    if (filters.intentCategories && filters.intentCategories.length > 0 && hasMotivation) {
      filterConditions += ` AND u.motivation = ANY($${paramIndex})`;
      filterParams.push(filters.intentCategories);
      paramIndex++;
    }

    // Filter by cohorts (signup weeks)
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
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          weekEnd.setHours(23, 59, 59, 999);
          return `(DATE_TRUNC('day', u.created_at) >= DATE_TRUNC('day', $${paramIndex + idx * 2}::timestamp) AND DATE_TRUNC('day', u.created_at) <= DATE_TRUNC('day', $${paramIndex + idx * 2 + 1}::timestamp))`;
        }).join(' OR ');
        filterConditions += ` AND (${dateConditions})`;
        cohortDates.forEach(date => {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          weekStart.setHours(0, 0, 0, 0);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          weekEnd.setHours(23, 59, 59, 999);
          filterParams.push(weekStart, weekEnd);
          paramIndex += 2;
        });
      }
    }

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
    const totalUsersCheck = await pool.query(`
      SELECT COUNT(*) as count
      FROM users u
      WHERE u.email != $1
        ${filterConditions}
    `, [ADMIN_EMAIL, ...filterParams.slice(1)]);
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
      // Note: If cohorts filter is applied, this will only count users from those cohorts
      const totalUsersQuery = `
        SELECT COUNT(*) as count
        FROM users u
        WHERE u.email != $${adminEmailParamIndex}
          AND DATE_TRUNC('day', u.created_at) <= DATE_TRUNC('day', $${paramIndex}::timestamp)
          ${filterConditions}
      `;
      const totalUsersResult = await pool.query(totalUsersQuery, [...filterParams, weekEnd]);
      let totalUsers = parseInt(totalUsersResult.rows[0]?.count) || 0;
      
      // Apply data coverage filter to total users if specified
      if (filters.dataCoverage && filters.dataCoverage.length > 0 && totalUsers > 0) {
        const usersWithCoverageQuery = `
          SELECT u.id, COUNT(DISTINCT t.id) as tx_count
          FROM users u
          LEFT JOIN transactions t ON t.user_id = u.id
          WHERE u.email != $${adminEmailParamIndex}
            AND DATE_TRUNC('day', u.created_at) <= DATE_TRUNC('day', $${paramIndex}::timestamp)
            ${filterConditions}
          GROUP BY u.id
        `;
        const usersWithCoverage = await pool.query(usersWithCoverageQuery, [...filterParams, weekEnd]);
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
              AND e.event_timestamp >= $${paramIndex}
              AND e.event_timestamp <= $${paramIndex + 1}
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
          AND DATE_TRUNC('day', u.created_at) >= DATE_TRUNC('day', $${paramIndex}::timestamp)
          AND DATE_TRUNC('day', u.created_at) <= DATE_TRUNC('day', $${paramIndex + 1}::timestamp)
          ${filterConditions}
      `;
      const newUsersResult = await pool.query(newUsersQuery, [...filterParams, weekStart, weekEnd]);
      let newUsers = parseInt(newUsersResult.rows[0]?.count) || 0;

      // Apply data coverage filter to new users if specified
      if (filters.dataCoverage && filters.dataCoverage.length > 0 && newUsers > 0) {
        const newUsersWithCoverageQuery = `
          SELECT u.id, COUNT(DISTINCT t.id) as tx_count
          FROM users u
          LEFT JOIN transactions t ON t.user_id = u.id
          WHERE u.email != $${adminEmailParamIndex}
            AND DATE_TRUNC('day', u.created_at) >= DATE_TRUNC('day', $${paramIndex}::timestamp)
            AND DATE_TRUNC('day', u.created_at) <= DATE_TRUNC('day', $${paramIndex + 1}::timestamp)
            ${filterConditions}
          GROUP BY u.id
        `;
        const newUsersWithCoverage = await pool.query(newUsersWithCoverageQuery, [...filterParams, weekStart, weekEnd]);
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
          AND t.created_at >= $${paramIndex}
          AND t.created_at <= $${paramIndex + 1}
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
            WHERE t.user_id = ANY($${paramIndex})
              AND t.created_at >= $${paramIndex + 1}
              AND t.created_at <= $${paramIndex + 2}
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
          AND t.created_at >= $${paramIndex}
          AND t.created_at <= $${paramIndex + 1}
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

    return NextResponse.json({
      success: true,
      weeks,
      metrics,
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
