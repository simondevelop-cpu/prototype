import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

/**
 * Drop transactions and accounts tables
 * This establishes Single Source of Truth by:
 * 1. Verifying all transactions migrated
 * 2. Updating l2_customer_summary_view
 * 3. Dropping foreign keys
 * 4. Dropping tables
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

    // Read migration script
    const migrationPath = path.join(process.cwd(), 'migrations', 'drop-transactions-accounts.sql');
    const migrationScript = fs.readFileSync(migrationPath, 'utf-8');

    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN'); // Start transaction

      // Execute the migration script
      await client.query(migrationScript);

      await client.query('COMMIT'); // Commit transaction
      console.log('[Drop Transactions/Accounts API] ✅ Tables dropped successfully.');

      return NextResponse.json({
        success: true,
        message: 'Transactions and accounts tables dropped successfully. Single Source of Truth established.',
      });
    } catch (error: any) {
      if (client) {
        await client.query('ROLLBACK'); // Rollback on error
      }
      console.error('[Drop Transactions/Accounts API] ❌ Failed:', error);
      return NextResponse.json(
        { error: 'Failed to drop tables', details: error.message },
        { status: 500 }
      );
    } finally {
      if (client) {
        client.release();
      }
    }
  } catch (error: any) {
    console.error('[Drop Transactions/Accounts API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to drop tables', details: error.message },
      { status: 500 }
    );
  }
}

