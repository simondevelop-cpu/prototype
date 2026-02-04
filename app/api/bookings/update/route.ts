import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { verifyRequestOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest) {
  try {
    // CSRF protection
    if (!verifyRequestOrigin(request)) {
      return NextResponse.json(
        { error: 'Invalid request origin' },
        { status: 403 }
      );
    }

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

    const body = await request.json();
    const { bookingId, notes, action } = body;

    if (!bookingId) {
      return NextResponse.json(
        { error: 'Missing bookingId' },
        { status: 400 }
      );
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

    // Verify the booking belongs to this user
    const bookingCheck = await pool.query(
      `SELECT id, status FROM ${tableName} WHERE id = $1 AND user_id = $2`,
      [bookingId, userId]
    );

    if (bookingCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Booking not found or access denied' },
        { status: 404 }
      );
    }

    const currentStatus = bookingCheck.rows[0].status;

    // Handle cancel action
    if (action === 'cancel') {
      if (currentStatus === 'cancelled') {
        return NextResponse.json(
          { error: 'Booking is already cancelled' },
          { status: 400 }
        );
      }

      await pool.query(
        `UPDATE ${tableName} 
         SET status = 'cancelled', updated_at = NOW()
         WHERE id = $1 AND user_id = $2`,
        [bookingId, userId]
      );

      return NextResponse.json({
        success: true,
        message: 'Booking cancelled successfully',
      });
    }

    // Handle notes update
    if (notes !== undefined) {
      // Validate notes is a string
      if (notes !== null && typeof notes !== 'string') {
        return NextResponse.json(
          { error: 'Notes must be a string or null' },
          { status: 400 }
        );
      }
      
      // Validate word count (200 word limit)
      if (notes) {
        const wordCount = notes.trim().split(/\s+/).filter(Boolean).length;
        if (wordCount > 200) {
          return NextResponse.json(
            { error: 'Notes cannot exceed 200 words' },
            { status: 400 }
          );
        }
      }

      await pool.query(
        `UPDATE ${tableName} 
         SET notes = $1, updated_at = NOW()
         WHERE id = $2 AND user_id = $3`,
        [notes || null, bookingId, userId]
      );

      return NextResponse.json({
        success: true,
        message: 'Notes updated successfully',
      });
    }

    return NextResponse.json(
      { error: 'No action specified' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[API] Update booking error:', error);
    return NextResponse.json(
      { error: 'Failed to update booking', details: error.message },
      { status: 500 }
    );
  }
}

