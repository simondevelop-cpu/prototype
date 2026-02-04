/**
 * API endpoint for storing user categorization corrections
 * Learns from user behavior to improve future auto-categorization
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

const JWT_SECRET = process.env.JWT_SECRET || 'canadian-insights-demo-secret-key-change-in-production';

/**
 * Extract cleaned pattern from description for matching
 * Remove numbers, store numbers, special chars
 */
function extractPattern(description: string): string {
  return description
    .toUpperCase()
    .replace(/#\d+/g, '') // Remove #1234
    .replace(/STORE\s*\d+/g, '') // Remove STORE 5678
    .replace(/\d{4,}/g, '') // Remove long numbers (reference codes)
    .replace(/\b[A-Z]{2}\s*$/g, '') // Remove province codes
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100); // Limit pattern length
}

/**
 * POST /api/categorization/learn
 * Store a user's categorization correction
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let userId: number;

    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (typeof payload === 'string' || !payload.sub) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
      userId = typeof payload.sub === 'number' ? payload.sub : parseInt(payload.sub, 10);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Parse request body
    const body = await req.json();
    const { description, originalCategory, originalLabel, correctedCategory, correctedLabel } = body;

    if (!description || !correctedCategory || !correctedLabel) {
      return NextResponse.json(
        { error: 'Missing required fields: description, correctedCategory, correctedLabel' },
        { status: 400 }
      );
    }

    // Extract pattern from description
    const pattern = extractPattern(description);

    // Use new table name (l2_user_categorization_learning) with fallback to old name
    let tableName = 'l2_user_categorization_learning';
    try {
      const tableCheck = await pool.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = $1`,
        [tableName]
      );
      if (tableCheck.rows.length === 0) {
        tableName = 'categorization_learning'; // Fallback to old name
      }
    } catch (e) {
      tableName = 'categorization_learning'; // Fallback on error
    }

    // Check if this pattern already exists for this user
    const existing = await pool.query(
      `SELECT id, frequency FROM ${tableName} 
       WHERE user_id = $1 AND description_pattern = $2`,
      [userId, pattern]
    );

    if (existing.rows.length > 0) {
      // Update existing pattern (increment frequency, update last_used)
      try {
        await pool.query(
          `UPDATE ${tableName} 
           SET frequency = frequency + 1,
               last_used = CURRENT_TIMESTAMP,
               corrected_category = $1,
               corrected_label = $2
           WHERE id = $3`,
          [correctedCategory, correctedLabel, existing.rows[0].id]
        );
      } catch {
        // Fallback for old schema without corrected_category/corrected_label
        await pool.query(
          `UPDATE ${tableName} 
           SET frequency = frequency + 1,
               last_used = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [existing.rows[0].id]
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Pattern updated',
        pattern,
        frequency: existing.rows[0].frequency + 1,
      });
    } else {
      // Insert new pattern into l2_user_categorization_learning
      await pool.query(
        `INSERT INTO l2_user_categorization_learning 
         (user_id, description_pattern, original_category, original_label, corrected_category, corrected_label)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, pattern, originalCategory, originalLabel, correctedCategory, correctedLabel]
      );
          } catch (fallbackError: any) {
            console.error('[Learn API] Fallback insert also failed:', fallbackError.message);
            console.error('[Learn API] Available columns might be different. Checking table schema...');
            // Try to get table structure for debugging
            const schemaCheck = await pool.query(`
              SELECT column_name, data_type 
              FROM information_schema.columns 
              WHERE table_name = 'categorization_learning'
            `);
            console.log('[Learn API] Table columns:', schemaCheck.rows);
            throw fallbackError;
          }
        } else {
          throw insertError;
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Pattern learned',
        pattern,
        frequency: 1,
      });
    }
  } catch (error: any) {
    console.error('[Learn API] Error learning categorization:', error);
    console.error('[Learn API] Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
    });
    return NextResponse.json({ 
      error: 'Failed to store learning',
      details: error.message,
      code: error.code 
    }, { status: 500 });
  }
}

/**
 * GET /api/categorization/learn
 * Retrieve learned patterns for the current user
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let userId: number;

    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (typeof payload === 'string' || !payload.sub) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
      userId = typeof payload.sub === 'number' ? payload.sub : parseInt(payload.sub, 10);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get all learned patterns for this user, ordered by frequency and recency
    const result = await pool.query(
      `SELECT 
         id,
         description_pattern,
         original_category,
         original_label,
         corrected_category,
         corrected_label,
         frequency,
         last_used,
         created_at
       FROM categorization_learning
       WHERE user_id = $1
       ORDER BY frequency DESC, last_used DESC`,
      [userId]
    );

    return NextResponse.json({
      patterns: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching learned patterns:', error);
    return NextResponse.json({ error: 'Failed to fetch patterns' }, { status: 500 });
  }
}

