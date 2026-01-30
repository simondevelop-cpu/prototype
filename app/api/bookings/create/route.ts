import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { verifyRequestOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
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

    // Ensure chat_bookings table exists with correct constraint
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS chat_bookings (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          booking_date DATE NOT NULL,
          booking_time TIME NOT NULL,
          preferred_method TEXT NOT NULL CHECK (preferred_method IN ('teams', 'google-meet', 'phone')),
          share_screen BOOLEAN,
          record_conversation BOOLEAN,
          notes TEXT,
          status TEXT DEFAULT 'requested' CHECK (status IN ('pending', 'requested', 'confirmed', 'cancelled', 'completed')),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(booking_date, booking_time)
        )
      `);
      
      // Try to update the constraint if table already exists with old constraint
      try {
        await pool.query(`
          ALTER TABLE chat_bookings DROP CONSTRAINT IF EXISTS chat_bookings_status_check;
          ALTER TABLE chat_bookings ADD CONSTRAINT chat_bookings_status_check 
            CHECK (status IN ('pending', 'requested', 'confirmed', 'cancelled', 'completed'));
        `);
      } catch (alterError: any) {
        // Constraint might already be correct, ignore error
        console.log('[API] Constraint update (if needed):', alterError.message);
      }
    } catch (createError: any) {
      console.error('[API] Error ensuring chat_bookings table exists:', createError);
      // Continue anyway - might already exist
    }

    const body = await request.json();
    const { bookingDate, bookingTime, preferredMethod, shareScreen, recordConversation, notes } = body;

    if (!bookingDate || !bookingTime || !preferredMethod) {
      return NextResponse.json(
        { error: 'Missing required fields: bookingDate, bookingTime, preferredMethod' },
        { status: 400 }
      );
    }

    if (!['teams', 'google-meet', 'phone'].includes(preferredMethod)) {
      return NextResponse.json(
        { error: 'Invalid preferredMethod. Must be teams, google-meet, or phone' },
        { status: 400 }
      );
    }

    // Validate shareScreen and recordConversation for Teams/Google Meet
    if ((preferredMethod === 'teams' || preferredMethod === 'google-meet') && 
        (shareScreen === null || shareScreen === undefined || recordConversation === null || recordConversation === undefined)) {
      return NextResponse.json(
        { error: 'shareScreen and recordConversation are required for Teams and Google Meet' },
        { status: 400 }
      );
    }

    // Normalize booking time to HH:MM:SS format
    const normalizedTime = bookingTime.includes(':') && bookingTime.split(':').length === 2 
      ? `${bookingTime}:00` 
      : bookingTime;

    // Check if slot is already booked (including requested status)
    const existingBooking = await pool.query(
      `SELECT id FROM chat_bookings 
       WHERE booking_date = $1 AND booking_time = $2 AND status IN ('pending', 'requested', 'confirmed')`,
      [bookingDate, normalizedTime]
    );

    if (existingBooking.rows.length > 0) {
      return NextResponse.json(
        { error: 'This time slot is already booked' },
        { status: 409 }
      );
    }

    // Validate notes word count (200 word limit)
    if (notes) {
      const wordCount = notes.trim().split(/\s+/).filter(Boolean).length;
      if (wordCount > 200) {
        return NextResponse.json(
          { error: 'Notes cannot exceed 200 words' },
          { status: 400 }
        );
      }
    }

    // Create booking with status 'requested' (admin will confirm)
    const result = await pool.query(
      `INSERT INTO chat_bookings 
       (user_id, booking_date, booking_time, preferred_method, share_screen, record_conversation, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'requested')
       RETURNING id, booking_date, booking_time, preferred_method, share_screen, record_conversation, notes, status, created_at`,
      [
        userId,
        bookingDate,
        normalizedTime,
        preferredMethod,
        preferredMethod === 'phone' ? null : shareScreen,
        preferredMethod === 'phone' ? null : recordConversation,
        notes || null,
      ]
    );

    return NextResponse.json({
      success: true,
      booking: result.rows[0],
    });
  } catch (error: any) {
    console.error('[API] Create booking error:', error);
    return NextResponse.json(
      { error: 'Failed to create booking', details: error.message },
      { status: 500 }
    );
  }
}

