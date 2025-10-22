import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

interface Transaction {
  date: string;
  description: string;
  merchant: string;
  amount: number;
  cashflow: 'income' | 'expense' | 'other';
  category: string;
  account: string;
  label: string;
}

/**
 * Import reviewed/edited transactions into the database
 */
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

    // Get transactions from request body
    const { transactions } = await request.json();

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json({ error: 'No transactions provided' }, { status: 400 });
    }

    // Insert each transaction
    let imported = 0;
    const errors: string[] = [];

    for (const tx of transactions as Transaction[]) {
      try {
        await pool.query(
          `INSERT INTO transactions (user_id, date, description, merchant, amount, cashflow, category, account, label, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
           ON CONFLICT (user_id, date, amount, merchant, cashflow) DO NOTHING`,
          [userId, tx.date, tx.description, tx.merchant, tx.amount, tx.cashflow, tx.category, tx.account, tx.label]
        );
        imported++;
      } catch (error: any) {
        console.error('[API] Failed to import transaction:', error);
        errors.push(`${tx.merchant} (${tx.date}): ${error.message}`);
      }
    }

    return NextResponse.json({
      imported,
      total: transactions.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('[API] Statement import error:', error);
    return NextResponse.json(
      { error: 'Failed to import transactions', details: error.message },
      { status: 500 }
    );
  }
}

