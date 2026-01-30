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

    // Ensure table exists
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS available_slots (
          id SERIAL PRIMARY KEY,
          slot_date DATE NOT NULL,
          slot_time TIME NOT NULL,
          is_available BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(slot_date, slot_time)
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_available_slots_date_time ON available_slots(slot_date, slot_time)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_available_slots_available ON available_slots(is_available)`);
    } catch (createError: any) {
      console.error('[API] Error ensuring available_slots table exists:', createError);
      // Continue anyway - might already exist
    }

    // Get admin-marked available slots
    const availableSlotsResult = await pool.query(
      `SELECT slot_date, slot_time 
       FROM available_slots 
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

    // Ensure chat_bookings table exists
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
    } catch (createError: any) {
      console.error('[API] Error ensuring chat_bookings table exists:', createError);
      // Continue anyway - might already exist
    }

    // Get all bookings
    let bookingsResult;
    try {
      bookingsResult = await pool.query(
        `SELECT booking_date, booking_time 
         FROM chat_bookings 
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
      // Extract hour from HH:MM format
      const hour = parseInt(hourTime.split(':')[0]);
      
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

