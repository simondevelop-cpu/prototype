import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { verifyRequestOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // CSRF protection
    if (!verifyRequestOrigin(request)) {
      return NextResponse.json(
        { error: 'Invalid request origin' },
        { status: 403 }
      );
    }

    // Verify authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = decoded.userId || decoded.id || decoded.sub;
    if (!userId) {
      return NextResponse.json({ error: 'Invalid token: no user ID' }, { status: 401 });
    }

    const pool = getPool();
    if (!pool) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const body = await request.json();
    const { q1, q2, q3, q4, q5 } = body;

    // Validate survey data structure
    if (q1 !== undefined && !Array.isArray(q1)) {
      return NextResponse.json(
        { error: 'Invalid q1 data format. Expected array' },
        { status: 400 }
      );
    }
    if (q2 !== undefined && !Array.isArray(q2)) {
      return NextResponse.json(
        { error: 'Invalid q2 data format. Expected array' },
        { status: 400 }
      );
    }
    if (q3 !== undefined && !Array.isArray(q3)) {
      return NextResponse.json(
        { error: 'Invalid q3 data format. Expected array' },
        { status: 400 }
      );
    }
    if (q4 !== undefined && typeof q4 !== 'string' && q4 !== null) {
      return NextResponse.json(
        { error: 'Invalid q4 data format. Expected string or null' },
        { status: 400 }
      );
    }
    if (q5 !== undefined && typeof q5 !== 'string' && q5 !== null) {
      return NextResponse.json(
        { error: 'Invalid q5 data format. Expected string or null' },
        { status: 400 }
      );
    }

    // Validate q5 word count (200 word limit)
    if (q5) {
      const wordCount = q5.trim().split(/\s+/).filter(Boolean).length;
      if (wordCount > 200) {
        return NextResponse.json(
          { error: 'Q5 comments cannot exceed 200 words' },
          { status: 400 }
        );
      }
    }

    // Ensure survey_responses table exists
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
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_survey_responses_user_id ON survey_responses(user_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_survey_responses_created_at ON survey_responses(created_at)`);
    } catch (createError: any) {
      console.error('[API] Error ensuring survey_responses table exists:', createError);
      // Continue anyway - might already exist
    }

    // Insert survey response
    // Safely stringify JSON data, handling circular references and errors
    let q1Json: string;
    let q2Json: string;
    let q3Json: string;
    try {
      q1Json = JSON.stringify(q1 || []);
      q2Json = JSON.stringify(q2 || []);
      q3Json = JSON.stringify(q3 || []);
    } catch (jsonError: any) {
      return NextResponse.json(
        { error: 'Invalid JSON data in survey response', details: jsonError.message },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `INSERT INTO survey_responses (user_id, q1_data, q2_data, q3_data, q4_data, q5_data)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, created_at`,
      [
        userId,
        q1Json,
        q2Json,
        q3Json,
        q4 || null,
        q5 || null,
      ]
    );

    return NextResponse.json({
      success: true,
      responseId: result.rows[0].id,
      createdAt: result.rows[0].created_at,
    });
  } catch (error: any) {
    console.error('[API] Survey submit error:', error);
    return NextResponse.json(
      { error: 'Failed to submit survey', details: error.message },
      { status: 500 }
    );
  }
}

