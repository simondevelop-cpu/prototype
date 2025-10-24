import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

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
    
    const result = await pool.query(
      `UPDATE admin_merchants 
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
    
    const result = await pool.query(
      'DELETE FROM admin_merchants WHERE id = $1 RETURNING id',
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

