import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { ensureTokenizedForAnalytics } from '@/lib/tokenization';
import { logBulkEditEvent } from '@/lib/event-logger';

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

    const userId = typeof payload.sub === 'number' ? payload.sub : parseInt(payload.sub, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 401 });
    }
    
    const pool = getPool();
    if (!pool) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    // Get tokenized user ID for analytics (L1 tables)
    const tokenizedUserId = await ensureTokenizedForAnalytics(userId);
    if (!tokenizedUserId) {
      return NextResponse.json({ error: 'Failed to get user identifier' }, { status: 500 });
    }

    // Get bulk update data from request body
    const body = await request.json();
    const { transactionIds, updates } = body;

    // Validate required fields
    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      return NextResponse.json({ error: 'Transaction IDs array required' }, { status: 400 });
    }

    // Convert transaction IDs to integers to ensure proper type casting
    const numericTransactionIds = transactionIds.map((id: any) => {
      const numId = typeof id === 'string' ? parseInt(id, 10) : id;
      if (isNaN(numId)) {
        throw new Error(`Invalid transaction ID: ${id}`);
      }
      return numId;
    });

    if (!updates || Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Updates object required' }, { status: 400 });
    }

    // Build dynamic update query
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.category !== undefined) {
      updateFields.push(`category = $${paramCount++}`);
      values.push(updates.category);
    }
    if (updates.cashflow !== undefined) {
      updateFields.push(`cashflow = $${paramCount++}`);
      values.push(updates.cashflow);
    }
    if (updates.account !== undefined) {
      updateFields.push(`account = $${paramCount++}`);
      values.push(updates.account);
    }
    if (updates.label !== undefined) {
      updateFields.push(`label = $${paramCount++}`);
      values.push(updates.label);
    }

    if (updateFields.length === 0) {
      return NextResponse.json({ error: 'No valid update fields provided' }, { status: 400 });
    }

    // Add tokenized_user_id to values
    values.push(tokenizedUserId);
    const userIdParam = paramCount++;

    // Build WHERE clause for transaction IDs
    // Use IN clause with individual parameters for better pg-mem compatibility
    const idPlaceholders = numericTransactionIds.map((_, index) => {
      values.push(numericTransactionIds[index]);
      return `$${paramCount++}`;
    }).join(', ');

    // Bulk update transactions in L1 fact table (only if they belong to the user)
    // Use IN clause instead of ANY() for better compatibility with pg-mem
    const result = await pool.query(
      `UPDATE l1_transaction_facts 
       SET ${updateFields.join(', ')}
       WHERE tokenized_user_id = $${userIdParam} 
         AND id IN (${idPlaceholders})
       RETURNING id`,
      values
    );

    // Log bulk edit event (count as single event, not per transaction)
    if (result.rowCount && result.rowCount > 0) {
      const fieldsUpdated = Object.keys(updates).filter(key => updates[key] !== undefined);
      await logBulkEditEvent(userId, numericTransactionIds, fieldsUpdated, result.rowCount);
    }

    return NextResponse.json({ 
      success: true, 
      updatedCount: result.rowCount,
      message: `Updated ${result.rowCount} transaction(s)`
    });
  } catch (error: any) {
    console.error('[API] Bulk update transactions error:', error);
    return NextResponse.json(
      { error: 'Failed to bulk update transactions', details: error.message },
      { status: 500 }
    );
  }
}

