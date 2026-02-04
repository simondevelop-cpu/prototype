/**
 * Engagement Chart API
 * Returns data for engagement chart showing unique login days per week
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';
import { getPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface ChartFilters {
  totalAccounts?: boolean;
  validatedEmails?: boolean;
  cohorts?: string[]; // Signup weeks to include
  intentCategories?: string[];
  dataCoverage?: string[]; // ['1 upload', '2 uploads', '3+ uploads']
  userIds?: number[];
  metric?: 'loginDays' | 'uploadsPerWeek'; // Chart metric type
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
    const filters: ChartFilters = {
      totalAccounts: url.searchParams.get('totalAccounts') === 'true',
      validatedEmails: url.searchParams.get('validatedEmails') === 'true',
      cohorts: url.searchParams.get('cohorts')?.split(',').filter(Boolean) || [],
      intentCategories: url.searchParams.get('intentCategories')?.split('|').filter(Boolean) || [],
      dataCoverage: url.searchParams.get('dataCoverage')?.split(',').filter(Boolean) || [],
      userIds: url.searchParams.get('userIds')?.split(',').map(id => parseInt(id)).filter(id => !isNaN(id)) || [],
      metric: (url.searchParams.get('metric') as 'loginDays' | 'uploadsPerWeek') || 'loginDays',
    };

    // Check if users table has required columns (schema-adaptive)
    const schemaCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('completed_at', 'motivation', 'email_validated')
    `);
    
    const useUsersTable = schemaCheck.rows.some(row => row.column_name === 'completed_at');
    const hasMotivation = schemaCheck.rows.some(row => row.column_name === 'motivation');
    const hasEmailValidated = schemaCheck.rows.some(row => row.column_name === 'email_validated');

    // Use l1_event_facts for engagement tracking
    const hasUserEvents = true; // Assume table exists after migration

    // Check if transactions table has upload_session_id
    let hasUploadSessionId = false;
    try {
      const uploadCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'transactions' 
        AND column_name = 'upload_session_id'
        LIMIT 1
      `);
      hasUploadSessionId = uploadCheck.rows.length > 0;
    } catch (e) {
      // Column doesn't exist
    }

    // Build filter conditions
    let filterConditions = '';
    const filterParams: any[] = [];
    let paramIndex = 1;

    // Note: totalAccounts = true means show all accounts (no filter)
    if (filters.validatedEmails && hasEmailValidated) {
      filterConditions += ` AND u.email_validated = true`;
    }

    if (filters.userIds && filters.userIds.length > 0) {
      filterConditions += ` AND u.id = ANY($${paramIndex})`;
      filterParams.push(filters.userIds);
      paramIndex++;
    }

    if (filters.intentCategories && filters.intentCategories.length > 0 && hasMotivation) {
      filterConditions += ` AND u.motivation = ANY($${paramIndex}::text[])`;
      filterParams.push(filters.intentCategories);
      paramIndex++;
    }

    if (filters.cohorts && filters.cohorts.length > 0) {
      // Parse cohort week strings back to dates
      const cohortDates = filters.cohorts.map(cohort => {
        // Parse "w/c 5 Jan 2025" format
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
          weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
          weekStart.setHours(0, 0, 0, 0);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          weekEnd.setHours(23, 59, 59, 999);
          return `(u.created_at >= $${paramIndex + idx * 2} AND u.created_at <= $${paramIndex + idx * 2 + 1})`;
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

    // Get user data with signup date and intent
    // Single source of truth (l1_transaction_facts only)
    // Note: upload_session_id not in l1_transaction_facts, use statement_upload events from l1_events instead
    const uploadCountSubquery = `
      SELECT COUNT(DISTINCT tf.id)
      FROM users u2
      LEFT JOIN l0_user_tokenization ut ON u2.id = ut.internal_user_id
      LEFT JOIN l1_transaction_facts tf ON ut.tokenized_user_id = tf.tokenized_user_id
      WHERE u2.id = u.id
        AND tf.id IS NOT NULL
    `;
    
    const usersQuery = useUsersTable ? `
      SELECT 
        u.id,
        u.created_at as signup_date,
        u.motivation as intent_type,
        (
          ${uploadCountSubquery}
        ) as upload_count
      FROM users u
      WHERE u.email != $${paramIndex}
        ${filterConditions}
      ORDER BY u.created_at DESC
    ` : `
      SELECT 
        u.id,
        u.created_at as signup_date,
        NULL as intent_type,
        0 as upload_count
      FROM users u
      WHERE u.email != $${paramIndex}
        ${filterConditions}
      ORDER BY u.created_at DESC
    `;

    const usersResult = await pool.query(usersQuery, filterParams);

    // Filter by data coverage if specified
    let filteredUsers = usersResult.rows;
    if (filters.dataCoverage && filters.dataCoverage.length > 0) {
      filteredUsers = filteredUsers.filter((user: any) => {
        const uploadCount = parseInt(user.upload_count) || 0;
        if (filters.dataCoverage!.includes('1 upload') && uploadCount >= 1) return true;
        if (filters.dataCoverage!.includes('2 uploads') && uploadCount >= 2) return true;
        if (filters.dataCoverage!.includes('3+ uploads') && uploadCount >= 3) return true;
        return false;
      });
    }

    // Get login days per week for each user (if l1_events table exists)
    const userLines: any[] = [];
    
    for (const user of filteredUsers) {
      const signupDate = new Date(user.signup_date);
      const weeks: { week: number; loginDays: number }[] = [];
      
      // Calculate metric per week for 12 weeks from l1_event_facts
      for (let weekNum = 0; weekNum < 12; weekNum++) {
        const weekStart = new Date(signupDate);
        weekStart.setDate(signupDate.getDate() + (weekNum * 7));
        weekStart.setHours(0, 0, 0, 0);
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        
        let loginDays = 0;
        let uploadsPerWeek = 0;
        
        try {
          if (filters.metric === 'loginDays' || !filters.metric) {
            // Get unique login days in this week from l1_event_facts
            // Note: We use user_id (internal ID) since login events are logged with internal user_id
            // Use DATE_TRUNC('day', ...) instead of DATE() for better PostgreSQL compatibility
            // Cast user.id to integer to ensure type consistency
            const loginDaysResult = await pool.query(`
              SELECT COUNT(DISTINCT DATE_TRUNC('day', event_timestamp)) as login_days
              FROM l1_event_facts
              WHERE user_id = $1::integer
                AND event_type = 'login'
                AND event_timestamp >= $2::timestamp
                AND event_timestamp <= $3::timestamp
            `, [user.id, weekStart.toISOString(), weekEnd.toISOString()]);
            
            loginDays = parseInt(loginDaysResult.rows[0]?.login_days) || 0;
          }
          
          if (filters.metric === 'uploadsPerWeek' || !filters.metric) {
            // Get number of statement uploads in this week from l1_event_facts
            // Count distinct statement_upload events per week
            const uploadsResult = await pool.query(`
              SELECT COUNT(*) as upload_count
              FROM l1_event_facts
              WHERE user_id = $1::integer
                AND event_type = 'statement_upload'
                AND event_timestamp >= $2::timestamp
                AND event_timestamp <= $3::timestamp
            `, [user.id, weekStart.toISOString(), weekEnd.toISOString()]);
            
            uploadsPerWeek = parseInt(uploadsResult.rows[0]?.upload_count) || 0;
          }
          
          weeks.push({ week: weekNum, loginDays, uploadsPerWeek });
        } catch (e) {
          // If query fails, return zero for this week
          weeks.push({ week: weekNum, loginDays: 0, uploadsPerWeek: 0 });
        }
      }
      
      // Calculate cohort week (signup week)
      const cohortWeekStart = new Date(signupDate);
      cohortWeekStart.setDate(signupDate.getDate() - signupDate.getDay()); // Start of week
      cohortWeekStart.setHours(0, 0, 0, 0);
      const cohortWeekLabel = `w/c ${cohortWeekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      
      // Determine data coverage label
      const uploadCount = parseInt(user.upload_count) || 0;
      let dataCoverageLabel = 'No uploads';
      if (uploadCount >= 3) dataCoverageLabel = '3+ uploads';
      else if (uploadCount >= 2) dataCoverageLabel = '2 uploads';
      else if (uploadCount >= 1) dataCoverageLabel = '1 upload';
      
      userLines.push({
        userId: user.id,
        cohortWeek: cohortWeekLabel,
        intentType: user.intent_type || 'Unknown',
        dataCoverage: dataCoverageLabel,
        weeks: weeks,
      });
    }

    // Determine events table name for summary queries (migration-safe)
    // Debug: Log summary of what we found from l1_event_facts
    const totalLoginEvents = await pool.query(
      `SELECT COUNT(*) as count FROM l1_event_facts WHERE event_type = $1`,
      ['login']
    ).then((r: any) => parseInt(r.rows[0]?.count || '0')).catch(() => 0);
    
    // Check if login events exist for the filtered users
    let loginEventsForFilteredUsers = 0;
    if (filteredUsers.length > 0) {
      const userIds = filteredUsers.map((u: any) => u.id);
      try {
        const loginCheck = await pool.query(
          `SELECT COUNT(*) as count FROM l1_event_facts WHERE event_type = $1 AND user_id = ANY($2::int[])`,
          ['login', userIds]
        );
        loginEventsForFilteredUsers = parseInt(loginCheck.rows[0]?.count || '0');
      } catch (e) {
        // Query failed
      }
    }
    
    const usersWithLogins = userLines.filter((ul: any) => 
      ul.weeks.some((w: any) => w.loginDays > 0)
    ).length;

    console.log(`[Engagement Chart] Found ${userLines.length} users, ${usersWithLogins} with login data, ${totalLoginEvents} total login events in l1_event_facts, ${loginEventsForFilteredUsers} login events for filtered users`);
    console.log(`[Engagement Chart] Filters: cohorts=${filters.cohorts?.length || 0}, dataCoverage=${filters.dataCoverage?.length || 0}, validatedEmails=${filters.validatedEmails}, intentCategories=${filters.intentCategories?.length || 0}`);

    return NextResponse.json({
      success: true,
      userLines,
      filters,
      hasUserEvents,
      debug: {
        totalUsers: userLines.length,
        usersWithLogins,
        totalLoginEvents,
      },
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Engagement Chart] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch engagement chart data', details: error.message },
      { status: 500 }
    );
  }
}

