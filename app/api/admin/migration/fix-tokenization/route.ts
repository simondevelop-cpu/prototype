import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';
import { getTokenizedUserId } from '@/lib/tokenization';

export const dynamic = 'force-dynamic';

/**
 * Fix missing tokenization for users
 * Creates tokenization entries for users that don't have them
 */
export async function POST(request: NextRequest) {
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

    // Find users without tokenization
    const missingTokenization = await pool.query(`
      SELECT u.id, u.email
      FROM users u
      LEFT JOIN l0_user_tokenization ut ON u.id = ut.internal_user_id
      WHERE ut.tokenized_user_id IS NULL
    `);

    if (missingTokenization.rows.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All users have tokenization',
        fixed: 0,
      });
    }

    let fixed = 0;
    const errors: string[] = [];

    for (const user of missingTokenization.rows) {
      try {
        // Use getTokenizedUserId which will create it if it doesn't exist
        const tokenizedUserId = await getTokenizedUserId(user.id);
        
        if (tokenizedUserId) {
          fixed++;
          console.log(`[Fix Tokenization] ✅ Created tokenization for user ${user.id} (${user.email})`);
        } else {
          errors.push(`User ${user.id}: Could not create tokenization`);
        }
      } catch (error: any) {
        errors.push(`User ${user.id}: ${error.message}`);
        console.error(`[Fix Tokenization] ❌ Error for user ${user.id}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Fixed tokenization for ${fixed} user(s)`,
      fixed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('[Fix Tokenization API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fix tokenization', details: error.message },
      { status: 500 }
    );
  }
}

