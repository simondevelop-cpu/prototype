import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { ensureTokenizedForAnalytics } from '@/lib/tokenization';
import dayjs from 'dayjs';

// Force dynamic rendering (required for auth headers)
export const dynamic = 'force-dynamic';

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

    // Get tokenized user ID for analytics (L1 tables)
    const tokenizedUserId = await ensureTokenizedForAnalytics(userId);
    if (!tokenizedUserId) {
      return NextResponse.json({ error: 'Failed to get user identifier' }, { status: 500 });
    }

    // Debug: Log tokenized user ID and check transaction counts
    console.log(`[Transactions API] User ID: ${userId}, Tokenized ID: ${tokenizedUserId}`);
    const countResult = await pool.query(
      'SELECT COUNT(*) as count FROM l1_transaction_facts WHERE tokenized_user_id = $1',
      [tokenizedUserId]
    );
    console.log(`[Transactions API] Transaction count in l1_transaction_facts: ${countResult.rows[0]?.count || 0}`);

    // Get date range parameters
    const url = new URL(request.url);
    const startParam = url.searchParams.get('start');
    const endParam = url.searchParams.get('end');
    const monthsParam = url.searchParams.get('months');

    let query, params;
    
    if (startParam && endParam) {
      // Use custom date range
      const startDate = dayjs(startParam).startOf('day');
      const endDate = dayjs(endParam).endOf('day');
      
      query = `SELECT 
        id,
        transaction_date as date,
        description,
        merchant,
        cashflow,
        account,
        category,
        label,
        amount
       FROM l1_transaction_facts
       WHERE tokenized_user_id = $1
         AND transaction_date >= $2
         AND transaction_date <= $3
       ORDER BY transaction_date DESC`;
      params = [tokenizedUserId, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')];
    } else if (monthsParam) {
      // Calculate date range based on months parameter
      const months = parseInt(monthsParam);
      const latestResult = await pool.query(
        'SELECT MAX(transaction_date) as latest FROM l1_transaction_facts WHERE tokenized_user_id = $1',
        [tokenizedUserId]
      );

      let endDate, startDate;
      if (latestResult.rows[0]?.latest) {
        endDate = dayjs(latestResult.rows[0].latest).endOf('month');
        startDate = endDate.subtract(months - 1, 'month').startOf('month');
      } else {
        endDate = dayjs().endOf('month');
        startDate = endDate.subtract(months - 1, 'month').startOf('month');
      }
      
      query = `SELECT 
        id,
        transaction_date as date,
        description,
        merchant,
        cashflow,
        account,
        category,
        label,
        amount
       FROM l1_transaction_facts
       WHERE tokenized_user_id = $1
         AND transaction_date >= $2
         AND transaction_date <= $3
       ORDER BY transaction_date DESC`;
      params = [tokenizedUserId, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')];
    } else {
      // No date filter - return ALL transactions
      query = `SELECT 
        id,
        transaction_date as date,
        description,
        merchant,
        cashflow,
        account,
        category,
        label,
        amount
       FROM l1_transaction_facts
       WHERE tokenized_user_id = $1
       ORDER BY transaction_date DESC`;
      params = [tokenizedUserId];
    }

    // Query transactions (no LIMIT - show all)
    const result = await pool.query(query, params);

    console.log(`[Transactions API] Query returned ${result.rows.length} transactions`);
    if (monthsParam) {
      console.log(`[Transactions API] Date range filter: ${params[1]} to ${params[2]}`);
    } else if (startParam && endParam) {
      console.log(`[Transactions API] Custom date range: ${params[1]} to ${params[2]}`);
    } else {
      console.log(`[Transactions API] No date filter - returning all transactions`);
    }

    const transactions = result.rows.map(row => ({
      id: row.id,
      date: row.date,
      description: row.description,
      merchant: row.merchant,
      cashflow: row.cashflow,
      account: row.account,
      category: row.category || 'Uncategorised',
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

