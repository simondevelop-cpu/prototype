import { NextRequest, NextResponse } from 'next/server';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/lib/admin-constants';

const { Pool } = pg;

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

// Mark this route as dynamic (uses request headers)
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized - No token provided' }, { status: 401 });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
      }
    } catch (err) {
      return NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 401 });
    }

    // Get query parameter for filtering
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'keywords'; // 'keywords' or 'merchants'
    const category = searchParams.get('category');

    let query;
    let params: any[] = [];

    if (type === 'merchants') {
      query = `
        SELECT * FROM admin_merchants 
        WHERE is_active = TRUE
        ${category ? 'AND category = $1' : ''}
        ORDER BY category, merchant_pattern
      `;
      if (category) params.push(category);
    } else {
      query = `
        SELECT * FROM admin_keywords 
        WHERE is_active = TRUE
        ${category ? 'AND category = $1' : ''}
        ORDER BY category, keyword
      `;
      if (category) params.push(category);
    }

    const result = await pool.query(query, params);

    // Group by category for better readability
    const grouped = result.rows.reduce((acc: any, row: any) => {
      if (!acc[row.category]) {
        acc[row.category] = [];
      }
      acc[row.category].push(row);
      return acc;
    }, {});

    // Also provide summary stats
    const stats = {
      total: result.rows.length,
      byCategory: Object.keys(grouped).map(cat => ({
        category: cat,
        count: grouped[cat].length,
      })),
    };

    return NextResponse.json({
      type,
      stats,
      grouped,
      raw: result.rows, // Also include flat list
    });
  } catch (error: any) {
    console.error('Error fetching keywords:', error);
    
    // Check if table doesn't exist
    if (error.code === '42P01') {
      return NextResponse.json(
        { 
          error: 'Database tables not initialized',
          details: 'The admin tables have not been created yet. Please run server.js to initialize the database schema.',
          grouped: {},
          stats: { total: 0, byCategory: [] },
          raw: []
        },
        { status: 200 } // Return 200 so frontend doesn't error
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch keywords', details: error.message },
      { status: 500 }
    );
  }
}

