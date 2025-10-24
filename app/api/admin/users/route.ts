import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
});

/**
 * GET /api/admin/users
 * Fetch all registered users with stats
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

    // Fetch all users with transaction count
    const result = await pool.query(`
      SELECT 
        u.id,
        u.email,
        u.created_at,
        COUNT(t.id) as transaction_count,
        MAX(t.created_at) as last_activity
      FROM users u
      LEFT JOIN transactions t ON u.id = t.user_id
      GROUP BY u.id, u.email, u.created_at
      ORDER BY u.created_at DESC
    `);

    const users = result.rows.map(row => ({
      id: row.id,
      email: row.email,
      created_at: row.created_at,
      transaction_count: parseInt(row.transaction_count) || 0,
      last_activity: row.last_activity,
      status: parseInt(row.transaction_count) > 0 ? 'Active Account' : 'Failed to log in',
      email_validated: false, // No email validation yet
    }));

    return NextResponse.json({
      users,
      count: users.length,
    });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    
    if (error.message?.includes('does not exist')) {
      return NextResponse.json({
        users: [],
        count: 0,
        warning: 'Tables not initialized yet',
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch users', details: error.message },
      { status: 500 }
    );
  }
}

