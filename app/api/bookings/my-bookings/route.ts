import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = decoded.userId || decoded.id || decoded.sub;
    if (!userId) {
      return NextResponse.json({ error: 'Invalid token: no user ID' }, { status: 401 });
    }

    const pool = getPool();
    if (!pool) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    // Use new table name (l1_admin_chat_bookings) with fallback to old name
    let tableName = 'l1_admin_chat_bookings';
    try {
      const tableCheck = await pool.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = $1`,
        [tableName]
      );
      if (tableCheck.rows.length === 0) {
        tableName = 'chat_bookings'; // Fallback to old name
      }
    } catch (e) {
      tableName = 'chat_bookings'; // Fallback on error
    }

    // Get user's bookings
    const result = await pool.query(
      `SELECT 
        id,
        booking_date,
        booking_time,
        preferred_method,
        share_screen,
        record_conversation,
        notes,
        status,
        created_at
       FROM ${tableName}
       WHERE user_id = $1
       ORDER BY booking_date DESC, booking_time DESC`,
      [userId]
    );

    return NextResponse.json({
      success: true,
      bookings: result.rows.map((row: any) => ({
        id: row.id,
        date: row.booking_date,
        time: row.booking_time ? row.booking_time.slice(0, 5) : '', // Return as HH:MM
        preferredMethod: row.preferred_method,
        shareScreen: row.share_screen,
        recordConversation: row.record_conversation,
        notes: row.notes,
        status: row.status,
        createdAt: row.created_at,
      })),
    });
  } catch (error: any) {
    console.error('[API] Get my bookings error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bookings', details: error.message },
      { status: 500 }
    );
  }
}

