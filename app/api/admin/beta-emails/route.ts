import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';

export const dynamic = 'force-dynamic';

// GET: List all beta emails
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
      console.log('[Beta Emails API] Could not check for beta_emails table');
    }

    if (!hasTable) {
      return NextResponse.json({ 
        success: true,
        emails: [],
        message: 'beta_emails table does not exist yet. Please initialize the database.'
      }, { status: 200 });
    }

    // Get emails explicitly in beta_emails table
    const betaEmailsResult = await pool.query(`
      SELECT email, created_at, added_by
      FROM beta_emails
      ORDER BY created_at DESC
    `);

    // Get all existing user emails that aren't in beta_emails yet
    // Use COALESCE to handle NULL emails
    const existingUsersResult = await pool.query(`
      SELECT DISTINCT u.email, u.created_at, 'system' as added_by
      FROM users u
      WHERE u.email IS NOT NULL
        AND u.email != ''
        AND LOWER(TRIM(u.email)) NOT IN (
          SELECT LOWER(TRIM(email)) FROM beta_emails WHERE email IS NOT NULL
        )
      ORDER BY u.created_at DESC
    `);

    // Combine both lists, marking which are explicitly added vs existing users
    const allEmails = [
      ...betaEmailsResult.rows.map((row: any) => ({ ...row, is_explicit: true })),
      ...existingUsersResult.rows.map((row: any) => ({ ...row, is_explicit: false }))
    ];

    return NextResponse.json({ 
      success: true,
      emails: allEmails,
      stats: {
        explicit: betaEmailsResult.rows.length,
        existing: existingUsersResult.rows.length,
        total: allEmails.length
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Beta Emails API] Error fetching beta emails:', error);
    return NextResponse.json(
      { error: 'Failed to fetch beta emails', details: error.message },
      { status: 500 }
    );
  }
}

// POST: Add a new beta email
export async function POST(request: NextRequest) {
  try {
    // Admin authentication
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.role !== 'admin' && decoded.email !== ADMIN_EMAIL) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
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
      console.log('[Beta Emails API] Could not check for beta_emails table');
    }

    if (!hasTable) {
      return NextResponse.json({ 
        error: 'beta_emails table does not exist. Please initialize the database first.'
      }, { status: 500 });
    }

    // Check if email already exists
    const existingCheck = await pool.query(
      'SELECT email FROM beta_emails WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingCheck.rows.length > 0) {
      return NextResponse.json({ 
        error: 'Email already exists in beta list'
      }, { status: 400 });
    }

    // Insert new beta email (using ON CONFLICT to handle duplicates gracefully)
    const result = await pool.query(
      `INSERT INTO beta_emails (email, added_by, created_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (email) DO NOTHING
       RETURNING email, created_at, added_by`,
      [email.toLowerCase(), decoded.email || 'admin']
    );
    
    // If no row returned, it means email already exists (from ON CONFLICT)
    if (result.rows.length === 0) {
      return NextResponse.json({ 
        error: 'Email already exists in beta list'
      }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true,
      email: result.rows[0],
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Beta Emails API] Error adding beta email:', error);
    return NextResponse.json(
      { error: 'Failed to add beta email', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE: Remove a beta email
export async function DELETE(request: NextRequest) {
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

    const url = new URL(request.url);
    const email = url.searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email parameter is required' }, { status: 400 });
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
      console.log('[Beta Emails API] Could not check for beta_emails table');
    }

    if (!hasTable) {
      return NextResponse.json({ 
        error: 'beta_emails table does not exist. Please initialize the database first.'
      }, { status: 500 });
    }

    const result = await pool.query(
      'DELETE FROM beta_emails WHERE email = $1 RETURNING email',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ 
        error: 'Email not found in beta list'
      }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Beta email removed successfully'
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Beta Emails API] Error removing beta email:', error);
    return NextResponse.json(
      { error: 'Failed to remove beta email', details: error.message },
      { status: 500 }
    );
  }
}

// PUT: Backfill existing user emails to beta_emails table
export async function PUT(request: NextRequest) {
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
      console.log('[Beta Emails API] Could not check for beta_emails table');
    }

    if (!hasTable) {
      return NextResponse.json({ 
        error: 'beta_emails table does not exist. Please initialize the database first.'
      }, { status: 500 });
    }

    // Get all existing user emails that aren't in beta_emails
    // Use LEFT JOIN instead of NOT IN to avoid issues with NULL values
    const existingUsersResult = await pool.query(`
      SELECT DISTINCT u.email, u.created_at
      FROM users u
      LEFT JOIN beta_emails be ON LOWER(TRIM(u.email)) = LOWER(TRIM(be.email))
      WHERE u.email IS NOT NULL
        AND u.email != ''
        AND be.email IS NULL
    `);

    if (existingUsersResult.rows.length === 0) {
      return NextResponse.json({ 
        success: true,
        message: 'All existing user emails are already in the beta list',
        added: 0
      }, { status: 200 });
    }

    // Insert all existing user emails into beta_emails
    let added = 0;
    for (const row of existingUsersResult.rows) {
      try {
        const result = await pool.query(
          `INSERT INTO beta_emails (email, added_by, created_at)
           VALUES ($1, 'system', $2)
           ON CONFLICT (email) DO NOTHING
           RETURNING email`,
          [row.email.toLowerCase().trim(), row.created_at || new Date()]
        );
        // Only increment if a row was actually inserted (not a conflict)
        if (result.rows.length > 0) {
          added++;
        }
      } catch (error: any) {
        console.error(`[Beta Emails API] Error adding email ${row.email}:`, error);
        // Continue with other emails
      }
    }

    return NextResponse.json({ 
      success: true,
      message: `Successfully added ${added} existing user emails to beta list`,
      added
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Beta Emails API] Error backfilling emails:', error);
    return NextResponse.json(
      { error: 'Failed to backfill emails', details: error.message },
      { status: 500 }
    );
  }
}

