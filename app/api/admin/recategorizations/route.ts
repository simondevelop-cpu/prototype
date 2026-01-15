import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/lib/admin-constants';

export const dynamic = 'force-dynamic';

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
    // First check if the table and columns exist
    const tableCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'categorization_learning'
    `);
    
    if (tableCheck.rows.length === 0) {
      // Table doesn't exist yet
      return NextResponse.json({
        recategorizations: [],
        count: 0,
        warning: 'Categorization learning table not initialized yet',
      });
    }
    
    const columns = tableCheck.rows.map(row => row.column_name);
    const hasRequiredColumns = 
      columns.includes('description_pattern') &&
      columns.includes('user_id');
    
    if (!hasRequiredColumns) {
      return NextResponse.json({
        recategorizations: [],
        count: 0,
        warning: 'Table schema incomplete',
      });
    }
    
    // Build query based on available columns
    const selectFields = ['cl.id', 'cl.description_pattern', 'u.email as user_email'];
    
    // Handle both old and new schema for category/label
    if (columns.includes('corrected_category')) {
      selectFields.push('cl.corrected_category');
    } else if (columns.includes('category')) {
      selectFields.push('cl.category as corrected_category'); // Alias for consistency
    }
    
    if (columns.includes('corrected_label')) {
      selectFields.push('cl.corrected_label');
    } else if (columns.includes('label')) {
      selectFields.push('cl.label as corrected_label'); // Alias for consistency
    }
    
    if (columns.includes('frequency')) selectFields.push('cl.frequency');
    if (columns.includes('last_used')) selectFields.push('cl.last_used');
    if (columns.includes('created_at')) selectFields.push('cl.created_at');
    
    const result = await pool.query(`
      SELECT ${selectFields.join(', ')}
      FROM categorization_learning cl
      JOIN users u ON cl.user_id = u.id
      ORDER BY ${columns.includes('last_used') ? 'cl.last_used' : 'cl.created_at'} DESC
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

