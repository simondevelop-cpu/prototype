import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

// UPDATE keyword
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
    
    const { keyword, category, label, score, language, notes } = await request.json();
    const id = parseInt(params.id);
    
    const result = await pool.query(
      `UPDATE admin_keywords 
       SET keyword = $1, category = $2, label = $3, score = $4, language = $5, notes = $6, updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [keyword, category, label, score, language, notes, id]
    );
    
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Keyword not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, keyword: result.rows[0] });
  } catch (error: any) {
    console.error('Error updating keyword:', error);
    return NextResponse.json(
      { error: 'Failed to update keyword', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE keyword
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
      'DELETE FROM admin_keywords WHERE id = $1 RETURNING id',
      [id]
    );
    
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Keyword not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting keyword:', error);
    return NextResponse.json(
      { error: 'Failed to delete keyword', details: error.message },
      { status: 500 }
    );
  }
}

