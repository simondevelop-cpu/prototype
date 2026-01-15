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

    // Always return all 6 intent categories from the onboarding questionnaire
    // These are the standard options regardless of what data exists in the database
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

  } catch (error: any) {
    console.error('[Intent Categories API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch intent categories', details: error.message },
      { status: 500 }
    );
  }
}

