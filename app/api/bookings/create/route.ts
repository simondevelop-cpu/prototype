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

    // Check if slot is already booked
    const existingBooking = await pool.query(
      `SELECT id FROM chat_bookings 
       WHERE booking_date = $1 AND booking_time = $2 AND status IN ('pending', 'confirmed')`,
      [bookingDate, normalizedTime]
    );

    if (existingBooking.rows.length > 0) {
      return NextResponse.json(
        { error: 'This time slot is already booked' },
        { status: 409 }
      );
    }

    // Create booking
    const result = await pool.query(
      `INSERT INTO chat_bookings 
       (user_id, booking_date, booking_time, preferred_method, share_screen, record_conversation, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'confirmed')
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

