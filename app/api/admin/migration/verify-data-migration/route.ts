import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';

export const dynamic = 'force-dynamic';

/**
 * Verify data migration for specific old tables
 * Checks if data exists in new tables and compares row counts
 */
export async function GET(request: NextRequest) {
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

    // Tables to verify: old table -> new table mapping
    const tableMappings = [
      {
        oldTable: 'categorization_learning',
        newTable: 'l2_user_categorization_learning',
        description: 'Categorization learning patterns',
      },
      {
        oldTable: 'chat_bookings',
        newTable: 'l1_admin_chat_bookings',
        description: 'Chat booking requests',
      },
      {
        oldTable: 'available_slots',
        newTable: 'l1_admin_available_slots',
        description: 'Available chat slots',
      },
    ];

    const verificationResults = [];

    for (const mapping of tableMappings) {
      const result: any = {
        oldTable: mapping.oldTable,
        newTable: mapping.newTable,
        description: mapping.description,
        oldTableExists: false,
        newTableExists: false,
        oldTableCount: 0,
        newTableCount: 0,
        dataMigrated: false,
        safeToDrop: false,
        issues: [] as string[],
      };

      // Check if old table exists
      try {
        const oldExists = await pool.query(`
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = $1
        `, [mapping.oldTable]);
        result.oldTableExists = oldExists.rows.length > 0;

        if (result.oldTableExists) {
          const oldCount = await pool.query(`SELECT COUNT(*) as count FROM "${mapping.oldTable}"`);
          result.oldTableCount = parseInt(oldCount.rows[0]?.count || '0', 10);
        }
      } catch (error: any) {
        result.issues.push(`Error checking old table: ${error.message}`);
      }

      // Check if new table exists
      try {
        const newExists = await pool.query(`
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = $1
        `, [mapping.newTable]);
        result.newTableExists = newExists.rows.length > 0;

        if (result.newTableExists) {
          const newCount = await pool.query(`SELECT COUNT(*) as count FROM "${mapping.newTable}"`);
          result.newTableCount = parseInt(newCount.rows[0]?.count || '0', 10);
        }
      } catch (error: any) {
        result.issues.push(`Error checking new table: ${error.message}`);
      }

      // Determine if data is migrated
      if (!result.oldTableExists) {
        result.dataMigrated = true;
        result.safeToDrop = true;
        result.issues.push('Old table does not exist (already dropped)');
      } else if (!result.newTableExists) {
        result.dataMigrated = false;
        result.safeToDrop = false;
        result.issues.push('New table does not exist - migration may not have run');
      } else if (result.oldTableCount === 0) {
        result.dataMigrated = true;
        result.safeToDrop = true;
        result.issues.push('Old table is empty');
      } else if (result.newTableCount >= result.oldTableCount) {
        result.dataMigrated = true;
        result.safeToDrop = true;
      } else {
        result.dataMigrated = false;
        result.safeToDrop = false;
        result.issues.push(
          `Data migration incomplete: Old table has ${result.oldTableCount} rows, new table has ${result.newTableCount} rows`
        );
      }

      verificationResults.push(result);
    }

    const allMigrated = verificationResults.every(r => r.dataMigrated);
    const allSafeToDrop = verificationResults.every(r => r.safeToDrop);

    return NextResponse.json({
      success: true,
      allMigrated,
      allSafeToDrop,
      results: verificationResults,
      summary: {
        total: verificationResults.length,
        migrated: verificationResults.filter(r => r.dataMigrated).length,
        safeToDrop: verificationResults.filter(r => r.safeToDrop).length,
        needsAttention: verificationResults.filter(r => !r.dataMigrated || !r.safeToDrop).length,
      },
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Data Migration Verification] Error:', error);
    return NextResponse.json(
      { error: 'Failed to verify data migration', details: error.message },
      { status: 500 }
    );
  }
}

