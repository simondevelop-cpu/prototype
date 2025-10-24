import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL !== 'false' ? { rejectUnauthorized: false } : false,
});

/**
 * GET /api/admin/keywords
 * Fetch all active keywords from the database
 */
export async function GET(request: NextRequest) {
  try {
    const result = await pool.query(
      `SELECT keyword, category, label, score, language 
       FROM admin_keywords 
       WHERE is_active = TRUE 
       ORDER BY score DESC, keyword ASC`
    );

    return NextResponse.json({
      keywords: result.rows,
      count: result.rows.length,
    });
  } catch (error: any) {
    console.error('[API] Error fetching keywords:', error);
    return NextResponse.json(
      { error: 'Failed to fetch keywords' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/keywords
 * Add a new keyword (admin only - TODO: add auth)
 */
export async function POST(request: NextRequest) {
  try {
    const { keyword, category, label, score, language, notes } = await request.json();

    if (!keyword || !category || !label) {
      return NextResponse.json(
        { error: 'Missing required fields: keyword, category, label' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `INSERT INTO admin_keywords (keyword, category, label, score, language, notes) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [
        keyword.toUpperCase(),
        category,
        label,
        score || 8,
        language || 'en',
        notes || null
      ]
    );

    return NextResponse.json({
      success: true,
      keyword: result.rows[0],
    });
  } catch (error: any) {
    console.error('[API] Error adding keyword:', error);
    return NextResponse.json(
      { error: 'Failed to add keyword' },
      { status: 500 }
    );
  }
}

