import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL !== 'false' ? { rejectUnauthorized: false } : false,
});

/**
 * GET /api/admin/merchants
 * Fetch all active merchant patterns from the database
 */
export async function GET(request: NextRequest) {
  try {
    const result = await pool.query(
      `SELECT merchant_pattern, category, label, score 
       FROM admin_merchants 
       WHERE is_active = TRUE 
       ORDER BY score DESC, merchant_pattern ASC`
    );

    return NextResponse.json({
      merchants: result.rows,
      count: result.rows.length,
    });
  } catch (error: any) {
    console.error('[API] Error fetching merchants:', error);
    return NextResponse.json(
      { error: 'Failed to fetch merchants' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/merchants
 * Add a new merchant pattern (admin only - TODO: add auth)
 */
export async function POST(request: NextRequest) {
  try {
    const { merchant_pattern, category, label, score, notes } = await request.json();

    if (!merchant_pattern || !category || !label) {
      return NextResponse.json(
        { error: 'Missing required fields: merchant_pattern, category, label' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `INSERT INTO admin_merchants (merchant_pattern, category, label, score, notes) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [merchant_pattern.toUpperCase(), category, label, score || 10, notes || null]
    );

    return NextResponse.json({
      success: true,
      merchant: result.rows[0],
    });
  } catch (error: any) {
    console.error('[API] Error adding merchant:', error);
    
    if (error.code === '23505') { // Unique constraint violation
      return NextResponse.json(
        { error: 'Merchant pattern already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to add merchant' },
      { status: 500 }
    );
  }
}

