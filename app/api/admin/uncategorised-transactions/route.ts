import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/lib/admin-constants';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
});

/**
 * GET /api/admin/uncategorised-transactions
 * Fetch all uncategorised transactions for admin review
 */
export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Check if l1_transaction_facts table exists
    let hasTable = false;
    try {
      const tableCheck = await pool.query(`
        SELECT 1 FROM information_schema.tables WHERE table_name = 'l1_transaction_facts' LIMIT 1
      `);
      hasTable = tableCheck.rows.length > 0;
    } catch (e) {
      // Table check failed
    }
    
    if (!hasTable) {
      return NextResponse.json({
        transactions: [],
        count: 0,
        warning: 'Transaction facts table not initialized yet',
      });
    }

    // Check if reviewed column exists, add if not
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'l1_transaction_facts' AND column_name = 'reviewed'
    `);
    
    if (columnCheck.rows.length === 0) {
      await pool.query(`
        ALTER TABLE l1_transaction_facts 
        ADD COLUMN IF NOT EXISTS reviewed BOOLEAN DEFAULT FALSE
      `);
    }

    // Get uncategorised transactions
    // Join with l0_user_tokenization to get internal_user_id
    const result = await pool.query(`
      SELECT 
        tf.id,
        tf.description,
        tf.amount,
        tf.account as bank_statement_type,
        tf.created_at as upload_date,
        ut.internal_user_id as user_id,
        COALESCE(tf.reviewed, false) as reviewed
      FROM l1_transaction_facts tf
      LEFT JOIN l0_user_tokenization ut ON tf.tokenized_user_id = ut.tokenized_user_id
      WHERE tf.category = 'Uncategorised' OR tf.category IS NULL
      ORDER BY COALESCE(tf.reviewed, false) ASC NULLS FIRST, tf.created_at DESC
    `);

    return NextResponse.json({
      transactions: result.rows,
      count: result.rows.length,
    });
  } catch (error: any) {
    console.error('Error fetching uncategorised transactions:', error);
    
    if (error.message?.includes('does not exist')) {
      return NextResponse.json({
        transactions: [],
        count: 0,
        warning: 'Tables not initialized yet',
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch uncategorised transactions', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/uncategorised-transactions/[id]
 * Mark an uncategorised transaction as reviewed
 */
export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id, reviewed } = await request.json();

    // Check if reviewed column exists, add if not
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'l1_transaction_facts' AND column_name = 'reviewed'
    `);
    
    if (columnCheck.rows.length === 0) {
      await pool.query(`
        ALTER TABLE l1_transaction_facts 
        ADD COLUMN IF NOT EXISTS reviewed BOOLEAN DEFAULT FALSE
      `);
    }

    // Update reviewed status
    await pool.query(`
      UPDATE l1_transaction_facts
      SET reviewed = $1
      WHERE id = $2
    `, [reviewed, id]);
    
    return NextResponse.json({ success: true, id, reviewed });
  } catch (error: any) {
    console.error('Error updating uncategorised transaction:', error);
    return NextResponse.json(
      { error: 'Failed to update transaction', details: error.message },
      { status: 500 }
    );
  }
}

