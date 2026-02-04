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

    // Determine table name (new architecture with fallback)
    let tableName = 'l1_survey_responses';
    try {
      const tableCheck = await pool.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = $1`,
        [tableName]
      );
      if (tableCheck.rows.length === 0) {
        tableName = 'survey_responses'; // Fallback to old name
        // Ensure old table exists if using fallback
        try {
          await pool.query(`
            CREATE TABLE IF NOT EXISTS survey_responses (
              id SERIAL PRIMARY KEY,
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              q1_data JSONB,
              q2_data JSONB,
              q3_data JSONB,
              q4_data TEXT,
              q5_data TEXT,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
          `);
        } catch (createError: any) {
          console.error('[API] Error ensuring survey_responses table exists:', createError);
        }
      }
    } catch (e) {
      tableName = 'survey_responses'; // Fallback on error
    }

    // Get all survey responses with user information
    let result;
    try {
      result = await pool.query(
        `SELECT 
          sr.id,
          sr.user_id,
          u.email as user_email,
          u.display_name,
          sr.q1_data,
          sr.q2_data,
          sr.q3_data,
          sr.q4_data,
          sr.q5_data,
          sr.created_at
         FROM ${tableName} sr
         JOIN users u ON sr.user_id = u.id
         ORDER BY sr.created_at DESC
         LIMIT 500`
      );
    } catch (error: any) {
      // If table doesn't exist, return empty array
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return NextResponse.json({
          success: true,
          responses: [],
        });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      responses: result.rows.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        userEmail: row.user_email,
        displayName: row.display_name,
        q1: row.q1_data,
        q2: row.q2_data,
        q3: row.q3_data,
        q4: row.q4_data,
        q5: row.q5_data,
        createdAt: row.created_at,
      })),
    });
  } catch (error: any) {
    console.error('[API] Get survey responses error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch survey responses', details: error.message },
      { status: 500 }
    );
  }
}

