/**
 * Delete onboarding_responses table
 * This should only be run AFTER confirming migration is complete and data is in users table
 */

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

    // First, verify migration is complete
    const migrationCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('completed_at', 'motivation', 'emotional_state')
    `);
    
    const hasCompletedAt = migrationCheck.rows.some(row => row.column_name === 'completed_at');
    const hasMotivation = migrationCheck.rows.some(row => row.column_name === 'motivation');
    const hasEmotionalState = migrationCheck.rows.some(row => row.column_name === 'emotional_state');

    if (!hasCompletedAt || !hasMotivation || !hasEmotionalState) {
      return NextResponse.json({
        success: false,
        error: 'Migration not complete',
        message: 'Cannot delete onboarding_responses table - migration is not complete. Please run migration first.',
        migrationRequired: true
      }, { status: 400 });
    }

    // Check if onboarding_responses table exists
    const tableCheck = await pool.query(`
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'onboarding_responses'
      LIMIT 1
    `);

    if (tableCheck.rows.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'onboarding_responses table does not exist (already deleted)',
        tableDeleted: false
      }, { status: 200 });
    }

    // Verify data exists in users table
    const dataCheck = await pool.query(`
      SELECT COUNT(*) as count
      FROM users
      WHERE (completed_at IS NOT NULL 
        OR emotional_state IS NOT NULL 
        OR motivation IS NOT NULL)
      AND email != $1
    `, [ADMIN_EMAIL]);
    
    const usersWithData = parseInt(dataCheck.rows[0]?.count || '0', 10);

    if (usersWithData === 0) {
      return NextResponse.json({
        success: false,
        error: 'No data in users table',
        message: 'Cannot delete onboarding_responses table - no onboarding data found in users table. Please verify migration was successful.',
        usersWithData: 0
      }, { status: 400 });
    }

    // Delete the table
    console.log('[Delete Onboarding Responses] Dropping onboarding_responses table...');
    await pool.query(`DROP TABLE IF EXISTS onboarding_responses CASCADE`);
    
    console.log('[Delete Onboarding Responses] ✅ Table deleted successfully');

    return NextResponse.json({
      success: true,
      message: 'onboarding_responses table deleted successfully',
      tableDeleted: true,
      usersWithData,
      migrationVerified: true
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Delete Onboarding Responses] Error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to delete onboarding_responses table', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check if table exists and migration status
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

    // Check if onboarding_responses table exists
    const tableCheck = await pool.query(`
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'onboarding_responses'
      LIMIT 1
    `);

    const tableExists = tableCheck.rows.length > 0;

    // Check migration status
    const migrationCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('completed_at', 'motivation', 'emotional_state')
    `);
    
    const hasCompletedAt = migrationCheck.rows.some(row => row.column_name === 'completed_at');
    const hasMotivation = migrationCheck.rows.some(row => row.column_name === 'motivation');
    const hasEmotionalState = migrationCheck.rows.some(row => row.column_name === 'emotional_state');
    const migrationComplete = hasCompletedAt && hasMotivation && hasEmotionalState;

    // Count records in onboarding_responses if it exists
    let recordCount = 0;
    if (tableExists) {
      try {
        const countResult = await pool.query(`SELECT COUNT(*) as count FROM onboarding_responses`);
        recordCount = parseInt(countResult.rows[0]?.count || '0', 10);
      } catch (e) {
        // Table might be in use or locked
      }
    }

    // Count users with onboarding data
    let usersWithData = 0;
    if (migrationComplete) {
      try {
        const dataCheck = await pool.query(`
          SELECT COUNT(*) as count
          FROM users
          WHERE (completed_at IS NOT NULL 
            OR emotional_state IS NOT NULL 
            OR motivation IS NOT NULL)
          AND email != $1
        `, [ADMIN_EMAIL]);
        usersWithData = parseInt(dataCheck.rows[0]?.count || '0', 10);
      } catch (e) {
        // Ignore
      }
    }

    return NextResponse.json({
      tableExists,
      recordCount,
      migrationComplete,
      usersWithData,
      canDelete: migrationComplete && usersWithData > 0 && tableExists,
      message: tableExists 
        ? (migrationComplete && usersWithData > 0
          ? 'Table exists and migration is complete. Safe to delete.'
          : 'Table exists but migration is not complete or no data in users table.')
        : 'Table does not exist (already deleted).'
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Delete Onboarding Responses] Status check error:', error);
    return NextResponse.json(
      { error: 'Status check failed', details: error.message },
      { status: 500 }
    );
  }
}

