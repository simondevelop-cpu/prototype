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

    // Check token age - if it's older than 30 minutes, don't refresh (force re-login)
    const tokenAge = Date.now() / 1000 - (payload.iat || payload.exp - 30 * 60);
    const MAX_TOKEN_AGE_SECONDS = 30 * 60; // 30 minutes
    
    if (tokenAge > MAX_TOKEN_AGE_SECONDS) {
      return NextResponse.json(
        { error: 'Token too old - please log in again' },
        { status: 401 }
      );
    }

    // Create new token with 30-minute expiration
    const newToken = createToken(userId);

    return NextResponse.json({
      token: newToken,
      expiresIn: 30 * 60, // 30 minutes in seconds
    });
  } catch (error: any) {
    console.error('[API] Token refresh error:', error);
    return NextResponse.json(
      { error: 'Token refresh failed' },
      { status: 500 }
    );
  }
}

