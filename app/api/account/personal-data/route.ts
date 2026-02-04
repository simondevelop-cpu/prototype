import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { verifyRequestOrigin } from '@/lib/csrf';
import { getClientIpAddress, updateUserIpAddress } from '@/lib/ip-address';

export const dynamic = 'force-dynamic';

// GET: Fetch personal data
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

    const userId = decoded.userId || decoded.id || decoded.sub;
    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid token: no user ID' },
        { status: 401 }
      );
    }

    const pool = getPool();
    if (!pool) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    // Fetch from l0_pii_users (display_name, email)
    const userResult = await pool.query(`
      SELECT perm.id, pii.email, pii.display_name
      FROM l1_user_permissions perm
      JOIN l0_pii_users pii ON perm.id = pii.internal_user_id
      WHERE perm.id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const user = userResult.rows[0];

    // Try to fetch PII from l0_pii_users
    let piiData: any = {};
    try {
      const piiResult = await pool.query(
        'SELECT first_name, last_name, date_of_birth, recovery_phone, province_region FROM l0_pii_users WHERE internal_user_id = $1 AND deleted_at IS NULL',
        [userId]
      );

      if (piiResult.rows.length > 0) {
        piiData = {
          firstName: piiResult.rows[0].first_name || '',
          lastName: piiResult.rows[0].last_name || '',
          dateOfBirth: piiResult.rows[0].date_of_birth || '',
          recoveryPhone: piiResult.rows[0].recovery_phone || '',
          provinceRegion: piiResult.rows[0].province_region || '',
        };
      }
    } catch (error) {
      // l0_pii_users might not exist (pre-migration), that's okay
      console.log('[Personal Data API] l0_pii_users table not available');
    }

    return NextResponse.json({
      success: true,
      personalData: {
        displayName: user.display_name || '',
        email: user.email || '',
        ...piiData,
      },
    });
  } catch (error: any) {
    console.error('[API] Get personal data error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch personal data', details: error.message },
      { status: 500 }
    );
  }
}

// PUT: Update personal data
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
    const { displayName, email, firstName, lastName, dateOfBirth, recoveryPhone, provinceRegion } = body;

    const pool = getPool();
    if (!pool) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    // Update users table
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

    if (updates.length > 0) {
      values.push(userId);
      await pool.query(
        `UPDATE users 
         SET ${updates.join(', ')}, updated_at = NOW()
         WHERE id = $${paramCount}`,
        values
      );
    }

    // Update l0_pii_users if PII fields are provided
    if (firstName !== undefined || lastName !== undefined || dateOfBirth !== undefined || 
        recoveryPhone !== undefined || provinceRegion !== undefined) {
      try {
        // Get user email for l0_pii_users
        const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
        const userEmail = userResult.rows[0]?.email || '';

        await pool.query(
          `INSERT INTO l0_pii_users (
            internal_user_id, email, first_name, last_name, date_of_birth, 
            recovery_phone, province_region, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          ON CONFLICT (internal_user_id) 
          DO UPDATE SET
            email = EXCLUDED.email,
            first_name = COALESCE(EXCLUDED.first_name, l0_pii_users.first_name),
            last_name = COALESCE(EXCLUDED.last_name, l0_pii_users.last_name),
            date_of_birth = COALESCE(EXCLUDED.date_of_birth, l0_pii_users.date_of_birth),
            recovery_phone = COALESCE(EXCLUDED.recovery_phone, l0_pii_users.recovery_phone),
            province_region = COALESCE(EXCLUDED.province_region, l0_pii_users.province_region),
            updated_at = NOW()`,
          [
            userId,
            userEmail,
            firstName || null,
            lastName || null,
            dateOfBirth || null,
            recoveryPhone || null,
            provinceRegion || null,
          ]
        );
        
        // Log IP address when PII is updated
        const ipAddress = getClientIpAddress(request);
        if (ipAddress) {
          await updateUserIpAddress(userId, ipAddress);
        }
      } catch (error: any) {
        // l0_pii_users might not exist (pre-migration), that's okay
        if (error.code !== '42P01') { // Not "table doesn't exist" error
          console.error('[Personal Data API] Error updating PII:', error);
        }
      }
    }

    // Fetch updated data
    const userResult = await pool.query(
      'SELECT id, email, display_name FROM users WHERE id = $1',
      [userId]
    );

    let piiData: any = {};
    try {
      const piiResult = await pool.query(
        'SELECT first_name, last_name, date_of_birth, recovery_phone, province_region FROM l0_pii_users WHERE internal_user_id = $1 AND deleted_at IS NULL',
        [userId]
      );

      if (piiResult.rows.length > 0) {
        piiData = {
          firstName: piiResult.rows[0].first_name || '',
          lastName: piiResult.rows[0].last_name || '',
          dateOfBirth: piiResult.rows[0].date_of_birth || '',
          recoveryPhone: piiResult.rows[0].recovery_phone || '',
          provinceRegion: piiResult.rows[0].province_region || '',
        };
      }
    } catch (error) {
      // Ignore if table doesn't exist
    }

    const user = userResult.rows[0];

    return NextResponse.json({
      success: true,
      personalData: {
        displayName: user.display_name || '',
        email: user.email || '',
        ...piiData,
      },
    });
  } catch (error: any) {
    console.error('[API] Update personal data error:', error);
    return NextResponse.json(
      { error: 'Failed to update personal data', details: error.message },
      { status: 500 }
    );
  }
}

