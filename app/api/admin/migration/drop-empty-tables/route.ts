import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

/**
 * Drop empty unused tables (except l1_support_tickets)
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
    const migrationPath = path.join(process.cwd(), 'migrations', 'drop-empty-unused-tables.sql');
    const migrationScript = fs.readFileSync(migrationPath, 'utf-8');

    const tablesToDrop = [
      'l0_admin_list',
      'l0_privacy_metadata',
      'l1_file_ingestion',
      'l1_job_list',
      'l0_insight_list',
    ];

    // Verify tables are empty before dropping (skip if table doesn't exist)
    const verificationResults: any[] = [];
    const tablesToActuallyDrop: string[] = [];
    
    for (const tableName of tablesToDrop) {
      try {
        // Check if table exists
        const tableExists = await pool.query(`
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = $1
        `, [tableName]);
        
        if (tableExists.rows.length === 0) {
          // Table doesn't exist - skip it
          verificationResults.push({
            tableName,
            rowCount: 0,
            safeToDrop: true,
            note: 'Table does not exist (already dropped)',
          });
          continue;
        }
        
        const countResult = await pool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
        const rowCount = parseInt(countResult.rows[0]?.count || '0', 10);
        const safeToDrop = rowCount === 0;
        
        verificationResults.push({
          tableName,
          rowCount,
          safeToDrop,
        });
        
        if (safeToDrop) {
          tablesToActuallyDrop.push(tableName);
        }
      } catch (error: any) {
        // Table might not exist or other error
        verificationResults.push({
          tableName,
          rowCount: 0,
          safeToDrop: true,
          note: error.message.includes('does not exist') ? 'Table does not exist' : error.message,
        });
      }
    }

    // Only drop tables that actually exist and are empty
    if (tablesToActuallyDrop.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No tables to drop (all either already dropped or not empty)',
        droppedTables: [],
        verification: verificationResults,
      });
    }

    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN'); // Start transaction

      // Drop each table individually
      for (const tableName of tablesToActuallyDrop) {
        try {
          await client.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
          console.log(`[Drop Empty Tables API] ✅ Dropped table: ${tableName}`);
        } catch (error: any) {
          console.error(`[Drop Empty Tables API] ❌ Error dropping ${tableName}:`, error);
          throw error;
        }
      }

      await client.query('COMMIT'); // Commit transaction
      console.log('[Drop Empty Tables API] ✅ Tables dropped successfully.');

      return NextResponse.json({
        success: true,
        message: 'Empty unused tables dropped successfully.',
        droppedTables: tablesToActuallyDrop,
        verification: verificationResults,
      });
    } catch (error: any) {
      if (client) {
        await client.query('ROLLBACK'); // Rollback on error
      }
      console.error('[Drop Empty Tables API] ❌ Failed:', error);
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
    console.error('[Drop Empty Tables API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to drop empty tables', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET - Verify which empty tables can be dropped
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

    const tablesToCheck = [
      { name: 'l0_admin_list', purpose: 'Empty, unused admin configuration table' },
      { name: 'l0_insight_list', purpose: 'Empty, check if isolated (no references)' },
      { name: 'l0_privacy_metadata', purpose: 'Empty, unused privacy metadata table' },
      { name: 'l1_file_ingestion', purpose: 'Empty, PDFs processed in memory (not stored)' },
      { name: 'l1_job_list', purpose: 'Empty, worker pipeline not implemented' },
      { name: 'l1_support_tickets', purpose: 'KEPT - User wants to keep for future use' },
    ];

    const results: any[] = [];

    for (const table of tablesToCheck) {
      try {
        // Check row count
        const countResult = await pool.query(`SELECT COUNT(*) as count FROM "${table.name}"`);
        const rowCount = parseInt(countResult.rows[0]?.count || '0', 10);

        // Check foreign key references
        const fkCheck = await pool.query(`
          SELECT COUNT(*) as count
          FROM information_schema.key_column_usage kcu
          JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
          WHERE tc.table_name != $1
            AND kcu.referenced_table_name = $1
        `, [table.name]);
        const referencedBy = parseInt(fkCheck.rows[0]?.count || '0', 10);

        // Check foreign keys from this table
        const fkFromCheck = await pool.query(`
          SELECT COUNT(*) as count
          FROM information_schema.table_constraints
          WHERE table_name = $1
            AND constraint_type = 'FOREIGN KEY'
        `, [table.name]);
        const hasForeignKeys = parseInt(fkFromCheck.rows[0]?.count || '0', 10) > 0;

        results.push({
          tableName: table.name,
          purpose: table.purpose,
          rowCount,
          referencedBy,
          hasForeignKeys,
          safeToDrop: rowCount === 0 && referencedBy === 0,
          keep: table.name === 'l1_support_tickets',
        });
      } catch (error: any) {
        // Table might not exist
        results.push({
          tableName: table.name,
          purpose: table.purpose,
          rowCount: 0,
          referencedBy: 0,
          hasForeignKeys: false,
          safeToDrop: true,
          note: 'Table does not exist',
          keep: table.name === 'l1_support_tickets',
        });
      }
    }

    return NextResponse.json({
      tables: results,
      safeToDropCount: results.filter((r) => r.safeToDrop && !r.keep).length,
      totalTables: results.length,
    });
  } catch (error: any) {
    console.error('[Drop Empty Tables API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to verify empty tables', details: error.message },
      { status: 500 }
    );
  }
}

