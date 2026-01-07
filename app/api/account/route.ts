/**
 * Account Management Endpoints
 * - DELETE: Delete user account (soft delete)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/account
 * Delete user account (soft delete - sets deleted_at timestamp)
 * PIPEDA "right to deletion"
 */
export async function DELETE(request: NextRequest) {
  try {
    // Verify authentication
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
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    // Check if l0_pii_users table exists (migration status)
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'l0_pii_users'
      )
    `);
    const hasL0PII = tableCheck.rows[0]?.exists || false;

    if (hasL0PII) {
      // Use L0 PII table for soft delete (PIPEDA compliance)
      const result = await pool.query(`
        UPDATE l0_pii_users
        SET deleted_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE internal_user_id = $1
        AND deleted_at IS NULL
        RETURNING id, email, deleted_at
      `, [userId]);

      if (result.rows.length === 0) {
        // Check if user exists at all
        const userCheck = await pool.query(
          'SELECT id FROM users WHERE id = $1',
          [userId]
        );
        
        if (userCheck.rows.length === 0) {
          return NextResponse.json(
            { error: 'User not found' },
            { status: 404 }
          );
        }

        // User exists but no PII record - create one with deleted_at set
        await pool.query(`
          INSERT INTO l0_pii_users (internal_user_id, email, deleted_at)
          SELECT id, email, CURRENT_TIMESTAMP
          FROM users
          WHERE id = $1
          ON CONFLICT (internal_user_id) DO UPDATE
          SET deleted_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
        `, [userId]);
      }
    } else {
      // Fallback: If L0 table doesn't exist, we can't soft delete properly
      // In this case, just return success (user can't delete until migration is run)
      return NextResponse.json({
        success: true,
        message: 'Account deletion requires database migration. Please contact support.',
        warning: 'L0_PII_USERS table not found',
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Account marked for deletion. Your data will be permanently deleted after 30 days per PIPEDA requirements.',
      deletedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Account Deletion] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Account deletion failed',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

