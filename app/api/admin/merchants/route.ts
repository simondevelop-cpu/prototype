import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

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
    
    const { merchant_pattern, alternate_patterns, category, label, notes } = await request.json();
    
    const result = await pool.query(
      `INSERT INTO admin_merchants (merchant_pattern, alternate_patterns, category, label, notes, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING *`,
      [merchant_pattern, alternate_patterns || [], category, label, notes]
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
