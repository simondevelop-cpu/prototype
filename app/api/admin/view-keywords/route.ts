import { NextRequest, NextResponse } from 'next/server';
import pg from 'pg';

const { Pool } = pg;

// Initialize database connection
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

export async function GET(request: NextRequest) {
  try {
    // Simple auth check - only allow in development or with a secret key
    const authHeader = request.headers.get('authorization');
    const isDev = process.env.NODE_ENV === 'development';
    const isAuthorized = isDev || authHeader === `Bearer ${process.env.ADMIN_SECRET}`;

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
        ORDER BY category, score DESC, merchant_pattern
      `;
      if (category) params.push(category);
    } else {
      query = `
        SELECT * FROM admin_keywords 
        WHERE is_active = TRUE
        ${category ? 'AND category = $1' : ''}
        ORDER BY category, score DESC, keyword
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
    return NextResponse.json(
      { error: 'Failed to fetch keywords', details: error.message },
      { status: 500 }
    );
  }
}

