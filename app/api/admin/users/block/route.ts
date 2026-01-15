/**
 * Block/Unblock User API
 * Allows admin to enable/disable user access (blocks login if disabled)
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

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

    const body = await request.json();
    const { userId, isActive } = body;

    if (!userId || typeof isActive !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing userId or isActive' },
        { status: 400 }
      );
    }

    // Check if is_active column exists (schema-adaptive)
    const schemaCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name = 'is_active'
    `);
    
    const hasIsActive = schemaCheck.rows.length > 0;

    if (!hasIsActive) {
      // Add column if it doesn't exist
      await pool.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active)
      `);
    }

    // Update user is_active status
    await pool.query(
      `UPDATE users SET is_active = $1 WHERE id = $2`,
      [isActive, userId]
    );

    return NextResponse.json({
      success: true,
      message: `User ${isActive ? 'enabled' : 'blocked'} successfully`,
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Block User API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update user status', details: error.message },
      { status: 500 }
    );
  }
}

