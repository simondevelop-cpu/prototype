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
      startDate = dayjs(startParam).startOf('day');
      endDate = dayjs(endParam).endOf('day');
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
        id,
        date,
        description,
        merchant,
        cashflow,
        account,
        category,
        label,
        amount
       FROM transactions
       WHERE user_id = $1
         AND date >= $2
         AND date <= $3
       ORDER BY date DESC
       LIMIT 500`,
      [userId, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]
    );

    const transactions = result.rows.map(row => ({
      id: row.id,
      date: row.date,
      description: row.description,
      merchant: row.merchant,
      cashflow: row.cashflow,
      account: row.account,
      category: row.category,
      label: row.label,
      amount: parseFloat(row.amount),
    }));

    return NextResponse.json({ transactions });
  } catch (error: any) {
    console.error('[API] Transactions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions', details: error.message },
      { status: 500 }
    );
  }
}

