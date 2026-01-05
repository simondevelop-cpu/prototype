import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { ensureTokenizedForAnalytics } from '@/lib/tokenization';

// Force dynamic rendering (DELETE endpoint requires runtime request)
export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest) {
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

    // Get transaction ID from query params
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Transaction ID required' }, { status: 400 });
    }

    // Delete transaction from L1 fact table (only if it belongs to the user)
    const result = await pool.query(
      'DELETE FROM l1_transaction_facts WHERE tokenized_user_id = $1 AND id = $2 RETURNING id',
      [tokenizedUserId, id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Transaction not found or access denied' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Transaction deleted successfully'
    });
  } catch (error: any) {
    console.error('[API] Delete transaction error:', error);
    return NextResponse.json(
      { error: 'Failed to delete transaction', details: error.message },
      { status: 500 }
    );
  }
}

