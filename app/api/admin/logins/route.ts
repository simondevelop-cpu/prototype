import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';

export const dynamic = 'force-dynamic';

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

    // Check if l1_events table exists (or legacy user_events for backward compatibility)
    let hasEventsTable = false;
    try {
      const tableCheck = await pool.query(`
        SELECT 1 FROM information_schema.tables 
        WHERE table_name IN ('l1_events', 'user_events')
        LIMIT 1
      `);
      hasEventsTable = tableCheck.rows.length > 0;
    } catch (e) {
      console.log('[Admin Logins API] Could not check for events table');
    }

    if (!hasEventsTable) {
      return NextResponse.json({ 
        success: true,
        logins: [],
        message: 'l1_events table does not exist.'
      }, { status: 200 });
    }

    // Fetch admin login and tab access events
    const result = await pool.query(`
      SELECT 
        id,
        event_type,
        event_timestamp,
        metadata
      FROM l1_events
      WHERE event_type IN ('admin_login', 'admin_tab_access')
      ORDER BY event_timestamp DESC
      LIMIT 1000
    `);
    
    return NextResponse.json({ 
      success: true,
      logins: result.rows
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error fetching admin logins:', error);
    return NextResponse.json(
      { error: 'Failed to fetch admin logins', details: error.message },
      { status: 500 }
    );
  }
}

