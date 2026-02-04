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
    // Check for l2_user_categorization_learning (new) or admin_categorization_learning (old) or categorization_learning (legacy)
    let learningTable = 'l2_user_categorization_learning';
    let hasTable = false;
    try {
      const newTableCheck = await pool.query(`
        SELECT 1 FROM information_schema.tables WHERE table_name = 'l2_user_categorization_learning' LIMIT 1
      `);
      if (newTableCheck.rows.length > 0) {
        learningTable = 'l2_user_categorization_learning';
        hasTable = true;
      } else {
        const adminTableCheck = await pool.query(`
          SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_categorization_learning' LIMIT 1
        `);
        if (adminTableCheck.rows.length > 0) {
          learningTable = 'admin_categorization_learning';
          hasTable = true;
        } else {
          const legacyTableCheck = await pool.query(`
            SELECT 1 FROM information_schema.tables WHERE table_name = 'categorization_learning' LIMIT 1
          `);
          if (legacyTableCheck.rows.length > 0) {
            learningTable = 'categorization_learning';
            hasTable = true;
          }
        }
      }
    } catch (e) {
      // Table check failed
    }
    
    if (!hasTable) {
      // Table doesn't exist yet
      return NextResponse.json({
        recategorizations: [],
        count: 0,
        warning: 'Categorization learning table not initialized yet',
      });
    }
    
    // Check columns for the determined table
    const tableCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1
    `, [learningTable]);
    
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
    const selectFields = ['cl.id', 'cl.description_pattern', 'cl.user_id'];
    
    // Handle both old and new schema for category/label
    if (columns.includes('original_category')) {
      selectFields.push('cl.original_category');
    }
    
    if (columns.includes('corrected_category')) {
      selectFields.push('cl.corrected_category');
    } else if (columns.includes('category')) {
      selectFields.push('cl.category as corrected_category'); // Alias for consistency
    }
    
    if (columns.includes('frequency')) selectFields.push('cl.frequency');
    if (columns.includes('last_used')) selectFields.push('cl.last_used');
    if (columns.includes('created_at')) selectFields.push('cl.created_at');
    if (columns.includes('reviewed')) selectFields.push('cl.reviewed');
    
    // Order by reviewed status (unreviewed first), then by date (newest first)
    const orderByClause = columns.includes('reviewed')
      ? `ORDER BY cl.reviewed ASC NULLS FIRST, ${columns.includes('last_used') ? 'cl.last_used' : 'cl.created_at'} DESC`
      : `ORDER BY ${columns.includes('last_used') ? 'cl.last_used' : 'cl.created_at'} DESC`;
    
    const result = await pool.query(`
      SELECT ${selectFields.join(', ')}
      FROM ${learningTable} cl
      ${orderByClause}
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

    // Determine which table to use
    let learningTable = 'l2_user_categorization_learning';
    try {
      const newTableCheck = await pool.query(`
        SELECT 1 FROM information_schema.tables WHERE table_name = 'l2_user_categorization_learning' LIMIT 1
      `);
      if (newTableCheck.rows.length === 0) {
        const adminTableCheck = await pool.query(`
          SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_categorization_learning' LIMIT 1
        `);
        if (adminTableCheck.rows.length > 0) {
          learningTable = 'admin_categorization_learning';
        } else {
          learningTable = 'categorization_learning';
        }
      }
    } catch (e) {
      // Table check failed
    }

    // Check if reviewed column exists
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1 AND column_name = 'reviewed'
    `, [learningTable]);
    
    if (columnCheck.rows.length === 0) {
      // Add reviewed column if it doesn't exist
      await pool.query(`
        ALTER TABLE ${learningTable} 
        ADD COLUMN IF NOT EXISTS reviewed BOOLEAN DEFAULT FALSE
      `);
    }

    // Update reviewed status
    await pool.query(`
      UPDATE ${learningTable}
      SET reviewed = $1
      WHERE id = $2
    `, [reviewed, id]);
    
    return NextResponse.json({ success: true, id, reviewed });
  } catch (error: any) {
    console.error('Error updating recategorization:', error);
    return NextResponse.json(
      { error: 'Failed to update recategorization', details: error.message },
      { status: 500 }
    );
  }
}

