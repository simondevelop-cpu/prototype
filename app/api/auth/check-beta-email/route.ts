import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Check if an email is in the beta emails list
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const pool = getPool();
    if (!pool) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    // Check if beta_emails table exists
    let hasTable = false;
    try {
      const tableCheck = await pool.query(`
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'beta_emails'
        LIMIT 1
      `);
      hasTable = tableCheck.rows.length > 0;
    } catch (e) {
      console.log('[Check Beta Email] Could not check for beta_emails table');
    }

    if (!hasTable) {
      // If table doesn't exist, block all emails (require table to be set up)
      // This ensures beta access is properly controlled
      return NextResponse.json({ isBetaEmail: false, message: 'Beta emails table not configured' });
    }

    // Check if email is in beta_emails table
    try {
      const result = await pool.query(
        'SELECT email FROM beta_emails WHERE email = $1',
        [email.toLowerCase().trim()]
      );

      const isBetaEmail = result.rows.length > 0;
      return NextResponse.json({ isBetaEmail });
    } catch (error: any) {
      console.error('[Check Beta Email] Error checking beta email:', error);
      return NextResponse.json(
        { error: 'Failed to check beta email', details: error.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('[Check Beta Email] Error:', error);
    return NextResponse.json(
      { error: 'Invalid request', details: error.message },
      { status: 400 }
    );
  }
}

