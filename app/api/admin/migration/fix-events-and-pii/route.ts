import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';
import { readFileSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

/**
 * Run migration to fix events table and remove PII from non-PII tables
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

    // Read migration SQL file
    const migrationPath = join(process.cwd(), 'migrations', 'fix-events-table-and-remove-pii.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Execute migration
      await client.query(migrationSQL);

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        message: 'Migration completed successfully',
        changes: [
          'Added tokenized_user_id to l1_events',
          'Dropped duplicate foreign key constraints',
          'Dropped unused l1_event_facts table',
          'Removed PII columns from onboarding_responses (if they existed)',
        ],
      });
    } catch (error: any) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[Migration] Error running fix-events-and-pii migration:', error);
    return NextResponse.json(
      { error: 'Migration failed', details: error.message },
      { status: 500 }
    );
  }
}

