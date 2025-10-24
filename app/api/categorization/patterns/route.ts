/**
 * PUBLIC endpoint for fetching categorization patterns
 * Used by the categorization engine (no auth required)
 */

import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
});

/**
 * GET /api/categorization/patterns
 * Returns keywords and merchants for categorization
 */
export async function GET() {
  try {
    // Fetch active keywords
    const keywordsResult = await pool.query(
      `SELECT id, keyword, category, label 
       FROM admin_keywords 
       WHERE is_active = true
       ORDER BY category, keyword`
    );

    // Fetch active merchants
    const merchantsResult = await pool.query(
      `SELECT id, merchant_pattern, alternate_patterns, category, label 
       FROM admin_merchants 
       WHERE is_active = true
       ORDER BY category, merchant_pattern`
    );

    return NextResponse.json({
      keywords: keywordsResult.rows,
      merchants: merchantsResult.rows,
    });
  } catch (error: any) {
    console.error('[Categorization Patterns] Error fetching patterns:', error);
    
    // Return empty arrays if tables don't exist yet
    if (error.message?.includes('does not exist')) {
      return NextResponse.json({
        keywords: [],
        merchants: [],
        warning: 'Tables not initialized yet',
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch patterns', details: error.message },
      { status: 500 }
    );
  }
}

