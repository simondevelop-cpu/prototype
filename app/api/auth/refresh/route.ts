import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, createToken } from '@/lib/auth';
import { verifyRequestOrigin } from '@/lib/csrf';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * Refresh user token endpoint
 * Validates the current token and issues a new one with extended expiration
 */
export async function POST(request: NextRequest) {
  try {
    // CSRF protection
    if (!verifyRequestOrigin(request)) {
      return NextResponse.json(
        { error: 'Invalid request origin' },
        { status: 403 }
      );
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Extract user ID from token
    const userId = payload.sub || payload.userId || payload.id;
    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid token: no user ID' },
        { status: 401 }
      );
    }

    // Create new token with extended expiration
    const newToken = createToken(userId);

    return NextResponse.json({
      token: newToken,
      expiresIn: 24 * 60 * 60, // 24 hours in seconds
    });
  } catch (error: any) {
    console.error('[API] Token refresh error:', error);
    return NextResponse.json(
      { error: 'Token refresh failed' },
      { status: 500 }
    );
  }
}

