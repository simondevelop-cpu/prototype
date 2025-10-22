import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { hashPassword, createToken } from '@/lib/auth';

// Force dynamic rendering (POST endpoint requires runtime request body)
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
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

    // Find user
    const userResult = await pool.query(
      'SELECT id, email, password_hash, display_name FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const user = userResult.rows[0];
    const passwordHash = hashPassword(password);

    if (passwordHash !== user.password_hash) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Create token
    const token = createToken(user.id);

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.display_name || user.email,
      },
    });
  } catch (error: any) {
    console.error('[API] Login error:', error);
    return NextResponse.json(
      { error: 'Login failed', details: error.message },
      { status: 500 }
    );
  }
}

