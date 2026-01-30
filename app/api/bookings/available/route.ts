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

    // Get available slots (from admin-marked available slots)
    // For now, we'll use a simple approach: check for slots marked as available
    // In a full implementation, this would query a separate available_slots table
    // For MVP, we'll return slots that aren't booked yet
    
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Get all bookings in the date range
    let bookingsQuery = `
      SELECT booking_date, booking_time 
      FROM chat_bookings 
      WHERE status IN ('pending', 'confirmed')
    `;
    const bookingsParams: any[] = [];

    if (startDate && endDate) {
      bookingsQuery += ` AND booking_date BETWEEN $1 AND $2`;
      bookingsParams.push(startDate, endDate);
    }

    const bookingsResult = await pool.query(bookingsQuery, bookingsParams);
    const bookedSlots = new Set(
      bookingsResult.rows.map((row: any) => {
        // Handle both TIME and TEXT formats from database
        const timeStr = typeof row.booking_time === 'string' 
          ? row.booking_time.slice(0, 5) // Extract HH:MM from HH:MM:SS
          : String(row.booking_time).slice(0, 5);
        return `${row.booking_date}_${timeStr}`;
      })
    );

    // Generate available slots (hourly from 9am to 5pm for next 4 weeks)
    const availableSlots: string[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let week = 0; week < 4; week++) {
      for (let day = 0; day < 7; day++) {
        const date = new Date(today);
        date.setDate(today.getDate() + (week * 7) + day);
        
        // Skip past dates
        if (date < today) continue;

        // Generate hourly slots from 9am to 5pm
        for (let hour = 9; hour < 18; hour++) {
          const timeStr = `${hour.toString().padStart(2, '0')}:00`;
          const slotKey = `${date.toISOString().split('T')[0]}_${timeStr}`;
          
          // Only include if not already booked
          if (!bookedSlots.has(slotKey)) {
            availableSlots.push(slotKey);
          }
        }
      }
    }

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

