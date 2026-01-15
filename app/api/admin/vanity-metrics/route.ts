/**
 * Vanity Metrics API
 * Returns weekly metrics (Total users, WAU, New users, Transactions, Unique banks)
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';

export const dynamic = 'force-dynamic';

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
    // URLSearchParams.get() automatically decodes %7C to |, so we can check for | directly
    const intentCategoriesParam = url.searchParams.get('intentCategories') || '';
    let intentCategories: string[] = [];
    if (intentCategoriesParam) {
      // Check if it contains pipe delimiter (new format)
      // URLSearchParams.get() already decodes %7C to |
      if (intentCategoriesParam.includes('|')) {
        intentCategories = intentCategoriesParam.split('|').map(s => s.trim()).filter(Boolean);
      } else {
        // No pipe delimiter - could be:
        // 1. Single value (might contain commas)
        // 2. Multiple values separated by commas (old format)
        // If it contains parentheses and commas, it's likely a single value that was incorrectly sent
        // We'll check the database to see if this exact string matches any motivation value
        if (intentCategoriesParam.includes('(') && intentCategoriesParam.includes(',')) {
          intentCategories = [intentCategoriesParam.trim()].filter(Boolean);
        } else if (intentCategoriesParam.includes(',')) {
          intentCategories = intentCategoriesParam.split(',').map(s => s.trim()).filter(Boolean);
        } else {
          intentCategories = [intentCategoriesParam.trim()].filter(Boolean);
        }
      }
    }
    
    const filters: VanityFilters = {
      totalAccounts: url.searchParams.get('totalAccounts') === 'true',
      validatedEmails: url.searchParams.get('validatedEmails') === 'true',
      intentCategories,
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

    if (filters.validatedEmails && hasEmailValidated) {
      filterConditions += ` AND u.email_validated = true`;
    }

    if (filters.intentCategories && filters.intentCategories.length > 0 && hasMotivation) {
      filterConditions += ` AND u.motivation = ANY($${paramIndex}::text[])`;
      filterParams.push(filters.intentCategories);
      paramIndex++;
    }

    // Cohort filter only controls which week columns are displayed, not which users are counted

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

    // Get metrics for each week (only for weeks that should be displayed)
    const metrics: { [week: string]: any } = {};

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

      // New transactions uploaded (in the week) - apply data coverage filter if specified
      // filterParams length tells us how many params are already in the array
      // weekStart and weekEnd will be at positions filterParams.length and filterParams.length+1
      const newTransactionsParamIndex = filterParams.length;
      let newTransactionsQuery = `
        SELECT COUNT(*) as count
        FROM transactions t
        JOIN users u ON u.id = t.user_id
        WHERE u.email != $${adminEmailParamIndex}
          AND t.created_at >= $${newTransactionsParamIndex + 1}::timestamp
          AND t.created_at <= $${newTransactionsParamIndex + 2}::timestamp
          ${filterConditions}
      `;
      let newTransactions = 0;
      
      // Total transactions uploaded (cumulative up to end of week) - apply data coverage filter if specified
      // weekEnd will be at position filterParams.length
      const totalTransactionsParamIndex = filterParams.length;
      let totalTransactionsQuery = `
        SELECT COUNT(*) as count
        FROM transactions t
        JOIN users u ON u.id = t.user_id
        WHERE u.email != $${adminEmailParamIndex}
          AND t.created_at <= $${totalTransactionsParamIndex + 1}::timestamp
          ${filterConditions}
      `;
      let totalTransactions = 0;
      
      // Calculate new transactions (in the week)
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
          const filteredNewTransactionsQuery = `
            SELECT COUNT(*) as count
            FROM transactions t
            WHERE t.user_id = ANY($1::int[])
              AND t.created_at >= $2::timestamp
              AND t.created_at <= $3::timestamp
          `;
          const filteredResult = await pool.query(filteredNewTransactionsQuery, [userIds, weekStart.toISOString(), weekEnd.toISOString()]);
          newTransactions = parseInt(filteredResult.rows[0]?.count) || 0;
        }
      } else {
        // filterParams already includes ADMIN_EMAIL and any filter params
        // weekStart and weekEnd will be at positions paramIndex and paramIndex+1
        const newTransactionsParams = [...filterParams, weekStart.toISOString(), weekEnd.toISOString()];
        const newTransactionsResult = await pool.query(newTransactionsQuery, newTransactionsParams);
        newTransactions = parseInt(newTransactionsResult.rows[0]?.count) || 0;
      }
      
      // Calculate total transactions (cumulative)
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
          const filteredTotalTransactionsQuery = `
            SELECT COUNT(*) as count
            FROM transactions t
            WHERE t.user_id = ANY($1::int[])
              AND t.created_at <= $2::timestamp
          `;
          const filteredResult = await pool.query(filteredTotalTransactionsQuery, [userIds, weekEnd.toISOString()]);
          totalTransactions = parseInt(filteredResult.rows[0]?.count) || 0;
        }
      } else {
        const totalTransactionsParams = [...filterParams, weekEnd.toISOString()];
        const totalTransactionsResult = await pool.query(totalTransactionsQuery, totalTransactionsParams);
        totalTransactions = parseInt(totalTransactionsResult.rows[0]?.count) || 0;
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

      // Monthly Active Users (MAU) - users who logged in during the month containing this week
      let mau = 0;
      try {
        const eventsCheck = await pool.query(`
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'user_events'
          LIMIT 1
        `);
        if (eventsCheck.rows.length > 0) {
          // Get the month start and end for this week
          const monthStart = new Date(weekStart);
          monthStart.setDate(1);
          monthStart.setHours(0, 0, 0, 0);
          const monthEnd = new Date(monthStart);
          monthEnd.setMonth(monthEnd.getMonth() + 1);
          monthEnd.setDate(0); // Last day of month
          monthEnd.setHours(23, 59, 59, 999);
          
          const mauQuery = `
            SELECT COUNT(DISTINCT e.user_id) as count
            FROM user_events e
            JOIN users u ON u.id = e.user_id
            WHERE e.event_type = 'login'
              AND e.event_timestamp >= $${paramIndex}::timestamp
              AND e.event_timestamp <= $${paramIndex + 1}::timestamp
              AND u.email != $${adminEmailParamIndex}
              ${filterConditions}
          `;
          const mauResult = await pool.query(mauQuery, [monthStart, monthEnd, ...filterParams]);
          mau = parseInt(mauResult.rows[0]?.count) || 0;
        }
      } catch (e) {
        // user_events table doesn't exist, MAU = 0
      }

      // New users per month - users who signed up in the month containing this week
      const monthStart = new Date(weekStart);
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      monthEnd.setDate(0); // Last day of month
      monthEnd.setHours(23, 59, 59, 999);
      
      const newUsersPerMonthQuery = `
        SELECT COUNT(*) as count
        FROM users u
        WHERE u.email != $${adminEmailParamIndex}
          AND DATE_TRUNC('day', u.created_at) >= DATE_TRUNC('day', $${paramIndex}::date)
          AND DATE_TRUNC('day', u.created_at) <= DATE_TRUNC('day', $${paramIndex + 1}::date)
          ${filterConditions}
      `;
      const newUsersPerMonthResult = await pool.query(newUsersPerMonthQuery, [...filterParams, monthStart.toISOString().split('T')[0], monthEnd.toISOString().split('T')[0]]);
      const newUsersPerMonth = parseInt(newUsersPerMonthResult.rows[0]?.count) || 0;

      // Total transactions recategorised (from categorization_learning table)
      let totalTransactionsRecategorised = 0;
      try {
        const recatCheck = await pool.query(`
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'categorization_learning'
          LIMIT 1
        `);
        if (recatCheck.rows.length > 0) {
          const recatQuery = `
            SELECT COUNT(*) as count
            FROM categorization_learning cl
            JOIN users u ON u.id = cl.user_id
            WHERE u.email != $${adminEmailParamIndex}
              AND cl.created_at >= $${paramIndex}::timestamp
              AND cl.created_at <= $${paramIndex + 1}::timestamp
              ${filterConditions}
          `;
          const recatResult = await pool.query(recatQuery, [...filterParams, weekStart, weekEnd]);
          totalTransactionsRecategorised = parseInt(recatResult.rows[0]?.count) || 0;
        }
      } catch (e) {
        // categorization_learning table doesn't exist, recategorised = 0
      }

      metrics[weekKey] = {
        totalUsers,
        weeklyActiveUsers: wau,
        newUsers,
        monthlyActiveUsers: mau,
        newUsersPerMonth,
        totalTransactionsUploaded: totalTransactions,
        totalTransactionsRecategorised,
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
