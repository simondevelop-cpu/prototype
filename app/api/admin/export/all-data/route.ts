import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import XLSX from 'xlsx';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
});

/**
 * Export all database tables as Excel workbook (one sheet per table)
 */
export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
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

    if (!pool) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    // Get list of all tables in the database
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const tables = tablesResult.rows.map(row => row.table_name);
    
    // Create a new workbook
    const workbook = XLSX.utils.book_new();

    // Export each table as a sheet
    for (const tableName of tables) {
      try {
        // Get all data from the table
        const dataResult = await pool.query(`SELECT * FROM ${tableName}`);
        
        if (dataResult.rows.length > 0) {
          // Convert to worksheet
          const worksheet = XLSX.utils.json_to_sheet(dataResult.rows);
          
          // Add worksheet to workbook with table name as sheet name
          // Excel sheet names are limited to 31 characters
          const sheetName = tableName.length > 31 ? tableName.substring(0, 31) : tableName;
          XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        } else {
          // Create empty sheet with just headers if table is empty
          const columnResult = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = $1
            ORDER BY ordinal_position
          `, [tableName]);
          
          const headers = columnResult.rows.map(row => row.column_name);
          const worksheet = XLSX.utils.aoa_to_sheet([headers]);
          const sheetName = tableName.length > 31 ? tableName.substring(0, 31) : tableName;
          XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        }
      } catch (tableError: any) {
        console.error(`[Export] Error exporting table ${tableName}:`, tableError);
        // Continue with other tables even if one fails
      }
    }

    // Generate Excel file buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Return as downloadable file
    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="all-database-data-${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error('[Export] Error exporting all data:', error);
    return NextResponse.json(
      { error: 'Failed to export data', details: error.message },
      { status: 500 }
    );
  }
}

