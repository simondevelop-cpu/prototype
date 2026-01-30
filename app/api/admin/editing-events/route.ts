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
      if (decoded.role !== 'admin' && decoded.email !== ADMIN_EMAIL) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }
    } catch (error) {
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
      console.log('[Editing Events API] Could not check for user_events table');
    }

    if (!hasUserEventsTable) {
      return NextResponse.json({ 
        success: true,
        editingEvents: [],
        message: 'user_events table does not exist.'
      }, { status: 200 });
    }

    // Fetch transaction editing events
    const result = await pool.query(`
      SELECT 
        e.id,
        e.user_id,
        COALESCE(p.first_name, 'Unknown') as first_name,
        u.email,
        e.event_type,
        e.metadata,
        e.event_timestamp as created_at
      FROM user_events e
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN l0_pii_users p ON u.id = p.internal_user_id AND p.deleted_at IS NULL
      WHERE e.event_type = 'transaction_edit'
        AND (u.email != $1 OR u.email IS NULL)
      ORDER BY e.event_timestamp DESC
      LIMIT 1000
    `, [ADMIN_EMAIL]);
    
    return NextResponse.json({ 
      success: true,
      editingEvents: result.rows
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error fetching editing events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch editing events', details: error.message },
      { status: 500 }
    );
  }
}

