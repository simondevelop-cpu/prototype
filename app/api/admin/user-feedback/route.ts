import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

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

    // Check if l1_event_facts or l1_events table exists (migration-safe)
    let eventsTable = 'l1_event_facts';
    let hasUserEventsTable = false;
    try {
      const newTableCheck = await pool.query(`
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'l1_event_facts'
        LIMIT 1
      `);
      if (newTableCheck.rows.length > 0) {
        eventsTable = 'l1_event_facts';
        hasUserEventsTable = true;
      } else {
        const oldTableCheck = await pool.query(`
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'l1_events'
          LIMIT 1
        `);
        if (oldTableCheck.rows.length > 0) {
          eventsTable = 'l1_events';
          hasUserEventsTable = true;
        }
      }
    } catch (e) {
      console.log('[User Feedback API] Could not check for events table');
    }

    if (!hasUserEventsTable) {
      return NextResponse.json({ 
        success: true,
        feedback: [],
        message: 'Events table does not exist. Feedback will appear once the table is created and feedback is submitted.'
      }, { status: 200 });
    }

    // Fetch all feedback events
    const result = await pool.query(`
      SELECT 
        e.id,
        e.user_id,
        COALESCE(p.first_name, 'Unknown') as first_name,
        e.event_timestamp as submitted_at,
        e.metadata
      FROM ${eventsTable} e
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN l0_pii_users p ON u.id = p.internal_user_id AND p.deleted_at IS NULL
      WHERE e.event_type = 'feedback'
        AND (u.email != $1 OR u.email IS NULL)
      ORDER BY e.event_timestamp DESC
      LIMIT 1000
    `, [ADMIN_EMAIL]);
    
    // Parse metadata and format feedback
    const feedback = result.rows.map((row: any) => {
      let metadata: {
        usefulness?: number;
        trust?: number;
        problems?: string;
        learnMore?: string;
      } = {};
      try {
        metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
      } catch (e) {
        console.error('[User Feedback API] Failed to parse metadata:', e);
      }

      return {
        id: row.id,
        userId: row.user_id,
        firstName: row.first_name,
        submittedAt: row.submitted_at,
        usefulness: metadata.usefulness ?? null,
        trust: metadata.trust ?? null,
        problems: metadata.problems ?? null,
        learnMore: metadata.learnMore ?? null,
      };
    });

    return NextResponse.json({ 
      success: true,
      feedback,
      total: feedback.length
    }, { status: 200 });

  } catch (error: any) {
    console.error('[User Feedback API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user feedback', details: error.message },
      { status: 500 }
    );
  }
}

