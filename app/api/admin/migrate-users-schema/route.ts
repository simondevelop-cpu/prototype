import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const ADMIN_EMAIL = 'admin@canadianinsights.ca';

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

    const migrations: string[] = [];

    console.log('[Users Schema Migration] Starting migration...');

    // Check if login_attempts column exists
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name = 'login_attempts'
    `);

    if (columnCheck.rows.length === 0) {
      // Add login_attempts column
      console.log('[Users Schema Migration] Adding login_attempts column...');
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN login_attempts INTEGER DEFAULT 0
      `);
      migrations.push('Added login_attempts column to users table');
      console.log('[Users Schema Migration] ✅ Added login_attempts column');
    } else {
      migrations.push('login_attempts column already exists');
      console.log('[Users Schema Migration] ℹ️ login_attempts column already exists');
    }

    return NextResponse.json({
      success: true,
      message: 'Users schema migration completed',
      migrations
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Users Schema Migration] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Migration failed',
      details: error.message
    }, { status: 500 });
  }
}

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

    // Check current schema
    const result = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);

    const hasLoginAttempts = result.rows.some(row => row.column_name === 'login_attempts');

    return NextResponse.json({
      current_schema: result.rows,
      needs_migration: !hasLoginAttempts,
      missing_columns: hasLoginAttempts ? [] : ['login_attempts']
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Users Schema Check] Error:', error);
    return NextResponse.json({
      error: 'Schema check failed',
      details: error.message
    }, { status: 500 });
  }
}

