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

    // Use new table name (l1_admin_available_slots) with fallback to old name
    let tableName = 'l1_admin_available_slots';
    try {
      const tableCheck = await pool.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = $1`,
        [tableName]
      );
      if (tableCheck.rows.length === 0) {
        tableName = 'available_slots'; // Fallback to old name
      }
    } catch (e) {
      tableName = 'available_slots'; // Fallback on error
    }

    // Get all available slots
    const result = await pool.query(
      `SELECT slot_date, slot_time 
       FROM ${tableName} 
       WHERE is_available = TRUE
       ORDER BY slot_date, slot_time`
    );

    const slots = result.rows.map((row: any) => {
      // Ensure date is in YYYY-MM-DD format (handle Date objects)
      let dateStr = row.slot_date;
      if (dateStr instanceof Date) {
        const year = dateStr.getFullYear();
        const month = String(dateStr.getMonth() + 1).padStart(2, '0');
        const day = String(dateStr.getDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
      } else if (typeof dateStr === 'string' && dateStr.includes('T')) {
        // If it's an ISO string, extract just the date part
        dateStr = dateStr.split('T')[0];
      }
      
      const timeStr = typeof row.slot_time === 'string' 
        ? row.slot_time.slice(0, 5)
        : String(row.slot_time).slice(0, 5);
      
      const slotKey = `${dateStr}_${timeStr}`;
      return slotKey;
    });
    return NextResponse.json({
      success: true,
      availableSlots: Array.from(slots),
    });
  } catch (error: any) {
    console.error('[API] Get available slots error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available slots', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    // Use new table name (l1_admin_available_slots) with fallback to old name
    let tableName = 'l1_admin_available_slots';
    try {
      const tableCheck = await pool.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = $1`,
        [tableName]
      );
      if (tableCheck.rows.length === 0) {
        tableName = 'available_slots'; // Fallback to old name
      }
    } catch (e) {
      tableName = 'available_slots'; // Fallback on error
    }

    const body = await request.json();
    const { slotDate, slotTime, isAvailable } = body;

    if (!slotDate || !slotTime) {
      return NextResponse.json(
        { error: 'Missing required fields: slotDate, slotTime' },
        { status: 400 }
      );
    }

    // Validate and normalize time to HH:MM:SS format
    const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/;
    if (!timeRegex.test(slotTime)) {
      return NextResponse.json(
        { error: 'Invalid time format. Expected HH:MM or HH:MM:SS' },
        { status: 400 }
      );
    }
    const normalizedTime = slotTime.includes(':') && slotTime.split(':').length === 2 
      ? `${slotTime}:00` 
      : slotTime;

    // Validate and normalize date to YYYY-MM-DD format
    const dateRegex = /^\d{4}-\d{2}-\d{2}/;
    let normalizedDate = slotDate;
    if (normalizedDate.includes('T')) {
      normalizedDate = normalizedDate.split('T')[0];
    }
    if (!dateRegex.test(normalizedDate)) {
      return NextResponse.json(
        { error: 'Invalid date format. Expected YYYY-MM-DD' },
        { status: 400 }
      );
    }

    // Upsert the slot availability
    const result = await pool.query(
      `INSERT INTO ${tableName} (slot_date, slot_time, is_available, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (slot_date, slot_time)
       DO UPDATE SET is_available = $3, updated_at = NOW()
       RETURNING slot_date, slot_time, is_available`,
      [normalizedDate, normalizedTime, isAvailable !== false]
    );

    return NextResponse.json({
      success: true,
      message: 'Slot availability updated',
      slot: {
        date: result.rows[0].slot_date,
        time: result.rows[0].slot_time,
        isAvailable: result.rows[0].is_available,
      },
    });
  } catch (error: any) {
    console.error('[API] Update available slot error:', error);
    return NextResponse.json(
      { error: 'Failed to update slot availability', details: error.message },
      { status: 500 }
    );
  }
}

