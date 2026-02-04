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

    // Log consent event - database unique constraint will prevent duplicates
    // No need to check first, as logConsentEvent uses INSERT ... ON CONFLICT DO NOTHING
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

