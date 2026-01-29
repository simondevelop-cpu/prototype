import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { verifyRequestOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest) {
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

    const userId = decoded.userId || decoded.id || decoded.sub;
    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid token: no user ID' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { displayName, email } = body;

    const pool = getPool();
    if (!pool) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (displayName !== undefined) {
      updates.push(`display_name = $${paramCount++}`);
      values.push(displayName);
    }

    if (email !== undefined) {
      // Check if email is already taken by another user
      const emailCheck = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email.toLowerCase(), userId]
      );
      
      if (emailCheck.rows.length > 0) {
        return NextResponse.json(
          { error: 'Email address is already in use' },
          { status: 400 }
        );
      }

      updates.push(`email = $${paramCount++}`);
      values.push(email.toLowerCase());
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Add userId to values
    values.push(userId);

    // Update user
    const result = await pool.query(
      `UPDATE users 
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING id, email, display_name`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const user = result.rows[0];

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.display_name || user.email,
      },
    });
  } catch (error: any) {
    console.error('[API] Update account error:', error);
    return NextResponse.json(
      { error: 'Failed to update account', details: error.message },
      { status: 500 }
    );
  }
}

