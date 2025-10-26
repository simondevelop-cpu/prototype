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
    
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'admin' && decoded.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('[Onboarding Schema Migration] Starting migration...');

    // Check current schema
    const schemaCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'onboarding_responses'
    `);

    const existingColumns = schemaCheck.rows.map(row => row.column_name);
    console.log('[Onboarding Schema Migration] Existing columns:', existingColumns);

    const migrations = [];

    // Add last_step column if missing
    if (!existingColumns.includes('last_step')) {
      await pool.query(`
        ALTER TABLE onboarding_responses 
        ADD COLUMN last_step INTEGER DEFAULT 0
      `);
      migrations.push('Added last_step column');
      console.log('[Onboarding Schema Migration] ✅ Added last_step column');
    }

    // Add completed_at column if missing
    if (!existingColumns.includes('completed_at')) {
      await pool.query(`
        ALTER TABLE onboarding_responses 
        ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE
      `);
      migrations.push('Added completed_at column');
      console.log('[Onboarding Schema Migration] ✅ Added completed_at column');
    }

    // Add acquisition_other column if missing
    if (!existingColumns.includes('acquisition_other')) {
      await pool.query(`
        ALTER TABLE onboarding_responses 
        ADD COLUMN acquisition_other TEXT
      `);
      migrations.push('Added acquisition_other column');
      console.log('[Onboarding Schema Migration] ✅ Added acquisition_other column');
    }

    // Add updated_at column if missing
    if (!existingColumns.includes('updated_at')) {
      await pool.query(`
        ALTER TABLE onboarding_responses 
        ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      `);
      migrations.push('Added updated_at column');
      console.log('[Onboarding Schema Migration] ✅ Added updated_at column');
    }

    if (migrations.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Schema is already up to date',
        migrations: []
      }, { status: 200 });
    }

    return NextResponse.json({
      success: true,
      message: 'Schema migration completed successfully',
      migrations
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Onboarding Schema Migration] Error:', error);
    return NextResponse.json(
      { error: 'Migration failed', details: error.message },
      { status: 500 }
    );
  }
}

