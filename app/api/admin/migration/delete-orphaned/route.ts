import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';

export const dynamic = 'force-dynamic';

/**
 * Delete orphaned transactions (transactions with no valid user)
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

    const body = await request.json();
    const { transactionIds } = body;

    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      return NextResponse.json({ error: 'transactionIds array required' }, { status: 400 });
    }

    // Verify these are actually orphaned before deleting
    const orphanedCheck = await pool.query(`
      SELECT t.id, t.user_id
      FROM transactions t
      WHERE t.id = ANY($1)
        AND (
          t.user_id IS NULL 
          OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = t.user_id)
        )
    `, [transactionIds]);

    const actuallyOrphaned = orphanedCheck.rows.map((r: any) => r.id);
    const notOrphaned = transactionIds.filter((id: number) => !actuallyOrphaned.includes(id));

    if (notOrphaned.length > 0) {
      return NextResponse.json({
        error: 'Some transactions are not orphaned',
        notOrphaned,
        actuallyOrphaned,
      }, { status: 400 });
    }

    // Delete orphaned transactions
    const deleteResult = await pool.query(`
      DELETE FROM transactions
      WHERE id = ANY($1)
      RETURNING id
    `, [transactionIds]);

    return NextResponse.json({
      success: true,
      deleted: deleteResult.rows.length,
      transactionIds: deleteResult.rows.map((r: any) => r.id),
    });
  } catch (error: any) {
    console.error('[Delete Orphaned API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete orphaned transactions', details: error.message },
      { status: 500 }
    );
  }
}

