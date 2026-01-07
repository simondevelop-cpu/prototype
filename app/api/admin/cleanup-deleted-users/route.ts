/**
 * Automated 30-Day Data Deletion Job (PIPEDA Compliance)
 * 
 * This endpoint deletes PII records where deleted_at < NOW() - INTERVAL '30 days'
 * Should be called daily via Vercel Cron or external cron service
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/cleanup-deleted-users
 * Cleanup endpoint that can be called by cron jobs
 * 
 * For Vercel Cron, add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/admin/cleanup-deleted-users",
 *     "schedule": "0 2 * * *"
 *   }]
 * }
 * 
 * Or use external service (EasyCron, Cron-job.org) to call this endpoint daily
 */
export async function GET(request: NextRequest) {
  try {
    // Optional: Add API key authentication for security
    const authHeader = request.headers.get('authorization');
    const apiKey = process.env.CLEANUP_API_KEY;
    
    if (apiKey && authHeader !== `Bearer ${apiKey}`) {
      return NextResponse.json(
        { error: 'Unauthorized - API key required' },
        { status: 401 }
      );
    }

    const pool = getPool();
    if (!pool) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    // Delete PII records that were soft-deleted more than 30 days ago
    const deleteResult = await pool.query(`
      DELETE FROM l0_pii_users
      WHERE deleted_at IS NOT NULL
      AND deleted_at < NOW() - INTERVAL '30 days'
      RETURNING id, internal_user_id, email
    `);

    const deletedCount = deleteResult.rows.length;
    const deletedRecords = deleteResult.rows;

    // Also delete related tokenization records (CASCADE should handle this, but explicit is better)
    if (deletedCount > 0) {
      const userIds = deletedRecords.map(r => r.internal_user_id);
      await pool.query(`
        DELETE FROM l0_user_tokenization
        WHERE internal_user_id = ANY($1::int[])
      `, [userIds]);
    }

    return NextResponse.json({
      success: true,
      message: `Cleanup completed: ${deletedCount} record(s) deleted`,
      deletedCount,
      deletedRecords: deletedRecords.map(r => ({
        id: r.id,
        internal_user_id: r.internal_user_id,
        email: r.email,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Cleanup] Error deleting old records:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Cleanup failed',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

