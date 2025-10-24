/**
 * API endpoint for batch storing categorization corrections
 * Used when user confirms categorized transactions during statement import
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

function extractPattern(description: string): string {
  return description
    .toUpperCase()
    .replace(/#\d+/g, '')
    .replace(/STORE\s*\d+/g, '')
    .replace(/\d{4,}/g, '')
    .replace(/\b[A-Z]{2}\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

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

    const body = await req.json();
    const { corrections } = body;

    if (!Array.isArray(corrections) || corrections.length === 0) {
      return NextResponse.json({ error: 'corrections must be a non-empty array' }, { status: 400 });
    }

    let learned = 0;
    let updated = 0;

    // Process each correction
    for (const correction of corrections) {
      const { description, originalCategory, originalLabel, correctedCategory, correctedLabel } = correction;

      if (!description || !correctedCategory || !correctedLabel) {
        continue; // Skip invalid entries
      }

      // Only learn if the user actually changed something
      if (originalCategory === correctedCategory && originalLabel === correctedLabel) {
        continue; // Skip unchanged entries
      }

      const pattern = extractPattern(description);

      // Check if pattern exists
      const existing = await pool.query(
        `SELECT id, frequency FROM categorization_learning 
         WHERE user_id = $1 AND description_pattern = $2`,
        [userId, pattern]
      );

      if (existing.rows.length > 0) {
        // Update existing
        await pool.query(
          `UPDATE categorization_learning 
           SET frequency = frequency + 1,
               last_used = CURRENT_TIMESTAMP,
               corrected_category = $1,
               corrected_label = $2
           WHERE id = $3`,
          [correctedCategory, correctedLabel, existing.rows[0].id]
        );
        updated++;
      } else {
        // Insert new
        await pool.query(
          `INSERT INTO categorization_learning 
           (user_id, description_pattern, original_category, original_label, corrected_category, corrected_label)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [userId, pattern, originalCategory, originalLabel, correctedCategory, correctedLabel]
        );
        learned++;
      }
    }

    return NextResponse.json({
      success: true,
      learned,
      updated,
      total: learned + updated,
    });
  } catch (error) {
    console.error('Error batch learning:', error);
    return NextResponse.json({ error: 'Failed to process batch learning' }, { status: 500 });
  }
}

