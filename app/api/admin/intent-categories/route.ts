/**
 * Intent Categories API
 * Returns unique motivation/intent values from users table for filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
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

    // Pull intent categories from onboarding_responses.motivation (single source of truth)
    // Check if onboarding_responses table exists and has motivation column
    const schemaCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'onboarding_responses' 
      AND column_name = 'motivation'
      LIMIT 1
    `);
    
    const hasMotivation = schemaCheck.rows.length > 0;
    
    if (hasMotivation) {
      // Pull unique motivation values from onboarding_responses table (single source of truth)
      const result = await pool.query(`
        SELECT DISTINCT o.motivation
        FROM onboarding_responses o
        JOIN l1_user_permissions perm ON o.user_id = perm.id
        JOIN l0_pii_users pii ON perm.id = pii.internal_user_id
        WHERE o.motivation IS NOT NULL
          AND o.motivation != ''
          AND pii.email != $1
        ORDER BY o.motivation
      `, [ADMIN_EMAIL]);
      
      const categories = result.rows.map((row: any) => row.motivation).filter(Boolean);
      
      return NextResponse.json({
        success: true,
        categories: categories.length > 0 ? categories : [
          "Just exploring",
          "Get organized (see where my money goes, combine accounts)",
          "Improve my finances (spend smarter, save more, get back on track)",
          "Plan ahead (for a goal, trip, event or the next year)",
          "Discover smarter, AI-powered insights",
          "Something else"
        ],
      }, { status: 200 });
    } else {
      // Fallback: return standard intent categories if motivation column doesn't exist
      const allIntentCategories = [
        "Just exploring",
        "Get organized (see where my money goes, combine accounts)",
        "Improve my finances (spend smarter, save more, get back on track)",
        "Plan ahead (for a goal, trip, event or the next year)",
        "Discover smarter, AI-powered insights",
        "Something else"
      ];

      return NextResponse.json({
        success: true,
        categories: allIntentCategories,
      }, { status: 200 });
    }

  } catch (error: any) {
    console.error('[Intent Categories API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch intent categories', details: error.message },
      { status: 500 }
    );
  }
}

