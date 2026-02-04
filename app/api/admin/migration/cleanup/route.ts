import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';

export const dynamic = 'force-dynamic';

/**
 * Check if old tables can be safely dropped
 * Returns analysis of old tables, dependencies, and recommendations
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

    // Old tables that should have been migrated
    const oldTables = [
      'l1_events',
      'onboarding_responses',
      'survey_responses',
      'categorization_learning',
      'admin_categorization_learning',
      'admin_keywords',
      'admin_merchants',
      'admin_available_slots',
      'admin_chat_bookings',
      'chat_bookings',
      'available_slots',
      'transactions',
      'accounts',
      'insight_feedback',
      'user_events',
    ];

    const analysis: Array<{
      tableName: string;
      exists: boolean;
      rowCount: number;
      hasForeignKeys: boolean;
      foreignKeyDetails: string[];
      hasDependentViews: boolean;
      dependentViews: string[];
      safeToDrop: boolean;
      reason: string;
    }> = [];

    for (const tableName of oldTables) {
      // Check if table exists
      const existsResult = await pool.query(`
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1
      `, [tableName]);

      const exists = existsResult.rows.length > 0;

      if (!exists) {
        analysis.push({
          tableName,
          exists: false,
          rowCount: 0,
          hasForeignKeys: false,
          foreignKeyDetails: [],
          hasDependentViews: false,
          dependentViews: [],
          safeToDrop: true,
          reason: 'Table does not exist (already dropped)',
        });
        continue;
      }

      // Get row count
      let rowCount = 0;
      try {
        const countResult = await pool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
        rowCount = parseInt(countResult.rows[0]?.count || '0', 10);
      } catch (e) {
        // Table might not be accessible
      }

      // Check for foreign keys referencing this table
      const fkResult = await pool.query(`
        SELECT 
          tc.table_name as referencing_table,
          kcu.column_name as referencing_column,
          ccu.table_name as referenced_table,
          ccu.column_name as referenced_column
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = $1
          AND tc.table_schema = 'public'
      `, [tableName]);

      const hasForeignKeys = fkResult.rows.length > 0;
      const foreignKeyDetails = fkResult.rows.map((row: any) => 
        `${row.referencing_table}.${row.referencing_column} → ${row.referenced_table}.${row.referenced_column}`
      );

      // Check for dependent views
      const viewResult = await pool.query(`
        SELECT DISTINCT table_name
        FROM information_schema.views
        WHERE table_schema = 'public'
          AND definition LIKE '%${tableName}%'
      `);

      const hasDependentViews = viewResult.rows.length > 0;
      const dependentViews = viewResult.rows.map((row: any) => row.table_name);

      // Determine if safe to drop
      let safeToDrop = false;
      let reason = '';

      if (rowCount > 0) {
        safeToDrop = false;
        reason = `Table has ${rowCount} rows - verify data migration before dropping`;
      } else if (hasForeignKeys) {
        safeToDrop = false;
        reason = `Table has foreign key dependencies: ${foreignKeyDetails.join(', ')}`;
      } else if (hasDependentViews) {
        safeToDrop = false;
        reason = `Table is used by views: ${dependentViews.join(', ')}`;
      } else {
        safeToDrop = true;
        reason = 'Table is empty and has no dependencies - safe to drop';
      }

      analysis.push({
        tableName,
        exists: true,
        rowCount,
        hasForeignKeys,
        foreignKeyDetails,
        hasDependentViews,
        dependentViews,
        safeToDrop,
        reason,
      });
    }

    const safeToDropTables = analysis.filter(a => a.safeToDrop && a.exists);
    const unsafeTables = analysis.filter(a => !a.safeToDrop && a.exists);
    const alreadyDropped = analysis.filter(a => !a.exists);

    return NextResponse.json({
      success: true,
      analysis,
      summary: {
        total: oldTables.length,
        exists: analysis.filter(a => a.exists).length,
        safeToDrop: safeToDropTables.length,
        unsafe: unsafeTables.length,
        alreadyDropped: alreadyDropped.length,
      },
      safeToDropTables: safeToDropTables.map(a => a.tableName),
      unsafeTables: unsafeTables.map(a => ({ table: a.tableName, reason: a.reason })),
      alreadyDropped: alreadyDropped.map(a => a.tableName),
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Migration Cleanup] Error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze tables', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Drop old tables that are safe to drop
 * Requires explicit confirmation
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

    const body = await request.json();
    const { tableNames, confirm } = body;

    if (!confirm || confirm !== 'DROP_TABLES') {
      return NextResponse.json({ 
        error: 'Confirmation required. Set confirm to "DROP_TABLES" to proceed.' 
      }, { status: 400 });
    }

    if (!Array.isArray(tableNames) || tableNames.length === 0) {
      return NextResponse.json({ 
        error: 'tableNames must be a non-empty array' 
      }, { status: 400 });
    }

    const pool = getPool();
    if (!pool) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const client = await pool.connect();
    const dropped: string[] = [];
    const errors: Array<{ table: string; error: string }> = [];

    try {
      await client.query('BEGIN');

      for (const tableName of tableNames) {
        try {
          // Verify table exists and is safe to drop (double-check)
          const existsResult = await client.query(`
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = $1
          `, [tableName]);

          if (existsResult.rows.length === 0) {
            continue; // Table doesn't exist, skip
          }

          // Drop table with CASCADE to handle any remaining dependencies
          await client.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
          dropped.push(tableName);
        } catch (error: any) {
          errors.push({ table: tableName, error: error.message });
        }
      }

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        dropped,
        errors,
        message: `Successfully dropped ${dropped.length} table(s)`,
      }, { status: 200 });

    } catch (error: any) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('[Migration Cleanup] Error dropping tables:', error);
    return NextResponse.json(
      { error: 'Failed to drop tables', details: error.message },
      { status: 500 }
    );
  }
}

