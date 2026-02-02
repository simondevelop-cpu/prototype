import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';
import { readFileSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

/**
 * Complete PII isolation migration
 * Removes all PII from chat_bookings, onboarding_responses, and users tables
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
    const migrationPath = join(process.cwd(), 'migrations', 'complete-pii-isolation.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    // Execute the migration
    await pool.query(migrationSQL);

    // Verify the migration
    const verification = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM information_schema.columns 
         WHERE table_name = 'onboarding_responses' 
         AND column_name IN ('first_name', 'last_name', 'date_of_birth', 'recovery_phone', 'province_region')) as remaining_pii_columns,
        (SELECT COUNT(*) FROM l0_pii_users) as pii_records,
        (SELECT COUNT(*) FROM users) as user_records
    `);

    const result = verification.rows[0];
    const remainingPII = parseInt(result.remaining_pii_columns || '0', 10);

    return NextResponse.json({
      success: true,
      message: 'PII isolation migration completed',
      details: {
        remainingPIIColumnsInOnboarding: remainingPII,
        piiRecordsCount: parseInt(result.pii_records || '0', 10),
        userRecordsCount: parseInt(result.user_records || '0', 10),
        note: remainingPII === 0 
          ? 'All PII columns removed from onboarding_responses' 
          : `${remainingPII} PII columns still exist in onboarding_responses`,
      },
    });
  } catch (error: any) {
    console.error('[Complete PII Isolation] Error:', error);
    return NextResponse.json(
      { error: 'Failed to complete PII isolation', details: error.message },
      { status: 500 }
    );
  }
}

