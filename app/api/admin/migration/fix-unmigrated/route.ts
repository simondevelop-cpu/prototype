import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';

export const dynamic = 'force-dynamic';

/**
 * Fix unmigrated transactions by attempting to migrate them
 */
export async function POST(request: NextRequest) {
  try {
    // Admin authentication
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.role !== 'admin' && decoded.email !== ADMIN_EMAIL) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const pool = getPool();
    if (!pool) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    // Find unmigrated transactions
    const unmigrated = await pool.query(`
      SELECT 
        t.id,
        t.user_id,
        t.date,
        t.description,
        t.merchant,
        t.amount,
        t.cashflow,
        t.account,
        t.category,
        t.label,
        t.created_at,
        lut.tokenized_user_id
      FROM transactions t
      LEFT JOIN l0_user_tokenization lut ON lut.internal_user_id = t.user_id
      LEFT JOIN l1_transaction_facts ltf ON ltf.legacy_transaction_id = t.id
      WHERE ltf.legacy_transaction_id IS NULL
    `);

    const results: any[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const tx of unmigrated.rows) {
      try {
        if (!tx.tokenized_user_id) {
          // User doesn't have tokenization - create it
          const { getTokenizedUserId } = await import('@/lib/tokenization');
          const tokenizedId = await getTokenizedUserId(tx.user_id);
          if (!tokenizedId) {
            results.push({
              transactionId: tx.id,
              status: 'error',
              error: 'Could not create tokenized user ID',
            });
            errorCount++;
            continue;
          }
          tx.tokenized_user_id = tokenizedId;
        }

        // Attempt to migrate
        await pool.query(`
          INSERT INTO l1_transaction_facts (
            tokenized_user_id,
            transaction_date,
            description,
            merchant,
            amount,
            cashflow,
            account,
            category,
            label,
            created_at,
            legacy_transaction_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT DO NOTHING
        `, [
          tx.tokenized_user_id,
          tx.date,
          tx.description,
          tx.merchant,
          tx.amount,
          tx.cashflow,
          tx.account,
          tx.category,
          COALESCE(tx.label, ''),
          tx.created_at,
          tx.id,
        ]);

        results.push({
          transactionId: tx.id,
          status: 'migrated',
        });
        successCount++;
      } catch (error: any) {
        results.push({
          transactionId: tx.id,
          status: 'error',
          error: error.message,
        });
        errorCount++;
      }
    }

    return NextResponse.json({
      success: errorCount === 0,
      total: unmigrated.rows.length,
      migrated: successCount,
      errors: errorCount,
      results,
    });
  } catch (error: any) {
    console.error('[Fix Unmigrated API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fix unmigrated transactions', details: error.message },
      { status: 500 }
    );
  }
}

