import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { ensureTokenizedForAnalytics } from '@/lib/tokenization';
import { logBankStatementEvent } from '@/lib/event-logger';

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

    // Get tokenized user ID for analytics (L1 tables)
    const tokenizedUserId = await ensureTokenizedForAnalytics(userId);
    if (!tokenizedUserId) {
      return NextResponse.json({ error: 'Failed to get user identifier' }, { status: 500 });
    }

    // Get transactions and bank statement info from request body
    const { transactions, bankStatementInfo } = await request.json();

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json({ error: 'No transactions provided' }, { status: 400 });
    }

    // Log bank statement import event if bank info is provided
    if (bankStatementInfo && bankStatementInfo.bank && bankStatementInfo.accountType) {
      await logBankStatementEvent(userId, {
        bank: bankStatementInfo.bank,
        accountType: bankStatementInfo.accountType,
        source: 'uploaded', // Imported statements are from uploads
        transactionCount: transactions.length,
      });
    }

    // Insert each transaction
    let imported = 0;
    const errors: string[] = [];

    for (const tx of transactions as Transaction[]) {
      try {
        // Check for duplicates first (since L1 table may not have unique constraint)
        const duplicateCheck = await pool.query(
          `SELECT id FROM l1_transaction_facts 
           WHERE tokenized_user_id = $1 AND transaction_date = $2 AND amount = $3 AND merchant = $4 AND cashflow = $5`,
          [tokenizedUserId, tx.date, tx.amount, tx.merchant, tx.cashflow]
        );
        
        if (duplicateCheck.rows.length > 0) {
          // Skip duplicate
          continue;
        }
        
        // Insert into L1 fact table
        await pool.query(
          `INSERT INTO l1_transaction_facts (tokenized_user_id, transaction_date, description, merchant, amount, cashflow, category, account, label, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
          [tokenizedUserId, tx.date, tx.description, tx.merchant, tx.amount, tx.cashflow, tx.category, tx.account, tx.label]
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

