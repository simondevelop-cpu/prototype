import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';

export const dynamic = 'force-dynamic';

/**
 * Create new tables and migrate data from old tables
 * This ensures the new tables exist and have the migrated data before we delete old tables
 */
export async function POST(request: NextRequest) {
  try {
    // Admin authentication
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

    const results: any[] = [];

    // 1. Create and migrate l2_user_categorization_learning
    try {
      // Create the new table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS l2_user_categorization_learning (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          description_pattern TEXT NOT NULL,
          original_category TEXT,
          original_label TEXT,
          corrected_category TEXT NOT NULL,
          corrected_label TEXT NOT NULL,
          frequency INTEGER DEFAULT 1,
          last_used TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, description_pattern)
        )
      `);

      // Check if old table exists and has data
      const oldTableCheck = await pool.query(`
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'categorization_learning'
      `);

      if (oldTableCheck.rows.length > 0) {
        // Check if data already migrated
        const existingCount = await pool.query(`
          SELECT COUNT(*) as count FROM l2_user_categorization_learning
        `);
        const existingCountNum = parseInt(existingCount.rows[0]?.count || '0', 10);

        if (existingCountNum === 0) {
          // Migrate data from old table
          // Handle both old schema (category, label) and new schema (corrected_category, corrected_label)
          await pool.query(`
            INSERT INTO l2_user_categorization_learning 
            (user_id, description_pattern, original_category, original_label, corrected_category, corrected_label, frequency, last_used, created_at)
            SELECT 
              user_id,
              description_pattern,
              COALESCE(original_category, NULL) as original_category,
              COALESCE(original_label, NULL) as original_label,
              COALESCE(corrected_category, category, '') as corrected_category,
              COALESCE(corrected_label, label, '') as corrected_label,
              frequency,
              last_used,
              created_at
            FROM categorization_learning
            ON CONFLICT (user_id, description_pattern) DO NOTHING
          `);

          const migratedCount = await pool.query(`
            SELECT COUNT(*) as count FROM l2_user_categorization_learning
          `);
          results.push({
            table: 'l2_user_categorization_learning',
            action: 'created_and_migrated',
            rowsMigrated: parseInt(migratedCount.rows[0]?.count || '0', 10),
          });
        } else {
          results.push({
            table: 'l2_user_categorization_learning',
            action: 'already_exists',
            rowsCount: existingCountNum,
          });
        }
      } else {
        results.push({
          table: 'l2_user_categorization_learning',
          action: 'created',
          rowsMigrated: 0,
        });
      }
    } catch (error: any) {
      results.push({
        table: 'l2_user_categorization_learning',
        action: 'error',
        error: error.message,
      });
    }

    // 2. Create and migrate l1_admin_chat_bookings
    try {
      // Create the new table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS l1_admin_chat_bookings (
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

      // Check if old table exists and has data
      const oldTableCheck = await pool.query(`
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'chat_bookings'
      `);

      if (oldTableCheck.rows.length > 0) {
        // Check if data already migrated
        const existingCount = await pool.query(`
          SELECT COUNT(*) as count FROM l1_admin_chat_bookings
        `);
        const existingCountNum = parseInt(existingCount.rows[0]?.count || '0', 10);

        if (existingCountNum === 0) {
          // Migrate data from old table
          await pool.query(`
            INSERT INTO l1_admin_chat_bookings 
            (user_id, booking_date, booking_time, preferred_method, share_screen, record_conversation, notes, status, created_at, updated_at)
            SELECT 
              user_id,
              booking_date,
              booking_time,
              preferred_method,
              share_screen,
              record_conversation,
              notes,
              status,
              created_at,
              updated_at
            FROM chat_bookings
            ON CONFLICT (booking_date, booking_time) DO NOTHING
          `);

          const migratedCount = await pool.query(`
            SELECT COUNT(*) as count FROM l1_admin_chat_bookings
          `);
          results.push({
            table: 'l1_admin_chat_bookings',
            action: 'created_and_migrated',
            rowsMigrated: parseInt(migratedCount.rows[0]?.count || '0', 10),
          });
        } else {
          results.push({
            table: 'l1_admin_chat_bookings',
            action: 'already_exists',
            rowsCount: existingCountNum,
          });
        }
      } else {
        results.push({
          table: 'l1_admin_chat_bookings',
          action: 'created',
          rowsMigrated: 0,
        });
      }
    } catch (error: any) {
      results.push({
        table: 'l1_admin_chat_bookings',
        action: 'error',
        error: error.message,
      });
    }

    // 3. Create and migrate l1_admin_available_slots
    try {
      // Create the new table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS l1_admin_available_slots (
          id SERIAL PRIMARY KEY,
          slot_date DATE NOT NULL,
          slot_time TIME NOT NULL,
          is_available BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(slot_date, slot_time)
        )
      `);

      // Create indexes
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_l1_admin_available_slots_date_time 
        ON l1_admin_available_slots(slot_date, slot_time)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_l1_admin_available_slots_available 
        ON l1_admin_available_slots(is_available)
      `);

      // Check if old table exists and has data
      const oldTableCheck = await pool.query(`
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'available_slots'
      `);

      if (oldTableCheck.rows.length > 0) {
        // Check if data already migrated
        const existingCount = await pool.query(`
          SELECT COUNT(*) as count FROM l1_admin_available_slots
        `);
        const existingCountNum = parseInt(existingCount.rows[0]?.count || '0', 10);

        if (existingCountNum === 0) {
          // Migrate data from old table
          await pool.query(`
            INSERT INTO l1_admin_available_slots 
            (slot_date, slot_time, is_available, created_at, updated_at)
            SELECT 
              slot_date,
              slot_time,
              is_available,
              created_at,
              updated_at
            FROM available_slots
            ON CONFLICT (slot_date, slot_time) DO NOTHING
          `);

          const migratedCount = await pool.query(`
            SELECT COUNT(*) as count FROM l1_admin_available_slots
          `);
          results.push({
            table: 'l1_admin_available_slots',
            action: 'created_and_migrated',
            rowsMigrated: parseInt(migratedCount.rows[0]?.count || '0', 10),
          });
        } else {
          results.push({
            table: 'l1_admin_available_slots',
            action: 'already_exists',
            rowsCount: existingCountNum,
          });
        }
      } else {
        results.push({
          table: 'l1_admin_available_slots',
          action: 'created',
          rowsMigrated: 0,
        });
      }
    } catch (error: any) {
      results.push({
        table: 'l1_admin_available_slots',
        action: 'error',
        error: error.message,
      });
    }

    return NextResponse.json({
      success: true,
      results,
      message: 'Tables created and data migrated successfully',
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Create and Migrate Tables] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create and migrate tables', details: error.message },
      { status: 500 }
    );
  }
}

