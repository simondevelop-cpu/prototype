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

    // Get bulk update data from request body
    const body = await request.json();
    const { transactionIds, updates } = body;

    // Validate required fields
    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      return NextResponse.json({ error: 'Transaction IDs array required' }, { status: 400 });
    }

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

    // Add user_id to values
    values.push(userId);
    const userIdParam = paramCount++;

    // Add transaction IDs to values
    values.push(transactionIds);
    const idsParam = paramCount;

    // Bulk update transactions (only if they belong to the user)
    const result = await pool.query(
      `UPDATE transactions 
       SET ${updateFields.join(', ')}
       WHERE user_id = $${userIdParam} 
         AND id = ANY($${idsParam})
       RETURNING id`,
      values
    );

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

