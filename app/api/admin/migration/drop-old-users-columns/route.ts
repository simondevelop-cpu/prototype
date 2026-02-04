import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';

export const dynamic = 'force-dynamic';

/**
 * Drop email and display_name columns from users table
 * Only safe to run after:
 * 1. All PII data is verified in l0_pii_users
 * 2. All code references to users.email and users.display_name are removed
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { confirm } = body;

    if (confirm !== 'DROP_USERS_COLUMNS') {
      return NextResponse.json(
        { error: 'Confirmation required. Send { "confirm": "DROP_USERS_COLUMNS" }' },
        { status: 400 }
      );
    }

    const pool = getPool();
    if (!pool) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const client = await pool.connect();
    const results: any = {
      success: true,
      steps: [],
      errors: [],
      warnings: [],
    };

    try {
      await client.query('BEGIN');

      // Step 1: Verify users table exists
      const usersTableCheck = await client.query(`
        SELECT COUNT(*) as count FROM information_schema.tables 
        WHERE table_name = 'users'
      `);
      
      if (parseInt(usersTableCheck.rows[0]?.count || '0') === 0) {
        throw new Error('Users table does not exist');
      }

      results.steps.push({
        step: 1,
        name: 'Verify users table exists',
        status: 'success',
        message: 'Users table found',
      });

      // Step 2: Check if email column exists and drop it
      const emailColumnCheck = await client.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'email'
      `);

      if (emailColumnCheck.rows.length > 0) {
        // Check for any constraints/indexes on email column
        try {
          const emailConstraints = await client.query(`
            SELECT 
              tc.constraint_name, 
              tc.constraint_type,
              kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            WHERE tc.table_name = 'users' 
              AND tc.table_schema = 'public'
              AND kcu.column_name = 'email'
          `);

          // Drop unique constraint/index on email if it exists
          for (const constraint of emailConstraints.rows) {
            try {
              await client.query(`
                ALTER TABLE users DROP CONSTRAINT IF EXISTS "${constraint.constraint_name}" CASCADE
              `);
              results.warnings.push(`Dropped constraint ${constraint.constraint_name} on email column`);
            } catch (e: any) {
              results.warnings.push(`Could not drop constraint ${constraint.constraint_name}: ${e.message}`);
            }
          }
        } catch (constraintError: any) {
          // If constraint check fails, try to drop anyway (might not have constraints)
          results.warnings.push(`Could not check constraints: ${constraintError.message}`);
        }

        // Also check for indexes on email column
        try {
          const emailIndexes = await client.query(`
            SELECT indexname
            FROM pg_indexes
            WHERE tablename = 'users' 
              AND indexdef LIKE '%email%'
          `);

          for (const index of emailIndexes.rows) {
            try {
              await client.query(`DROP INDEX IF EXISTS "${index.indexname}" CASCADE`);
              results.warnings.push(`Dropped index ${index.indexname} on email column`);
            } catch (e: any) {
              results.warnings.push(`Could not drop index ${index.indexname}: ${e.message}`);
            }
          }
        } catch (indexError: any) {
          results.warnings.push(`Could not check indexes: ${indexError.message}`);
        }

        // Drop email column
        await client.query(`
          ALTER TABLE users DROP COLUMN IF EXISTS email CASCADE
        `);

        results.steps.push({
          step: 2,
          name: 'Drop email column',
          status: 'success',
          message: 'Email column dropped from users table',
        });
      } else {
        results.steps.push({
          step: 2,
          name: 'Drop email column',
          status: 'skipped',
          message: 'Email column does not exist',
        });
      }

      // Step 3: Check if display_name column exists and drop it
      const displayNameColumnCheck = await client.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'display_name'
      `);

      if (displayNameColumnCheck.rows.length > 0) {
        await client.query(`
          ALTER TABLE users DROP COLUMN IF EXISTS display_name CASCADE
        `);

        results.steps.push({
          step: 3,
          name: 'Drop display_name column',
          status: 'success',
          message: 'Display name column dropped from users table',
        });
      } else {
        results.steps.push({
          step: 3,
          name: 'Drop display_name column',
          status: 'skipped',
          message: 'Display name column does not exist',
        });
      }

      // Step 4: Verify columns are dropped
      const remainingColumns = await client.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'users' 
          AND column_name IN ('email', 'display_name')
      `);

      if (remainingColumns.rows.length > 0) {
        throw new Error(`Failed to drop columns: ${remainingColumns.rows.map((r: any) => r.column_name).join(', ')}`);
      }

      results.steps.push({
        step: 4,
        name: 'Verify columns dropped',
        status: 'success',
        message: 'Email and display_name columns successfully removed',
      });

      await client.query('COMMIT');

      results.steps.push({
        step: 5,
        name: 'Cleanup complete',
        status: 'success',
        message: 'All steps completed successfully',
      });

      return NextResponse.json(results, { status: 200 });
    } catch (error: any) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError: any) {
        console.error('[Drop Users Columns] Error during rollback:', rollbackError);
      }
      
      console.error('[Drop Users Columns] Migration error:', {
        message: error.message,
        detail: error.detail,
        hint: error.hint,
        code: error.code,
        stack: error.stack,
      });
      
      results.success = false;
      results.errors.push(error.message || 'Unknown error');
      if (error.detail) results.errors.push(`Detail: ${error.detail}`);
      if (error.hint) results.errors.push(`Hint: ${error.hint}`);
      
      results.steps.push({
        step: 'error',
        name: 'Cleanup failed',
        status: 'error',
        message: error.message || 'Unknown error occurred',
      });
      return NextResponse.json(results, { status: 500 });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[Drop Users Columns] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to drop columns', 
        details: error.message,
        success: false,
        steps: [],
        errors: [error.message],
      },
      { status: 500 }
    );
  }
}

