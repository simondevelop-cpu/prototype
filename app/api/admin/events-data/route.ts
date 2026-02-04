import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';

export const dynamic = 'force-dynamic';

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

    // Query l1_event_facts directly (no fallback)
    const eventsTable = 'l1_event_facts';

    // Check how many events exist total
    const countCheck = await pool.query(`SELECT COUNT(*) as count FROM ${eventsTable}`);
    const totalEvents = parseInt(countCheck.rows[0]?.count || '0', 10);
    console.log(`[Events Data API] Found ${totalEvents} total events in ${eventsTable} table`);

    // Check what columns exist in events table
    let hasEventData = false;
    let hasMetadata = false;
    try {
      const columnCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1 
        AND column_name IN ('event_data', 'metadata')
      `, [eventsTable]);
      hasEventData = columnCheck.rows.some(row => row.column_name === 'event_data');
      hasMetadata = columnCheck.rows.some(row => row.column_name === 'metadata');
      console.log('[Events Data API] Schema check - hasEventData:', hasEventData, 'hasMetadata:', hasMetadata);
    } catch (e) {
      console.log('[Events Data API] Could not check schema');
    }

    // Build select fields based on what columns exist
    // Note: l1_event_facts table has event_timestamp (not created_at) and metadata (not event_data)
    const eventFields = [
      'e.id',
      'e.user_id',
      `COALESCE(p.first_name, 'Unknown') as first_name`,
      'e.event_type',
      hasEventData ? 'e.event_data' : 'NULL as event_data',
      hasMetadata ? 'e.metadata' : 'NULL as metadata',
      'e.event_timestamp as created_at' // Use event_timestamp (the actual column name)
    ].join(',\n        ');

    // Fetch all user events with user information (only first name, no email or last name)
    // Use COALESCE to handle cases where l0_pii_users doesn't have data
    const result = await pool.query(`
      SELECT 
        ${eventFields}
      FROM ${eventsTable} e
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN l0_pii_users p ON u.id = p.internal_user_id AND p.deleted_at IS NULL
      WHERE (u.email != $1 OR u.email IS NULL)
      ORDER BY e.event_timestamp DESC
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

