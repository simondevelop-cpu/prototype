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

    // Use new table name (l1_admin_available_slots) with fallback to old name
    let availableSlotsTableName = 'l1_admin_available_slots';
    try {
      const tableCheck = await pool.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = $1`,
        [availableSlotsTableName]
      );
      if (tableCheck.rows.length === 0) {
        availableSlotsTableName = 'available_slots'; // Fallback to old name
      }
    } catch (e) {
      availableSlotsTableName = 'available_slots'; // Fallback on error
    }

    // Get admin-marked available slots
    const availableSlotsResult = await pool.query(
      `SELECT slot_date, slot_time 
       FROM ${availableSlotsTableName} 
       WHERE is_available = TRUE`
    );
    const adminMarkedSlots = new Set(
      availableSlotsResult.rows.map((row: any) => {
        // Ensure date is in YYYY-MM-DD format
        let dateStr = row.slot_date;
        if (dateStr instanceof Date) {
          const year = dateStr.getFullYear();
          const month = String(dateStr.getMonth() + 1).padStart(2, '0');
          const day = String(dateStr.getDate()).padStart(2, '0');
          dateStr = `${year}-${month}-${day}`;
        } else if (typeof dateStr === 'string' && dateStr.includes('T')) {
          dateStr = dateStr.split('T')[0];
        }
        
        const timeStr = typeof row.slot_time === 'string' 
          ? row.slot_time.slice(0, 5)
          : String(row.slot_time).slice(0, 5);
        return `${dateStr}_${timeStr}`;
      })
    );

    // Use new table name (l1_admin_chat_bookings) with fallback to old name
    let bookingsTableName = 'l1_admin_chat_bookings';
    try {
      const tableCheck = await pool.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = $1`,
        [bookingsTableName]
      );
      if (tableCheck.rows.length === 0) {
        bookingsTableName = 'chat_bookings'; // Fallback to old name
      }
    } catch (e) {
      bookingsTableName = 'chat_bookings'; // Fallback on error
    }

    // Get all bookings
    let bookingsResult;
    try {
      bookingsResult = await pool.query(
        `SELECT booking_date, booking_time 
         FROM ${bookingsTableName} 
         WHERE status IN ('pending', 'requested', 'confirmed')`
      );
    } catch (error: any) {
      // If table doesn't exist, no bookings yet
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        bookingsResult = { rows: [] };
      } else {
        throw error;
      }
    }
    const bookedSlots = new Set(
      bookingsResult.rows.map((row: any) => {
        // Ensure date is in YYYY-MM-DD format
        let dateStr = row.booking_date;
        if (dateStr instanceof Date) {
          const year = dateStr.getFullYear();
          const month = String(dateStr.getMonth() + 1).padStart(2, '0');
          const day = String(dateStr.getDate()).padStart(2, '0');
          dateStr = `${year}-${month}-${day}`;
        } else if (typeof dateStr === 'string' && dateStr.includes('T')) {
          dateStr = dateStr.split('T')[0];
        }
        
        const timeStr = typeof row.booking_time === 'string' 
          ? row.booking_time.slice(0, 5)
          : String(row.booking_time).slice(0, 5);
        return `${dateStr}_${timeStr}`;
      })
    );

    // Generate 20-minute slots for each available hour
    // Each hour marked available by admin generates 3 slots: :00, :20, :40
    const availableSlots: string[] = [];
    adminMarkedSlots.forEach((slotKey: string) => {
      const [date, hourTime] = slotKey.split('_');
      if (!date || !hourTime) {
        console.warn('[API] Invalid slot key format:', slotKey);
        return;
      }
      
      // Extract hour from HH:MM format
      const hourMatch = hourTime.match(/^(\d{2}):/);
      if (!hourMatch) {
        console.warn('[API] Invalid time format in slot key:', slotKey);
        return;
      }
      
      const hour = parseInt(hourMatch[1], 10);
      if (isNaN(hour) || hour < 0 || hour > 23) {
        console.warn('[API] Invalid hour in slot key:', slotKey);
        return;
      }
      
      // Generate 3 slots per hour: :00, :20, :40
      ['00', '20', '40'].forEach(minutes => {
        const slotTime = `${hour.toString().padStart(2, '0')}:${minutes}`;
        const fullSlotKey = `${date}_${slotTime}`;
        
        // Only add if not already booked
        if (!bookedSlots.has(fullSlotKey)) {
          availableSlots.push(fullSlotKey);
        }
      });
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

