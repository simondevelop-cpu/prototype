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
      filterConditions += ` AND u.motivation = ANY($${paramIndex})`;
      filterParams.push(filters.intentCategories);
      paramIndex++;
    }

    filterParams.push(ADMIN_EMAIL);
    const adminEmailParamIndex = paramIndex;
    paramIndex++;

    // Generate weeks starting from w/c Nov 2, 2025 to now
    const now = new Date();
    // Nov 2, 2025 is a Sunday, so week starts from Nov 2
    const nov2Start = new Date(2025, 10, 2); // Month 10 = November, day 2
    nov2Start.setHours(0, 0, 0, 0);

    // Calculate weeks from Nov 2, 2025 to current week
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
    currentWeekStart.setHours(0, 0, 0, 0);

    // Calculate number of weeks
    const weeksDiff = Math.ceil((currentWeekStart.getTime() - nov2Start.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const numWeeks = Math.max(1, weeksDiff + 1); // At least 1 week

    const weeks: string[] = [];
    for (let i = 0; i < numWeeks; i++) {
      const weekStart = new Date(nov2Start);
      weekStart.setDate(nov2Start.getDate() + (i * 7));
      const weekLabel = `w/c ${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      weeks.push(weekLabel);
    }

    // Get metrics for each week
    const metrics: { [week: string]: any } = {};

    for (let i = 0; i < numWeeks; i++) {
      const weekStart = new Date(nov2Start);
      weekStart.setDate(nov2Start.getDate() + (i * 7));
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      const weekKey = `w/c ${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;

      // Total users (cumulative up to end of week)
      // Use DATE_TRUNC to ensure we're comparing dates correctly
      const totalUsersQuery = `
        SELECT COUNT(*) as count
        FROM users u
        WHERE u.email != $${adminEmailParamIndex}
          AND DATE_TRUNC('day', u.created_at) <= DATE_TRUNC('day', $${paramIndex}::timestamp)
          ${filterConditions}
      `;
      const totalUsersResult = await pool.query(totalUsersQuery, [...filterParams, weekEnd]);
      const totalUsers = parseInt(totalUsersResult.rows[0]?.count) || 0;

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
      const newUsers = parseInt(newUsersResult.rows[0]?.count) || 0;

      // Total transactions uploaded (in the week)
      const transactionsQuery = `
        SELECT COUNT(*) as count
        FROM transactions t
        JOIN users u ON u.id = t.user_id
        WHERE u.email != $${adminEmailParamIndex}
          AND t.created_at >= $${paramIndex}
          AND t.created_at <= $${paramIndex + 1}
          ${filterConditions}
      `;
      const transactionsResult = await pool.query(transactionsQuery, [...filterParams, weekStart, weekEnd]);
      const totalTransactions = parseInt(transactionsResult.rows[0]?.count) || 0;

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
