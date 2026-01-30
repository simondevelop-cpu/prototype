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

    // Get all available slots
    const result = await pool.query(
      `SELECT slot_date, slot_time 
       FROM available_slots 
       WHERE is_available = TRUE
       ORDER BY slot_date, slot_time`
    );

    const slots = result.rows.map((row: any) => {
      const timeStr = typeof row.slot_time === 'string' 
        ? row.slot_time.slice(0, 5)
        : String(row.slot_time).slice(0, 5);
      return `${row.slot_date}_${timeStr}`;
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

    const body = await request.json();
    const { slotDate, slotTime, isAvailable } = body;

    if (!slotDate || !slotTime) {
      return NextResponse.json(
        { error: 'Missing required fields: slotDate, slotTime' },
        { status: 400 }
      );
    }

    // Normalize time to HH:MM:SS format
    const normalizedTime = slotTime.includes(':') && slotTime.split(':').length === 2 
      ? `${slotTime}:00` 
      : slotTime;

    // Upsert the slot availability
    await pool.query(
      `INSERT INTO available_slots (slot_date, slot_time, is_available, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (slot_date, slot_time)
       DO UPDATE SET is_available = $3, updated_at = NOW()`,
      [slotDate, normalizedTime, isAvailable !== false]
    );

    return NextResponse.json({
      success: true,
      message: 'Slot availability updated',
    });
  } catch (error: any) {
    console.error('[API] Update available slot error:', error);
    return NextResponse.json(
      { error: 'Failed to update slot availability', details: error.message },
      { status: 500 }
    );
  }
}

