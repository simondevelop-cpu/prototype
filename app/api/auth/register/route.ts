import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { hashPassword, createToken } from '@/lib/auth';

// Force dynamic rendering (POST endpoint requires runtime request body)
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

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

    // Check if user exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        { error: 'This email is already registered. Please sign in instead.' },
        { status: 400 }
      );
    }

    // Create user
    const passwordHash = hashPassword(password);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, email, display_name',
      [email.toLowerCase(), passwordHash, name || email]
    );

    const user = result.rows[0];

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
    console.error('[API] Register error:', error);
    return NextResponse.json(
      { error: 'Registration failed', details: error.message },
      { status: 500 }
    );
  }
}

