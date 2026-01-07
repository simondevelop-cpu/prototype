import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { ensureTokenizedForAnalytics } from '@/lib/tokenization';

// Force dynamic rendering (PUT endpoint requires runtime request body)
export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest) {
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

    // Get transaction data from request body
    const body = await request.json();
    const { id, date, description, merchant, amount, cashflow, category, account, label } = body;

    // Validate required fields
    if (!id) {
      return NextResponse.json({ error: 'Transaction ID required' }, { status: 400 });
    }

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (date !== undefined) {
      updates.push(`transaction_date = $${paramCount++}`);
      values.push(date);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (merchant !== undefined) {
      updates.push(`merchant = $${paramCount++}`);
      values.push(merchant);
    }
    if (amount !== undefined) {
      updates.push(`amount = $${paramCount++}`);
      values.push(amount);
    }
    if (cashflow !== undefined) {
      updates.push(`cashflow = $${paramCount++}`);
      values.push(cashflow);
    }
    if (category !== undefined) {
      updates.push(`category = $${paramCount++}`);
      values.push(category);
    }
    if (account !== undefined) {
      updates.push(`account = $${paramCount++}`);
      values.push(account);
    }
    if (label !== undefined) {
      updates.push(`label = $${paramCount++}`);
      values.push(label);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // Add tokenized_user_id and id to values
    values.push(tokenizedUserId);
    values.push(id);

    // Update transaction in L1 fact table (only if it belongs to the user)
    const result = await pool.query(
      `UPDATE l1_transaction_facts 
       SET ${updates.join(', ')}
       WHERE tokenized_user_id = $${paramCount++} AND id = $${paramCount}
       RETURNING id, transaction_date as date, description, merchant, amount, cashflow, category, account, label`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Transaction not found or access denied' }, { status: 404 });
    }

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
    console.error('[API] Update transaction error:', error);
    return NextResponse.json(
      { error: 'Failed to update transaction', details: error.message },
      { status: 500 }
    );
  }
}

