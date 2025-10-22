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

    // Get date range parameters
    const url = new URL(request.url);
    const startParam = url.searchParams.get('start');
    const endParam = url.searchParams.get('end');
    const months = parseInt(url.searchParams.get('months') || '6');

    let endDate, startDate;
    
    if (startParam && endParam) {
      // Use custom date range
      startDate = dayjs(startParam).startOf('month');
      endDate = dayjs(endParam).endOf('month');
    } else {
      // Calculate date range based on latest transaction
      const latestResult = await pool.query(
        'SELECT MAX(date) as latest FROM transactions WHERE user_id = $1',
        [userId]
      );

      if (latestResult.rows[0]?.latest) {
        endDate = dayjs(latestResult.rows[0].latest).endOf('month');
        startDate = endDate.subtract(months - 1, 'month').startOf('month');
      } else {
        endDate = dayjs().endOf('month');
        startDate = endDate.subtract(months - 1, 'month').startOf('month');
      }
    }

    // Query transactions
    const result = await pool.query(
      `SELECT 
        DATE_TRUNC('month', date) as month,
        cashflow,
        SUM(amount) as total
       FROM transactions
       WHERE user_id = $1
         AND date >= $2
         AND date <= $3
       GROUP BY DATE_TRUNC('month', date), cashflow
       ORDER BY month`,
      [userId, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]
    );

    // Create a map with ALL months in the range (including empty ones)
    const monthMap = new Map();
    let currentMonth = startDate.clone();
    while (currentMonth.isBefore(endDate) || currentMonth.isSame(endDate, 'month')) {
      const monthKey = currentMonth.format('YYYY-MM');
      monthMap.set(monthKey, {
        month: currentMonth.format('YYYY-MM-DD'),
        income: 0,
        expense: 0,
        other: 0,
      });
      currentMonth = currentMonth.add(1, 'month');
    }

    // Fill in actual transaction data
    for (const row of result.rows) {
      const monthKey = dayjs(row.month).format('YYYY-MM');
      if (monthMap.has(monthKey)) {
        const monthData = monthMap.get(monthKey);
        if (row.cashflow === 'income') {
          monthData.income += parseFloat(row.total);
        } else if (row.cashflow === 'expense') {
          monthData.expense += Math.abs(parseFloat(row.total));
        } else {
          monthData.other += Math.abs(parseFloat(row.total));
        }
      }
    }

    const summary = Array.from(monthMap.values());

    return NextResponse.json({ summary });
  } catch (error: any) {
    console.error('[API] Summary error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch summary', details: error.message },
      { status: 500 }
    );
  }
}

