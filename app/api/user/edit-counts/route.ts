import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { verifyRequestOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // CSRF protection
    if (!verifyRequestOrigin(request)) {
      return NextResponse.json(
        { error: 'Invalid request origin' },
        { status: 403 }
      );
    }

    // Verify authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = decoded.userId || decoded.id || decoded.sub;
    if (!userId) {
      return NextResponse.json({ error: 'Invalid token: no user ID' }, { status: 401 });
    }

    const pool = getPool();
    if (!pool) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    // Check if user_events table exists
    let hasUserEventsTable = false;
    try {
      const tableCheck = await pool.query(`
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'user_events'
        LIMIT 1
      `);
      hasUserEventsTable = tableCheck.rows.length > 0;
    } catch (e) {
      console.log('[Edit Counts API] Could not check for user_events table');
    }

    if (!hasUserEventsTable) {
      return NextResponse.json({ 
        description: 0,
        category: 0,
        label: 0,
        date: 0,
        amount: 0,
      }, { status: 200 });
    }

    // Fetch transaction editing events for this user
    const result = await pool.query(`
      SELECT metadata
      FROM user_events
      WHERE user_id = $1
        AND event_type = 'transaction_edit'
    `, [userId]);

    // Count edits by field
    const counts = {
      description: 0,
      category: 0,
      label: 0,
      date: 0,
      amount: 0,
    };

    result.rows.forEach((row: any) => {
      const metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
      if (metadata && metadata.changes && Array.isArray(metadata.changes)) {
        metadata.changes.forEach((change: any) => {
          const field = change.field?.toLowerCase();
          if (field === 'description' && counts.description !== undefined) {
            counts.description++;
          } else if (field === 'category' && counts.category !== undefined) {
            counts.category++;
          } else if (field === 'label' && counts.label !== undefined) {
            counts.label++;
          } else if (field === 'date' && counts.date !== undefined) {
            counts.date++;
          } else if (field === 'amount' && counts.amount !== undefined) {
            counts.amount++;
          }
        });
      }
    });

    return NextResponse.json(counts, { status: 200 });

  } catch (error: any) {
    console.error('Error fetching edit counts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch edit counts', details: error.message },
      { status: 500 }
    );
  }
}

