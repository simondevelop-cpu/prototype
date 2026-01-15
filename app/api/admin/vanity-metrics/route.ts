/**
 * Vanity Metrics API
 * Returns monthly metrics (Total users, MAU, New users, Transactions, Unique banks)
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

    // Generate months (Jan 2026 to Dec 2026)
    const months: string[] = [];
    for (let month = 0; month < 12; month++) {
      const date = new Date(2026, month, 1);
      months.push(date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
    }

    // Get metrics for each month
    const metrics: { [month: string]: any } = {};

    for (let month = 0; month < 12; month++) {
      const monthStart = new Date(2026, month, 1);
      const monthEnd = new Date(2026, month + 1, 0, 23, 59, 59);
      const monthKey = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      // Total users (cumulative up to end of month)
      const totalUsersQuery = `
        SELECT COUNT(*) as count
        FROM users u
        WHERE u.email != $${paramIndex}
          AND u.created_at <= $${paramIndex + 1}
          ${filterConditions}
      `;
      const totalUsersResult = await pool.query(totalUsersQuery, [...filterParams, monthEnd]);
      const totalUsers = parseInt(totalUsersResult.rows[0]?.count) || 0;

      // Monthly Active Users (users who logged in during the month)
      // Check if user_events table exists
      let mau = 0;
      try {
        const eventsCheck = await pool.query(`
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'user_events'
          LIMIT 1
        `);
        if (eventsCheck.rows.length > 0) {
          const mauQuery = `
            SELECT COUNT(DISTINCT e.user_id) as count
            FROM user_events e
            JOIN users u ON u.id = e.user_id
            WHERE e.event_type = 'login'
              AND e.event_timestamp >= $${paramIndex}
              AND e.event_timestamp <= $${paramIndex + 1}
              AND u.email != $${paramIndex + 2}
              ${filterConditions}
          `;
          const mauResult = await pool.query(mauQuery, [monthStart, monthEnd, ...filterParams]);
          mau = parseInt(mauResult.rows[0]?.count) || 0;
        }
      } catch (e) {
        // user_events table doesn't exist, MAU = 0
      }

      // New users per month
      const newUsersQuery = `
        SELECT COUNT(*) as count
        FROM users u
        WHERE u.email != $${paramIndex}
          AND u.created_at >= $${paramIndex + 1}
          AND u.created_at <= $${paramIndex + 2}
          ${filterConditions}
      `;
      const newUsersResult = await pool.query(newUsersQuery, [...filterParams, monthStart, monthEnd]);
      const newUsers = parseInt(newUsersResult.rows[0]?.count) || 0;

      // Total transactions uploaded (in the month)
      const transactionsQuery = `
        SELECT COUNT(*) as count
        FROM transactions t
        JOIN users u ON u.id = t.user_id
        WHERE u.email != $${paramIndex}
          AND t.created_at >= $${paramIndex + 1}
          AND t.created_at <= $${paramIndex + 2}
          ${filterConditions}
      `;
      const transactionsResult = await pool.query(transactionsQuery, [...filterParams, monthStart, monthEnd]);
      const totalTransactions = parseInt(transactionsResult.rows[0]?.count) || 0;

      // Total unique banks uploaded (in the month)
      const banksQuery = `
        SELECT COUNT(DISTINCT t.account) as count
        FROM transactions t
        JOIN users u ON u.id = t.user_id
        WHERE u.email != $${paramIndex}
          AND t.created_at >= $${paramIndex + 1}
          AND t.created_at <= $${paramIndex + 2}
          AND t.account IS NOT NULL
          ${filterConditions}
      `;
      const banksResult = await pool.query(banksQuery, [...filterParams, monthStart, monthEnd]);
      const uniqueBanks = parseInt(banksResult.rows[0]?.count) || 0;

      metrics[monthKey] = {
        totalUsers,
        monthlyActiveUsers: mau,
        newUsers,
        totalTransactionsUploaded: totalTransactions,
        totalUniqueBanksUploaded: uniqueBanks,
      };
    }

    return NextResponse.json({
      success: true,
      months,
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

