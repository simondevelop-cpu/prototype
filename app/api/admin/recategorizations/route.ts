import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
});

/**
 * GET /api/admin/recategorizations
 * Fetch all user recategorizations for admin review
 */
export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch recategorization logs
    const result = await pool.query(`
      SELECT 
        cl.id,
        cl.description_pattern,
        cl.original_category,
        cl.corrected_category,
        cl.frequency,
        cl.last_seen,
        cl.created_at,
        u.email as user_email,
        false as reviewed
      FROM categorization_learning cl
      JOIN users u ON cl.user_id = u.id
      ORDER BY cl.last_seen DESC
    `);

    return NextResponse.json({
      recategorizations: result.rows,
      count: result.rows.length,
    });
  } catch (error: any) {
    console.error('Error fetching recategorizations:', error);
    
    if (error.message?.includes('does not exist')) {
      return NextResponse.json({
        recategorizations: [],
        count: 0,
        warning: 'Tables not initialized yet',
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch recategorizations', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/recategorizations/[id]
 * Mark a recategorization as reviewed
 */
export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id, reviewed } = await request.json();

    // For now, we'll just return success
    // In the future, you could add a 'reviewed' column to categorization_learning table
    
    return NextResponse.json({ success: true, id, reviewed });
  } catch (error: any) {
    console.error('Error updating recategorization:', error);
    return NextResponse.json(
      { error: 'Failed to update recategorization', details: error.message },
      { status: 500 }
    );
  }
}

