/**
 * Vanity Metrics API
 * Returns weekly metrics (Total users, WAU, New users, Transactions, Unique banks)
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';
import { getPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

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

    const pool = getPool();
    if (!pool) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
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

    // Use the same week calculation as cohort analysis
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

    // Generate all weeks from earliest user to current week (same week calculation as cohort analysis)
    // Find the earliest user creation date
    const earliestUserCheck = await pool.query(`
      SELECT MIN(created_at) as earliest_date
      FROM users
      WHERE email != $1
    `, [ADMIN_EMAIL]);
    
    const earliestDateStr = earliestUserCheck.rows[0]?.earliest_date;
    let earliestWeekStart: Date;
    
    if (earliestDateStr) {
      // Use DATE_TRUNC to get the week start (Monday in PostgreSQL)
      const earliestWeekResult = await pool.query(`
        SELECT DATE_TRUNC('week', $1::timestamp) as week_start
      `, [earliestDateStr]);
      earliestWeekStart = new Date(earliestWeekResult.rows[0].week_start);
    } else {
      // Fallback: if no users, start from 12 weeks ago
      earliestWeekStart = new Date();
      earliestWeekStart.setDate(earliestWeekStart.getDate() - (12 * 7));
      const dayOfWeek = earliestWeekStart.getDay();
      earliestWeekStart.setDate(earliestWeekStart.getDate() - dayOfWeek);
      earliestWeekStart.setHours(0, 0, 0, 0);
    }

    // Get current week start using DATE_TRUNC
    const now = new Date();
    const currentWeekResult = await pool.query(`
      SELECT DATE_TRUNC('week', $1::timestamp) as week_start
    `, [now]);
    const currentWeekStart = new Date(currentWeekResult.rows[0].week_start);

    // Generate all weeks from earliest to current
    const weeksSet = new Set<string>();
    const weekDate = new Date(earliestWeekStart);
    while (weekDate <= currentWeekStart) {
      weeksSet.add(formatWeekLabel(weekDate));
      weekDate.setDate(weekDate.getDate() + 7);
    }
    
    // Sort weeks (most recent first) and ensure unique
    const allWeeks = Array.from(weeksSet).sort((a, b) => {
      // Parse dates more carefully - handle format "DD MMM YYYY" (e.g., "20 Oct 2025")
      const parseWeekDate = (weekStr: string): Date | null => {
        const match = weekStr.match(/w\/c (\d+) (\w+) (\d+)/);
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
      };
      
      const dateA = parseWeekDate(a);
      const dateB = parseWeekDate(b);
      if (!dateA || !dateB) return 0;
      return dateB.getTime() - dateA.getTime(); // Most recent first
    });
    
    // Filter weeks based on cohort filter (if specified)
    // If cohorts filter is empty, show all weeks
    const weeks = filters.cohorts && filters.cohorts.length > 0
      ? allWeeks.filter(week => filters.cohorts!.includes(week))
      : allWeeks;

    // Helper function to parse week label back to dates
    const parseWeekLabel = (weekStr: string): { weekStart: Date; weekEnd: Date } | null => {
      const match = weekStr.match(/w\/c (\d+) (\w+) (\d+)/);
      if (match) {
        const day = parseInt(match[1]);
        const monthName = match[2];
        const year = parseInt(match[3]);
        const monthMap: { [key: string]: number } = {
          'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
          'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
        };
        const month = monthMap[monthName] ?? 0;
        const weekStart = new Date(year, month, day);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        return { weekStart, weekEnd };
      }
      return null;
    };

    // Get metrics for each week (only for weeks that should be displayed)
    const metrics: { [week: string]: any } = {};

    for (const weekKey of weeks) {
      const weekDates = parseWeekLabel(weekKey);
      if (!weekDates) continue;
      
      const { weekStart, weekEnd } = weekDates;

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
          SELECT u.id, COUNT(DISTINCT tf.id) as tx_count
          FROM users u
          LEFT JOIN l0_user_tokenization ut ON u.id = ut.internal_user_id
          LEFT JOIN l1_transaction_facts tf ON ut.tokenized_user_id = tf.tokenized_user_id
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
      // Check if l1_event_facts or l1_events table exists (migration-safe)
      let eventsTable = 'l1_event_facts';
      let hasEventsTable = false;
      try {
        const newTableCheck = await pool.query(`
          SELECT 1 FROM information_schema.tables WHERE table_name = 'l1_event_facts' LIMIT 1
        `);
        if (newTableCheck.rows.length > 0) {
          eventsTable = 'l1_event_facts';
          hasEventsTable = true;
        } else {
          const oldTableCheck = await pool.query(`
            SELECT 1 FROM information_schema.tables WHERE table_name = 'l1_events' LIMIT 1
          `);
          if (oldTableCheck.rows.length > 0) {
            eventsTable = 'l1_events';
            hasEventsTable = true;
          }
        }
      } catch (e) {
        // Table check failed
      }
      
      let wau = 0;
      if (hasEventsTable) {
        try {
          // Build WAU query with correct parameter order
          // filterParams come first, then weekStart and weekEnd
          const wauParamIndex = filterParams.length + 1;
          const wauQuery = `
            SELECT COUNT(DISTINCT e.user_id) as count
            FROM ${eventsTable} e
            JOIN users u ON u.id = e.user_id
            WHERE e.event_type = 'login'
              AND e.event_timestamp >= $${wauParamIndex}::timestamp
              AND e.event_timestamp <= $${wauParamIndex + 1}::timestamp
              AND u.email != $${adminEmailParamIndex}
              ${filterConditions}
          `;
          const wauResult = await pool.query(wauQuery, [...filterParams, weekStart, weekEnd]);
          wau = parseInt(wauResult.rows[0]?.count) || 0;
        } catch (e) {
          // Query failed, WAU = 0
        }
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
          SELECT u.id, COUNT(DISTINCT tf.id) as tx_count
          FROM users u
          LEFT JOIN l0_user_tokenization ut ON u.id = ut.internal_user_id
          LEFT JOIN l1_transaction_facts tf ON ut.tokenized_user_id = tf.tokenized_user_id
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
      // filterParams already includes ADMIN_EMAIL and any filter params
      // weekStart and weekEnd will be appended, so they're at positions filterParams.length + 1 and filterParams.length + 2
      const newTransactionsDateParamIndex = filterParams.length + 1;
      let newTransactionsQuery = `
        SELECT COUNT(*) as count
        FROM l1_transaction_facts tf
        JOIN l0_user_tokenization ut ON tf.tokenized_user_id = ut.tokenized_user_id
        JOIN users u ON ut.internal_user_id = u.id
        WHERE u.email != $${adminEmailParamIndex}
          AND tf.created_at >= $${newTransactionsDateParamIndex}::timestamp
          AND tf.created_at <= $${newTransactionsDateParamIndex + 1}::timestamp
          ${filterConditions}
      `;
      let newTransactions = 0;
      
      // Total transactions uploaded (cumulative up to end of week) - apply data coverage filter if specified
      // weekEnd will be appended to filterParams, so it's at position filterParams.length + 1
      const totalTransactionsDateParamIndex = filterParams.length + 1;
      let totalTransactionsQuery = `
        SELECT COUNT(*) as count
        FROM l1_transaction_facts tf
        JOIN l0_user_tokenization ut ON tf.tokenized_user_id = ut.tokenized_user_id
        JOIN users u ON ut.internal_user_id = u.id
        WHERE u.email != $${adminEmailParamIndex}
          AND tf.created_at <= $${totalTransactionsDateParamIndex}::timestamp
          ${filterConditions}
      `;
      let totalTransactions = 0;
      
      // Calculate new transactions (in the week)
      if (filters.dataCoverage && filters.dataCoverage.length > 0) {
        // Get users matching data coverage criteria
        const usersWithCoverageQuery = `
          SELECT DISTINCT u.id
          FROM users u
          LEFT JOIN l0_user_tokenization ut ON u.id = ut.internal_user_id
          LEFT JOIN l1_transaction_facts tf ON ut.tokenized_user_id = tf.tokenized_user_id
          WHERE u.email != $${adminEmailParamIndex}
            ${filterConditions}
          GROUP BY u.id
          HAVING 
            ${filters.dataCoverage.includes('1 upload') ? 'COUNT(DISTINCT tf.id) >= 1' : 'false'}
            ${filters.dataCoverage.includes('2 uploads') ? 'OR COUNT(DISTINCT tf.id) >= 2' : ''}
            ${filters.dataCoverage.includes('3+ uploads') ? 'OR COUNT(DISTINCT tf.id) >= 3' : ''}
        `;
        const usersWithCoverage = await pool.query(usersWithCoverageQuery, filterParams);
        const userIds = usersWithCoverage.rows.map((r: any) => r.id);
        if (userIds.length > 0) {
          const filteredNewTransactionsQuery = `
            SELECT COUNT(*) as count
            FROM l1_transaction_facts tf
            JOIN l0_user_tokenization ut ON tf.tokenized_user_id = ut.tokenized_user_id
            WHERE ut.internal_user_id = ANY($1::int[])
              AND tf.created_at >= $2::timestamp
              AND tf.created_at <= $3::timestamp
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
          LEFT JOIN l0_user_tokenization ut ON u.id = ut.internal_user_id
          LEFT JOIN l1_transaction_facts tf ON ut.tokenized_user_id = tf.tokenized_user_id
          WHERE u.email != $${adminEmailParamIndex}
            ${filterConditions}
          GROUP BY u.id
          HAVING 
            ${filters.dataCoverage.includes('1 upload') ? 'COUNT(DISTINCT tf.id) >= 1' : 'false'}
            ${filters.dataCoverage.includes('2 uploads') ? 'OR COUNT(DISTINCT tf.id) >= 2' : ''}
            ${filters.dataCoverage.includes('3+ uploads') ? 'OR COUNT(DISTINCT tf.id) >= 3' : ''}
        `;
        const usersWithCoverage = await pool.query(usersWithCoverageQuery, filterParams);
        const userIds = usersWithCoverage.rows.map((r: any) => r.id);
        if (userIds.length > 0) {
          const filteredTotalTransactionsQuery = `
            SELECT COUNT(*) as count
            FROM l1_transaction_facts tf
            JOIN l0_user_tokenization ut ON tf.tokenized_user_id = ut.tokenized_user_id
            WHERE ut.internal_user_id = ANY($1::int[])
              AND tf.created_at <= $2::timestamp
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
        SELECT COUNT(DISTINCT tf.account) as count
        FROM l1_transaction_facts tf
        JOIN l0_user_tokenization ut ON tf.tokenized_user_id = ut.tokenized_user_id
        JOIN users u ON ut.internal_user_id = u.id
        WHERE u.email != $${adminEmailParamIndex}
          AND tf.created_at >= $${paramIndex}::timestamp
          AND tf.created_at <= $${paramIndex + 1}::timestamp
          AND tf.account IS NOT NULL
          ${filterConditions}
      `;
      const banksResult = await pool.query(banksQuery, [...filterParams, weekStart, weekEnd]);
      const uniqueBanks = parseInt(banksResult.rows[0]?.count) || 0;

      // Monthly Active Users (MAU) - users who logged in during the month containing this week
      let mau = 0;
      if (hasEventsTable) {
        try {
          // Get the month start and end for this week
          const monthStart = new Date(weekStart);
          monthStart.setDate(1);
          monthStart.setHours(0, 0, 0, 0);
          const monthEnd = new Date(monthStart);
          monthEnd.setMonth(monthEnd.getMonth() + 1);
          monthEnd.setDate(0); // Last day of month
          monthEnd.setHours(23, 59, 59, 999);
          
          // Build MAU query with correct parameter order
          // filterParams come first, then monthStart and monthEnd
          const mauParamIndex = filterParams.length + 1;
          const mauQuery = `
            SELECT COUNT(DISTINCT e.user_id) as count
            FROM ${eventsTable} e
            JOIN users u ON u.id = e.user_id
            WHERE e.event_type = 'login'
              AND e.event_timestamp >= $${mauParamIndex}::timestamp
              AND e.event_timestamp <= $${mauParamIndex + 1}::timestamp
              AND u.email != $${adminEmailParamIndex}
              ${filterConditions}
          `;
          const mauResult = await pool.query(mauQuery, [...filterParams, monthStart, monthEnd]);
          mau = parseInt(mauResult.rows[0]?.count) || 0;
        } catch (e) {
          // Query failed, MAU = 0
        }
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

      // Total transactions recategorised (unique transactions with at least one edit)
      // Count distinct transaction IDs from transaction_edit and bulk_edit events
      let totalTransactionsRecategorised = 0;
      if (hasEventsTable) {
        try {
          // Get all transaction_edit events (single transaction per event)
          const recatParamIndex = filterParams.length + 1;
          const singleEditQuery = `
            SELECT DISTINCT (e.metadata->>'transactionId')::int as transaction_id
            FROM ${eventsTable} e
            JOIN users u ON u.id = e.user_id
            WHERE e.event_type = 'transaction_edit'
              AND e.event_timestamp >= $${recatParamIndex}::timestamp
              AND e.event_timestamp <= $${recatParamIndex + 1}::timestamp
              AND u.email != $${adminEmailParamIndex}
              AND e.metadata->>'transactionId' IS NOT NULL
              ${filterConditions}
          `;
          const singleEditResult = await pool.query(singleEditQuery, [...filterParams, weekStart, weekEnd]);
          const singleEditIds = new Set(singleEditResult.rows.map((r: any) => r.transaction_id).filter((id: any) => id !== null));
          
          // Get all bulk_edit events (multiple transactions per event)
          const bulkEditQuery = `
            SELECT e.metadata->'transactionIds' as transaction_ids
            FROM ${eventsTable} e
            JOIN users u ON u.id = e.user_id
            WHERE e.event_type = 'bulk_edit'
              AND e.event_timestamp >= $${recatParamIndex}::timestamp
              AND e.event_timestamp <= $${recatParamIndex + 1}::timestamp
              AND u.email != $${adminEmailParamIndex}
              AND e.metadata->'transactionIds' IS NOT NULL
              ${filterConditions}
          `;
          const bulkEditResult = await pool.query(bulkEditQuery, [...filterParams, weekStart, weekEnd]);
          bulkEditResult.rows.forEach((row: any) => {
            const ids = row.transaction_ids;
            if (Array.isArray(ids)) {
              ids.forEach((id: any) => {
                if (id !== null && id !== undefined) {
                  singleEditIds.add(parseInt(id));
                }
              });
            }
          });
          
          totalTransactionsRecategorised = singleEditIds.size;
        } catch (e) {
          // Query failed, recategorised = 0
          console.error('[Vanity Metrics] Error counting recategorised transactions:', e);
        }
      }

      // Total statements uploaded (in the week)
      let totalStatementsUploaded = 0;
      if (hasEventsTable) {
        try {
          const statementsParamIndex = filterParams.length + 1;
          const statementsQuery = `
            SELECT COUNT(*) as count
            FROM ${eventsTable} e
            JOIN users u ON u.id = e.user_id
            WHERE e.event_type = 'statement_upload'
              AND e.event_timestamp >= $${statementsParamIndex}::timestamp
              AND e.event_timestamp <= $${statementsParamIndex + 1}::timestamp
              AND u.email != $${adminEmailParamIndex}
              ${filterConditions}
          `;
          const statementsResult = await pool.query(statementsQuery, [...filterParams, weekStart, weekEnd]);
          totalStatementsUploaded = parseInt(statementsResult.rows[0]?.count) || 0;
      } catch (e) {
        // l1_events table doesn't exist, statements = 0
      }

      // Total statements uploaded by unique person (in the week)
      let totalStatementsByUniquePerson = 0;
      if (hasEventsTable) {
        try {
          const uniqueStatementsParamIndex = filterParams.length + 1;
          const uniqueStatementsQuery = `
            SELECT COUNT(DISTINCT e.user_id) as count
            FROM ${eventsTable} e
            JOIN users u ON u.id = e.user_id
            WHERE e.event_type = 'statement_upload'
              AND e.event_timestamp >= $${uniqueStatementsParamIndex}::timestamp
              AND e.event_timestamp <= $${uniqueStatementsParamIndex + 1}::timestamp
              AND u.email != $${adminEmailParamIndex}
              ${filterConditions}
          `;
          const uniqueStatementsResult = await pool.query(uniqueStatementsQuery, [...filterParams, weekStart, weekEnd]);
          totalStatementsByUniquePerson = parseInt(uniqueStatementsResult.rows[0]?.count) || 0;
        } catch (e) {
          // Query failed, unique statements = 0
        }
      }

      metrics[weekKey] = {
        totalUsers,
        weeklyActiveUsers: wau,
        newUsers,
        monthlyActiveUsers: mau,
        newUsersPerMonth,
        totalTransactionsUploaded: totalTransactions,
        newTransactionsUploaded: newTransactions,
        totalTransactionsRecategorised,
        totalStatementsUploaded,
        totalStatementsByUniquePerson,
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
