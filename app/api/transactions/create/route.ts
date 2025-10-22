import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// Force dynamic rendering (POST endpoint requires runtime request body)
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
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

    // Get transaction data from request body
    const body = await request.json();
    const { date, description, merchant, amount, cashflow, category, account, label } = body;

    // Validate required fields
    if (!date || !description || amount === undefined || !cashflow) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Insert transaction
    const result = await pool.query(
      `INSERT INTO transactions (user_id, date, description, merchant, amount, cashflow, category, account, label)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, date, description, merchant, amount, cashflow, category, account, label`,
      [userId, date, description, merchant || description, amount, cashflow, category, account, label]
    );

    const transaction = result.rows[0];

    return NextResponse.json({ 
      success: true, 
      transaction: {
        id: transaction.id,
        date: transaction.date,
        description: transaction.description,
        merchant: transaction.merchant,
        amount: parseFloat(transaction.amount),
        cashflow: transaction.cashflow,
        category: transaction.category,
        account: transaction.account,
        label: transaction.label,
      }
    });
  } catch (error: any) {
    console.error('[API] Create transaction error:', error);
    return NextResponse.json(
      { error: 'Failed to create transaction', details: error.message },
      { status: 500 }
    );
  }
}

