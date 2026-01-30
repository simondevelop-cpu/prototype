import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Extract user ID from token (token uses 'sub' field)
    const userId = decoded.userId || decoded.id || decoded.sub;
    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid token: no user ID' },
        { status: 401 }
      );
    }

    // Get consent type from query params
    const { searchParams } = new URL(request.url);
    const consentType = searchParams.get('type');

    if (!consentType) {
      return NextResponse.json(
        { error: 'Consent type is required' },
        { status: 400 }
      );
    }

    const validConsentTypes = ['cookie_banner', 'first_upload'];
    if (!validConsentTypes.includes(consentType)) {
      return NextResponse.json(
        { error: 'Invalid consent type' },
        { status: 400 }
      );
    }

    const pool = getPool();
    if (!pool) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    // Check if user_events table exists
    const tableCheck = await pool.query(`
      SELECT 1 
      FROM information_schema.tables 
      WHERE table_name = 'user_events'
      LIMIT 1
    `);

    if (tableCheck.rows.length === 0) {
      // Table doesn't exist, no consent recorded
      return NextResponse.json({
        hasConsent: false,
        timestamp: null,
      });
    }

    // Check for existing consent event
    const result = await pool.query(`
      SELECT event_timestamp, metadata->>'choice' as choice
      FROM user_events
      WHERE user_id = $1
        AND event_type = 'consent'
        AND metadata->>'consentType' = $2
      ORDER BY event_timestamp DESC
      LIMIT 1
    `, [userId, consentType]);

    if (result.rows.length > 0) {
      return NextResponse.json({
        hasConsent: true,
        timestamp: result.rows[0].event_timestamp,
        choice: result.rows[0].choice,
      });
    }

    return NextResponse.json({
      hasConsent: false,
      timestamp: null,
    });
  } catch (error: any) {
    console.error('[API] Consent check error:', error);
    return NextResponse.json(
      { error: 'Failed to check consent', details: error.message },
      { status: 500 }
    );
  }
}

