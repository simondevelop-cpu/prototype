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

    // Fetch transaction editing events (both transaction_edit and bulk_edit) from l1_event_facts
    const result = await pool.query(`
      SELECT 
        e.id,
        e.user_id,
        COALESCE(p.first_name, 'Unknown') as first_name,
        pii.email,
        e.event_type,
        e.metadata,
        e.event_timestamp as created_at
      FROM l1_event_facts e
      LEFT JOIN l1_user_permissions perm ON e.user_id = perm.id
      LEFT JOIN l0_pii_users p ON perm.id = p.internal_user_id AND p.deleted_at IS NULL
      LEFT JOIN l0_pii_users pii ON perm.id = pii.internal_user_id
      WHERE e.event_type IN ('transaction_edit', 'bulk_edit')
        AND (pii.email != $1 OR pii.email IS NULL)
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

