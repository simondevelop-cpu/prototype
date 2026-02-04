/**
 * Sessions API - Returns session data grouped by session_id
 * Shows session length and event counts per session
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';

export const dynamic = 'force-dynamic';

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

    // Check for session_id column in l1_event_facts
    let hasSessions = false;
    try {
      const columnCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'l1_event_facts'
          AND column_name = 'session_id'
        LIMIT 1
      `);
      hasSessions = columnCheck.rows.length > 0;
    } catch (e) {
      console.log('[Sessions API] Could not check for session_id column');
    }

    if (!hasSessions) {
      return NextResponse.json({
        success: true,
        sessions: [],
        message: 'Session tracking not available - session_id column does not exist in l1_event_facts table. Run migration to add it.',
      }, { status: 200 });
    }

    // Get all sessions with their event counts from l1_event_facts
    // Group by session_id and user_id, calculate session duration, and count events by type
    const sessionsQuery = `
      SELECT 
        e.user_id,
        e.session_id,
        MIN(e.event_timestamp) as session_start,
        MAX(e.event_timestamp) as session_end,
        EXTRACT(EPOCH FROM (MAX(e.event_timestamp) - MIN(e.event_timestamp)))::int as session_duration_seconds,
        COUNT(*) FILTER (WHERE e.event_type = 'login') as login_count,
        COUNT(*) FILTER (WHERE e.event_type = 'statement_upload') as statement_upload_count,
        COUNT(*) FILTER (WHERE e.event_type = 'statement_linked') as statement_linked_count,
        COUNT(*) FILTER (WHERE e.event_type = 'transaction_edit') as transaction_edit_count,
        COUNT(*) FILTER (WHERE e.event_type = 'bulk_edit') as bulk_edit_count,
        COUNT(*) FILTER (WHERE e.event_type = 'consent') as consent_count,
        COUNT(*) FILTER (WHERE e.event_type = 'feedback') as feedback_count,
        COUNT(*) as total_events
      FROM l1_event_facts e
      WHERE e.session_id IS NOT NULL
        AND e.is_admin = FALSE
      GROUP BY e.user_id, e.session_id
      ORDER BY session_start DESC
      LIMIT 1000
    `;

    const result = await pool.query(sessionsQuery);

    const sessions = result.rows.map((row: any) => ({
      userId: row.user_id,
      sessionId: row.session_id,
      sessionStart: row.session_start,
      sessionEnd: row.session_end,
      sessionDurationSeconds: row.session_duration_seconds,
      sessionDurationFormatted: formatDuration(row.session_duration_seconds),
      eventCounts: {
        login: parseInt(row.login_count) || 0,
        statementUpload: parseInt(row.statement_upload_count) || 0,
        statementLinked: parseInt(row.statement_linked_count) || 0,
        transactionEdit: parseInt(row.transaction_edit_count) || 0,
        bulkEdit: parseInt(row.bulk_edit_count) || 0,
        consent: parseInt(row.consent_count) || 0,
        feedback: parseInt(row.feedback_count) || 0,
        total: parseInt(row.total_events) || 0,
      },
    }));

    return NextResponse.json({
      success: true,
      sessions,
      total: sessions.length,
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Sessions API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions', details: error.message },
      { status: 500 }
    );
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
}

