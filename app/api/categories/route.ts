import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import dayjs from 'dayjs';

export async function GET(request: NextRequest) {
  try {
    // Verify auth
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = payload.sub;
    const pool = getPool();
    if (!pool) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    // Get month parameter (default to current month)
    const url = new URL(request.url);
    const monthParam = url.searchParams.get('month');
    
    let startDate, endDate;
    if (monthParam) {
      startDate = dayjs(monthParam).startOf('month');
      endDate = dayjs(monthParam).endOf('month');
    } else {
      // Use latest transaction month
      const latestResult = await pool.query(
        'SELECT MAX(date) as latest FROM transactions WHERE user_id = $1',
        [userId]
      );
      if (latestResult.rows[0]?.latest) {
        endDate = dayjs(latestResult.rows[0].latest).endOf('month');
        startDate = endDate.startOf('month');
      } else {
        endDate = dayjs().endOf('month');
        startDate = endDate.startOf('month');
      }
    }

    // Query transactions grouped by category
    const result = await pool.query(
      `SELECT 
        category,
        SUM(ABS(amount)) as total
       FROM transactions
       WHERE user_id = $1
         AND cashflow = 'expense'
         AND date >= $2
         AND date <= $3
         AND category IS NOT NULL
       GROUP BY category
       ORDER BY total DESC`,
      [userId, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]
    );

    const categories = result.rows.map(row => ({
      category: row.category,
      total: parseFloat(row.total),
    }));

    return NextResponse.json({ 
      categories,
      month: startDate.format('YYYY-MM-DD')
    });
  } catch (error: any) {
    console.error('[API] Categories error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories', details: error.message },
      { status: 500 }
    );
  }
}

