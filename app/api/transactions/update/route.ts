import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { ensureTokenizedForAnalytics } from '@/lib/tokenization';
import { logTransactionEditEvent } from '@/lib/event-logger';

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

    // Fetch current transaction values to track changes
    const currentTxResult = await pool.query(
      `SELECT transaction_date as date, description, merchant, amount, cashflow, category, account, label
       FROM l1_transaction_facts
       WHERE tokenized_user_id = $1 AND id = $2`,
      [tokenizedUserId, id]
    );

    if (currentTxResult.rows.length === 0) {
      return NextResponse.json({ error: 'Transaction not found or access denied' }, { status: 404 });
    }

    const currentTx = currentTxResult.rows[0];
    const changes: { field: string; oldValue: any; newValue: any }[] = [];

    // Build dynamic update query and track changes
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (date !== undefined && date !== currentTx.date) {
      updates.push(`transaction_date = $${paramCount++}`);
      values.push(date);
      changes.push({ field: 'date', oldValue: currentTx.date, newValue: date });
    }
    if (description !== undefined && description !== currentTx.description) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
      changes.push({ field: 'description', oldValue: currentTx.description, newValue: description });
    }
    if (merchant !== undefined && merchant !== currentTx.merchant) {
      updates.push(`merchant = $${paramCount++}`);
      values.push(merchant);
      changes.push({ field: 'merchant', oldValue: currentTx.merchant, newValue: merchant });
    }
    if (amount !== undefined && parseFloat(amount) !== parseFloat(currentTx.amount)) {
      updates.push(`amount = $${paramCount++}`);
      values.push(amount);
      changes.push({ field: 'amount', oldValue: currentTx.amount, newValue: amount });
    }
    if (cashflow !== undefined && cashflow !== currentTx.cashflow) {
      updates.push(`cashflow = $${paramCount++}`);
      values.push(cashflow);
      changes.push({ field: 'cashflow', oldValue: currentTx.cashflow, newValue: cashflow });
    }
    if (category !== undefined && category !== currentTx.category) {
      updates.push(`category = $${paramCount++}`);
      values.push(category);
      changes.push({ field: 'category', oldValue: currentTx.category, newValue: category });
    }
    if (account !== undefined && account !== currentTx.account) {
      updates.push(`account = $${paramCount++}`);
      values.push(account);
      changes.push({ field: 'account', oldValue: currentTx.account, newValue: account });
    }
    if (label !== undefined && label !== currentTx.label) {
      updates.push(`label = $${paramCount++}`);
      values.push(label);
      changes.push({ field: 'label', oldValue: currentTx.label, newValue: label });
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

    // Log editing event if there were changes
    if (changes.length > 0) {
      await logTransactionEditEvent(userId, id, changes);
    }

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

