/**
 * Engagement Chart API
 * Returns data for engagement chart showing unique login days per week
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

interface ChartFilters {
  totalAccounts?: boolean;
  validatedEmails?: boolean;
  cohorts?: string[]; // Signup weeks to include
  intentCategories?: string[];
  dataCoverage?: string[]; // ['1 upload', '2 uploads', '3+ uploads']
  userIds?: number[];
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
    const filters: ChartFilters = {
      totalAccounts: url.searchParams.get('totalAccounts') === 'true',
      validatedEmails: url.searchParams.get('validatedEmails') === 'true',
      cohorts: url.searchParams.get('cohorts')?.split(',').filter(Boolean) || [],
      intentCategories: url.searchParams.get('intentCategories')?.split('|').filter(Boolean) || [],
      dataCoverage: url.searchParams.get('dataCoverage')?.split(',').filter(Boolean) || [],
      userIds: url.searchParams.get('userIds')?.split(',').map(id => parseInt(id)).filter(id => !isNaN(id)) || [],
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
    const uploadCountSubquery = hasUploadSessionId ? `
      SELECT COUNT(DISTINCT upload_session_id)
      FROM transactions t
      WHERE t.user_id = u.id
        AND t.upload_session_id IS NOT NULL
    ` : `
      0
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

    // Get login days per week for each user (if user_events table exists)
    const userLines: any[] = [];
    
    for (const user of filteredUsers) {
      const signupDate = new Date(user.signup_date);
      const weeks: { week: number; loginDays: number }[] = [];
      
      if (hasUserEvents) {
        // Calculate login days per week for 12 weeks
        for (let weekNum = 0; weekNum < 12; weekNum++) {
          const weekStart = new Date(signupDate);
          weekStart.setDate(signupDate.getDate() + (weekNum * 7));
          weekStart.setHours(0, 0, 0, 0);
          
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          weekEnd.setHours(23, 59, 59, 999);
          
          // Get unique login days in this week
          const loginDaysResult = await pool.query(`
            SELECT COUNT(DISTINCT DATE(event_timestamp)) as login_days
            FROM user_events
            WHERE user_id = $1
              AND event_type = 'login'
              AND event_timestamp >= $2
              AND event_timestamp <= $3
          `, [user.id, weekStart, weekEnd]);
          
          const loginDays = parseInt(loginDaysResult.rows[0]?.login_days) || 0;
          weeks.push({ week: weekNum, loginDays });
        }
      } else {
        // No user_events table - return zeros for now
        for (let weekNum = 0; weekNum < 12; weekNum++) {
          weeks.push({ week: weekNum, loginDays: 0 });
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

    return NextResponse.json({
      success: true,
      userLines,
      filters,
      hasUserEvents,
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Engagement Chart] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch engagement chart data', details: error.message },
      { status: 500 }
    );
  }
}

