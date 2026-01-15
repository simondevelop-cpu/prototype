/**
 * ONE-TIME MIGRATION ENDPOINT
 * Updates existing admin tables to new schema
 * - Removes score and language columns from admin_keywords
 * - Removes score column and adds alternate_patterns to admin_merchants
 */

import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
});

export async function POST() {
  const migrations: string[] = [];
  const errors: string[] = [];

  try {
    // Migration 1: Update admin_keywords table
    try {
      await pool.query(`
        ALTER TABLE admin_keywords 
        DROP COLUMN IF EXISTS score,
        DROP COLUMN IF EXISTS language
      `);
      migrations.push('✅ Removed score and language from admin_keywords');
    } catch (error: any) {
      if (!error.message?.includes('does not exist')) {
        errors.push(`admin_keywords migration: ${error.message}`);
      }
    }

    // Migration 2: Update admin_merchants table
    try {
      // Add alternate_patterns column if it doesn't exist
      await pool.query(`
        ALTER TABLE admin_merchants 
        ADD COLUMN IF NOT EXISTS alternate_patterns TEXT[]
      `);
      migrations.push('✅ Added alternate_patterns to admin_merchants');
    } catch (error: any) {
      errors.push(`admin_merchants alternate_patterns: ${error.message}`);
    }

    try {
      // Remove score column
      await pool.query(`
        ALTER TABLE admin_merchants 
        DROP COLUMN IF EXISTS score
      `);
      migrations.push('✅ Removed score from admin_merchants');
    } catch (error: any) {
      if (!error.message?.includes('does not exist')) {
        errors.push(`admin_merchants score removal: ${error.message}`);
      }
    }

    // Migration 3: Add UNIQUE constraint to admin_keywords if not exists
    try {
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'admin_keywords_keyword_category_key'
          ) THEN
            ALTER TABLE admin_keywords 
            ADD CONSTRAINT admin_keywords_keyword_category_key UNIQUE (keyword, category);
          END IF;
        END $$;
      `);
      migrations.push('✅ Added UNIQUE constraint to admin_keywords');
    } catch (error: any) {
      // Constraint errors are non-critical
      console.warn('Constraint migration warning:', error.message);
    }

    return NextResponse.json({
      success: true,
      message: 'Schema migration completed',
      migrations,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Migration failed', 
        details: error.message,
        migrations,
        errors,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Check current schema
    const keywordsSchema = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'admin_keywords'
      ORDER BY ordinal_position
    `);

    const merchantsSchema = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'admin_merchants'
      ORDER BY ordinal_position
    `);

    return NextResponse.json({
      current_schema: {
        admin_keywords: keywordsSchema.rows,
        admin_merchants: merchantsSchema.rows,
      },
      needs_migration: {
        keywords_has_score: keywordsSchema.rows.some((r: any) => r.column_name === 'score'),
        keywords_has_language: keywordsSchema.rows.some((r: any) => r.column_name === 'language'),
        merchants_has_score: merchantsSchema.rows.some((r: any) => r.column_name === 'score'),
        merchants_has_alternate_patterns: merchantsSchema.rows.some((r: any) => r.column_name === 'alternate_patterns'),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to check schema', details: error.message },
      { status: 500 }
    );
  }
}

