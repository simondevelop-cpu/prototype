import { NextRequest, NextResponse } from 'next/server';
import { verifyRequestOrigin } from '@/lib/csrf';
import { logConsentEvent } from '@/lib/event-logger';
import { verifyToken } from '@/lib/auth';
import { getPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { consentType, choice, setting, value, ...otherMetadata } = body;

    // Validate consent type
    const validConsentTypes = ['cookie_banner', 'first_upload', 'account_linking', 'settings_update'];
    if (!validConsentTypes.includes(consentType)) {
      return NextResponse.json(
        { error: 'Invalid consent type' },
        { status: 400 }
      );
    }

    // Check if consent already exists for this user and type
    const pool = getPool();
    if (pool) {
      try {
        const existingConsent = await pool.query(
          `SELECT id FROM l1_events 
           WHERE user_id = $1 
             AND event_type = 'consent' 
             AND metadata->>'consentType' = $2 
           LIMIT 1`,
          [userId, consentType]
        );

        if (existingConsent.rows.length > 0) {
          // Consent already exists, don't log again
          return NextResponse.json({ success: true, alreadyExists: true });
        }
      } catch (checkError) {
        // If check fails, continue to log (don't block)
        console.warn('[API] Could not check existing consent:', checkError);
      }
    }

    // Log consent event (only if it doesn't already exist)
    await logConsentEvent(userId, consentType as any, {
      choice,
      setting,
      value,
      ...otherMetadata,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API] Consent error:', error);
    return NextResponse.json(
      { error: 'Failed to record consent', details: error.message },
      { status: 500 }
    );
  }
}

