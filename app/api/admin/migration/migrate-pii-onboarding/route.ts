import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';
import { readFileSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

/**
 * Migrate PII from onboarding_responses to l0_pii_users and drop PII columns
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

    // Read and execute the migration script
    const migrationPath = join(process.cwd(), 'migrations', 'migrate-pii-from-onboarding.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    // Execute the migration
    await pool.query(migrationSQL);

    // Verify the migration
    const piiColumns = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'onboarding_responses'
        AND column_name IN ('first_name', 'last_name', 'date_of_birth', 'recovery_phone', 'province_region')
    `);

    const remainingPII = piiColumns.rows.map((r: any) => r.column_name);

    return NextResponse.json({
      success: true,
      message: 'PII migration completed',
      details: {
        piiColumnsDropped: remainingPII.length === 0,
        remainingPIIColumns: remainingPII,
      },
    });
  } catch (error: any) {
    console.error('[Migrate PII from Onboarding] Error:', error);
    return NextResponse.json(
      { error: 'Failed to migrate PII from onboarding_responses', details: error.message },
      { status: 500 }
    );
  }
}



