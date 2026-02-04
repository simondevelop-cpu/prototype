import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/lib/admin-constants';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

// UPDATE merchant
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    
    const { merchant_pattern, alternate_patterns, category, label } = await request.json();
    const id = parseInt(params.id);
    
    // Use new table name (l1_admin_merchants) with fallback to old name
    let tableName = 'l1_admin_merchants';
    try {
      const tableCheck = await pool.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = $1`,
        [tableName]
      );
      if (tableCheck.rows.length === 0) {
        tableName = 'admin_merchants'; // Fallback to old name
      }
    } catch (e) {
      tableName = 'admin_merchants'; // Fallback on error
    }
    
    const result = await pool.query(
      `UPDATE ${tableName} 
       SET merchant_pattern = $1, alternate_patterns = $2, category = $3, label = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [merchant_pattern, alternate_patterns || [], category, label, id]
    );
    
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, merchant: result.rows[0] });
  } catch (error: any) {
    console.error('Error updating merchant:', error);
    return NextResponse.json(
      { error: 'Failed to update merchant', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE merchant
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    
    const id = parseInt(params.id);
    
    // Use new table name (l1_admin_merchants) with fallback to old name
    let tableName = 'l1_admin_merchants';
    try {
      const tableCheck = await pool.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = $1`,
        [tableName]
      );
      if (tableCheck.rows.length === 0) {
        tableName = 'admin_merchants'; // Fallback to old name
      }
    } catch (e) {
      tableName = 'admin_merchants'; // Fallback on error
    }
    
    const result = await pool.query(
      `DELETE FROM ${tableName} WHERE id = $1 RETURNING id`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting merchant:', error);
    return NextResponse.json(
      { error: 'Failed to delete merchant', details: error.message },
      { status: 500 }
    );
  }
}

