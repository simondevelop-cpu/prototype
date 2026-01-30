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

    const pool = getPool();
    if (!pool) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    // Get admin-marked available slots
    const availableSlotsResult = await pool.query(
      `SELECT slot_date, slot_time 
       FROM available_slots 
       WHERE is_available = TRUE`
    );
    const adminMarkedSlots = new Set(
      availableSlotsResult.rows.map((row: any) => {
        const timeStr = typeof row.slot_time === 'string' 
          ? row.slot_time.slice(0, 5)
          : String(row.slot_time).slice(0, 5);
        return `${row.slot_date}_${timeStr}`;
      })
    );

    // Get all bookings
    const bookingsResult = await pool.query(
      `SELECT booking_date, booking_time 
       FROM chat_bookings 
       WHERE status IN ('pending', 'confirmed')`
    );
    const bookedSlots = new Set(
      bookingsResult.rows.map((row: any) => {
        const timeStr = typeof row.booking_time === 'string' 
          ? row.booking_time.slice(0, 5)
          : String(row.booking_time).slice(0, 5);
        return `${row.booking_date}_${timeStr}`;
      })
    );

    // Return only admin-marked slots that aren't booked
    const availableSlots: string[] = [];
    adminMarkedSlots.forEach(slotKey => {
      if (!bookedSlots.has(slotKey)) {
        availableSlots.push(slotKey);
      }
    });

    return NextResponse.json({ 
      success: true,
      availableSlots: availableSlots.map(slot => {
        const [date, time] = slot.split('_');
        return { date, time: time.slice(0, 5) }; // Return time as HH:MM
      })
    });
  } catch (error: any) {
    console.error('[API] Get available slots error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available slots', details: error.message },
      { status: 500 }
    );
  }
}

