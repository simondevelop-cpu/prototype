import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';

export const dynamic = 'force-dynamic';

/**
 * Drop tables that are verified as safe to drop
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
    const { tableNames } = body;

    if (!Array.isArray(tableNames) || tableNames.length === 0) {
      return NextResponse.json({ error: 'tableNames array required' }, { status: 400 });
    }

    const results: any[] = [];
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      for (const tableName of tableNames) {
        try {
          // Double-check table is safe to drop
          const countResult = await client.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
          const rowCount = parseInt(countResult.rows[0]?.count || '0', 10);

          if (rowCount > 0) {
            results.push({
              tableName,
              status: 'skipped',
              reason: `Table has ${rowCount} row(s) - not safe to drop`,
            });
            continue;
          }

          // Drop the table
          await client.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
          results.push({
            tableName,
            status: 'dropped',
          });
        } catch (error: any) {
          results.push({
            tableName,
            status: 'error',
            error: error.message,
          });
        }
      }

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        results,
      });
    } catch (error: any) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[Drop Tables API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to drop tables', details: error.message },
      { status: 500 }
    );
  }
}

