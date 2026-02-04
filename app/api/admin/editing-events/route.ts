import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';
import { getPool } from '@/lib/db';

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
      console.log('[Editing Events API] Could not check for events table');
    }

    if (!hasEventsTable) {
      return NextResponse.json({ 
        success: true,
        editingEvents: [],
        message: 'Events table (l1_event_facts or l1_events) does not exist.'
      }, { status: 200 });
    }

    // Fetch transaction editing events (both transaction_edit and bulk_edit)
    const result = await pool.query(`
      SELECT 
        e.id,
        e.user_id,
        COALESCE(p.first_name, 'Unknown') as first_name,
        u.email,
        e.event_type,
        e.metadata,
        e.event_timestamp as created_at
      FROM ${eventsTable} e
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN l0_pii_users p ON u.id = p.internal_user_id AND p.deleted_at IS NULL
      WHERE e.event_type IN ('transaction_edit', 'bulk_edit')
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

