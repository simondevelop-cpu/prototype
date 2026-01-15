/**
 * Intent Categories API
 * Returns unique motivation/intent values from users table for filtering
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

    // Check if users table has motivation column (schema-adaptive)
    const schemaCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name = 'motivation'
    `);
    
    const hasMotivation = schemaCheck.rows.length > 0;

    if (!hasMotivation) {
      // Fallback to onboarding_responses table
      const result = await pool.query(`
        SELECT DISTINCT motivation
        FROM onboarding_responses
        WHERE motivation IS NOT NULL
        ORDER BY motivation
      `);
      return NextResponse.json({
        success: true,
        categories: result.rows.map(row => row.motivation).filter(Boolean),
      }, { status: 200 });
    }

    // Get unique motivation values from users table
    const result = await pool.query(`
      SELECT DISTINCT motivation
      FROM users
      WHERE motivation IS NOT NULL
        AND email != $1
      ORDER BY motivation
    `, [ADMIN_EMAIL]);

    return NextResponse.json({
      success: true,
      categories: result.rows.map(row => row.motivation).filter(Boolean),
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Intent Categories API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch intent categories', details: error.message },
      { status: 500 }
    );
  }
}

