import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const ADMIN_EMAIL = 'admin@canadianinsights.ca';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

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
      // Check if user is admin (either by role or email)
      if (decoded.role !== 'admin' && decoded.email !== ADMIN_EMAIL) {
        console.error('[Events Data API] Not admin:', decoded);
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }
    } catch (error) {
      console.error('[Events Data API] Token verification failed:', error);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check if user_events table exists
    let hasUserEventsTable = false;
    try {
      const tableCheck = await pool.query(`
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'user_events'
        LIMIT 1
      `);
      hasUserEventsTable = tableCheck.rows.length > 0;
    } catch (e) {
      console.log('[Events Data API] Could not check for user_events table');
    }

    if (!hasUserEventsTable) {
      return NextResponse.json({ 
        success: true,
        eventsData: [],
        message: 'user_events table does not exist. Events will appear once the table is created and events are logged.'
      }, { status: 200 });
    }

    // Check how many events exist total
    const countCheck = await pool.query(`SELECT COUNT(*) as count FROM user_events`);
    const totalEvents = parseInt(countCheck.rows[0]?.count || '0', 10);
    console.log('[Events Data API] Found', totalEvents, 'total events in user_events table');

    // Fetch all user events with user information (only first name, no email or last name)
    // Use COALESCE to handle cases where l0_pii_users doesn't have data
    const result = await pool.query(`
      SELECT 
        e.id,
        e.user_id,
        COALESCE(p.first_name, 'Unknown') as first_name,
        e.event_type,
        e.event_data,
        e.created_at,
        e.metadata
      FROM user_events e
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN l0_pii_users p ON u.id = p.internal_user_id AND p.deleted_at IS NULL
      WHERE (u.email != $1 OR u.email IS NULL)
      ORDER BY e.created_at DESC
      LIMIT 1000
    `, [ADMIN_EMAIL]);
    
    console.log('[Events Data API] Query returned', result.rows.length, 'events after filtering');

    // Group events by type for summary
    const eventsByType = result.rows.reduce((acc: any, event: any) => {
      const type = event.event_type || 'unknown';
      if (!acc[type]) {
        acc[type] = 0;
      }
      acc[type]++;
      return acc;
    }, {});

    return NextResponse.json({ 
      success: true,
      eventsData: result.rows,
      summary: {
        totalEvents: result.rows.length,
        eventsByType,
        hasUserEventsTable: true
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error fetching events data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events data', details: error.message },
      { status: 500 }
    );
  }
}

