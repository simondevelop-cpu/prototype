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

    // Get all bookings with user information
    let result;
    try {
      result = await pool.query(
        `SELECT 
          cb.id,
          cb.user_id,
          u.email as user_email,
          u.display_name,
          cb.booking_date,
          cb.booking_time,
          cb.preferred_method,
          cb.share_screen,
          cb.record_conversation,
          cb.notes,
          cb.status,
          cb.created_at
         FROM ${tableName} cb
         JOIN users u ON cb.user_id = u.id
         ORDER BY cb.booking_date DESC, cb.booking_time DESC
         LIMIT 500`
      );
    } catch (error: any) {
      // If table doesn't exist, return empty array
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return NextResponse.json({
          success: true,
          bookings: [],
        });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      bookings: result.rows.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        userEmail: row.user_email,
        displayName: row.display_name,
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
    console.error('[API] Get admin bookings error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bookings', details: error.message },
      { status: 500 }
    );
  }
}

