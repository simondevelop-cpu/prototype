import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';

export const dynamic = 'force-dynamic';

interface TableDropCheck {
  tableName: string;
  safeToDrop: boolean;
  reasons: string[];
  rowCount: number;
  hasForeignKeys: boolean;
  foreignKeyDetails: Array<{
    constraintName: string;
    referencedTable: string;
    referencedColumn: string;
  }>;
  hasDependentObjects: boolean;
  dependentObjects: string[];
}

/**
 * Verify if tables can be safely dropped
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

    // Tables we want to check for dropping
    const tablesToCheck = [
      'transactions',      // Legacy - data migrated to l1_transaction_facts
      'accounts',          // Empty, unused
      'insight_feedback',  // Empty, unused
      'l1_event_facts',   // Empty, consolidated into l1_events
    ];

    const results: TableDropCheck[] = [];

    for (const tableName of tablesToCheck) {
      const check: TableDropCheck = {
        tableName,
        safeToDrop: true,
        reasons: [],
        rowCount: 0,
        hasForeignKeys: false,
        foreignKeyDetails: [],
        hasDependentObjects: false,
        dependentObjects: [],
      };

      try {
        // Check if table exists
        const tableExists = await pool.query(
          `SELECT 1 FROM information_schema.tables WHERE table_name = $1`,
          [tableName]
        );

        if (tableExists.rows.length === 0) {
          check.safeToDrop = true;
          check.reasons.push('Table does not exist');
          results.push(check);
          continue;
        }

        // Check row count
        try {
          const countResult = await pool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
          check.rowCount = parseInt(countResult.rows[0]?.count || '0', 10);
          
          if (check.rowCount > 0) {
            check.safeToDrop = false;
            check.reasons.push(`Table has ${check.rowCount} row(s) - verify data migration before dropping`);
          } else {
            check.reasons.push('Table is empty');
          }
        } catch (countError: any) {
          check.reasons.push(`Could not count rows: ${countError.message}`);
        }

        // Check for foreign key constraints (tables that reference this table)
        try {
          const fkResult = await pool.query(`
            SELECT
              tc.constraint_name,
              kcu.table_name AS referencing_table,
              kcu.column_name AS referencing_column,
              ccu.table_name AS referenced_table,
              ccu.column_name AS referenced_column
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND ccu.table_name = $1
          `, [tableName]);

          if (fkResult.rows.length > 0) {
            check.hasForeignKeys = true;
            check.foreignKeyDetails = fkResult.rows.map(row => ({
              constraintName: row.constraint_name,
              referencedTable: row.referencing_table,
              referencedColumn: row.referencing_column,
            }));
            check.safeToDrop = false;
            check.reasons.push(`Table is referenced by ${fkResult.rows.length} foreign key(s) - must drop FKs first`);
          }
        } catch (fkError: any) {
          check.reasons.push(`Could not check foreign keys: ${fkError.message}`);
        }

        // Check for foreign keys FROM this table (dependencies)
        try {
          const dependentFkResult = await pool.query(`
            SELECT
              tc.constraint_name,
              kcu.table_name AS table_name,
              kcu.column_name AS column_name,
              ccu.table_name AS referenced_table,
              ccu.column_name AS referenced_column
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND kcu.table_name = $1
          `, [tableName]);

          if (dependentFkResult.rows.length > 0) {
            check.hasDependentObjects = true;
            check.dependentObjects = dependentFkResult.rows.map(row => 
              `${row.table_name}.${row.column_name} → ${row.referenced_table}.${row.referenced_column}`
            );
            check.reasons.push(`Table has ${dependentFkResult.rows.length} foreign key(s) to other tables`);
          }
        } catch (depError: any) {
          check.reasons.push(`Could not check dependencies: ${depError.message}`);
        }

        // Check for views that depend on this table
        try {
          const viewResult = await pool.query(`
            SELECT DISTINCT viewname
            FROM pg_views
            WHERE schemaname = 'public'
              AND definition LIKE $1
          `, [`%${tableName}%`]);

          if (viewResult.rows.length > 0) {
            check.hasDependentObjects = true;
            check.dependentObjects.push(...viewResult.rows.map(row => `VIEW: ${row.viewname}`));
            check.safeToDrop = false;
            check.reasons.push(`Table is used by ${viewResult.rows.length} view(s)`);
          }
        } catch (viewError: any) {
          // Views check might fail in some databases, that's okay
        }

        // Special checks for specific tables
        if (tableName === 'transactions') {
          // Check if data has been migrated to l1_transaction_facts
          try {
            const migratedCount = await pool.query(`
              SELECT COUNT(*) as count
              FROM l1_transaction_facts
              WHERE legacy_transaction_id IS NOT NULL
            `);
            const migrated = parseInt(migratedCount.rows[0]?.count || '0', 10);
            
            if (check.rowCount > migrated) {
              check.safeToDrop = false;
              check.reasons.push(`Only ${migrated} of ${check.rowCount} transactions migrated to l1_transaction_facts`);
            } else if (migrated > 0) {
              check.reasons.push(`✓ ${migrated} transactions already migrated to l1_transaction_facts`);
            }
          } catch (migError: any) {
            check.reasons.push(`Could not verify migration: ${migError.message}`);
          }
        }

        if (tableName === 'l1_event_facts') {
          // Check if l1_events exists (consolidated table)
          try {
            const eventsExists = await pool.query(`
              SELECT 1 FROM information_schema.tables WHERE table_name = 'l1_events'
            `);
            if (eventsExists.rows.length > 0) {
              check.reasons.push('✓ l1_events table exists (consolidated)');
            } else {
              check.safeToDrop = false;
              check.reasons.push('l1_events table does not exist - cannot drop l1_event_facts yet');
            }
          } catch (e) {
            // Ignore
          }
        }

      } catch (error: any) {
        check.safeToDrop = false;
        check.reasons.push(`Error checking table: ${error.message}`);
      }

      results.push(check);
    }

    const allSafeToDrop = results.every(r => r.safeToDrop);

    return NextResponse.json({
      success: true,
      allSafeToDrop,
      tables: results,
      summary: {
        total: results.length,
        safeToDrop: results.filter(r => r.safeToDrop).length,
        notSafeToDrop: results.filter(r => !r.safeToDrop).length,
      },
    });
  } catch (error: any) {
    console.error('[Verify Drop API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to verify table drops', details: error.message },
      { status: 500 }
    );
  }
}

