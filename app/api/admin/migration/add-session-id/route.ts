/**
 * Migration: Add session_id column to l1_events table
 * This migration adds session tracking capability to all events
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';
import * as fs from 'fs';
import * as path from 'path';

export const dynamic = 'force-dynamic';

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

    // Read migration script
    const migrationPath = path.join(process.cwd(), 'migrations', 'add-session-id-to-l1-events.sql');
    const migrationScript = fs.readFileSync(migrationPath, 'utf-8');

    // Execute the migration
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      await client.query(migrationScript);
      await client.query('COMMIT');
      
      return NextResponse.json({
        success: true,
        message: 'Session ID column added to l1_events table successfully',
      });
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('[Migration] Error adding session_id column:', error);
      return NextResponse.json({
        success: false,
        error: error.message,
        details: error.detail || error.hint || '',
      }, { status: 500 });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[Migration] Error:', error);
    return NextResponse.json(
      { error: 'Failed to run migration', details: error.message },
      { status: 500 }
    );
  }
}

