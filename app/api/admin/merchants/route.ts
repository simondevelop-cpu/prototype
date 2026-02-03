import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/lib/admin-constants';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

// CREATE new merchant
export async function POST(request: NextRequest) {
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
      `INSERT INTO ${tableName} (merchant_pattern, alternate_patterns, category, label, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [merchant_pattern, alternate_patterns || [], category, label]
    );
    
    return NextResponse.json({ success: true, merchant: result.rows[0] }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating merchant:', error);
    
    // Handle duplicate key error
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Merchant already exists for this category' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create merchant', details: error.message },
      { status: 500 }
    );
  }
}
