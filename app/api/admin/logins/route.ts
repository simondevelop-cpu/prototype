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

    // Fetch admin login, tab access, and data download events from l1_event_facts
    // All these events have event_type = 'admin_login' or 'admin_tab_access'
    // Data downloads are logged as 'admin_tab_access' with metadata.action = 'data_download'
    const result = await pool.query(`
      SELECT 
        id,
        event_type,
        event_timestamp,
        metadata
      FROM l1_event_facts
      WHERE event_type IN ('admin_login', 'admin_tab_access')
        AND is_admin = TRUE
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

