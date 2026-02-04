import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';

export const dynamic = 'force-dynamic';

/**
 * Execute table consolidation migration
 * Migrates users table to l1_user_permissions and moves PII to l0_pii_users
 */
export async function POST(request: NextRequest) {
  try {
    // Check admin authentication first
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

    const client = await pool.connect();

    const results: any = {
      success: true,
      steps: [],
      errors: [],
      warnings: [],
      summary: {
        usersMigrated: 0,
        piiRecordsUpdated: 0,
        foreignKeysUpdated: 0,
      },
    };

    // Start transaction
    await client.query('BEGIN');

    try {
      // Step 1: Check if users table exists
      const usersCheck = await client.query(`
        SELECT COUNT(*) as count FROM information_schema.tables 
        WHERE table_name = 'users'
      `);
      
      if (parseInt(usersCheck.rows[0]?.count || '0') === 0) {
        throw new Error('Users table does not exist');
      }

      const usersCount = await client.query('SELECT COUNT(*) as count FROM users');
      const totalUsers = parseInt(usersCount.rows[0]?.count || '0');
      
      results.steps.push({
        step: 1,
        name: 'Check users table',
        status: 'success',
        message: `Found ${totalUsers} users`,
      });

      // Step 2: Create l1_user_permissions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS l1_user_permissions (
          id INTEGER PRIMARY KEY,
          password_hash TEXT NOT NULL,
          login_attempts INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT TRUE,
          email_validated BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          account_creation_consent_at TIMESTAMP WITH TIME ZONE,
          cookie_consent_at TIMESTAMP WITH TIME ZONE,
          cookie_consent_choice TEXT,
          first_upload_consent_at TIMESTAMP WITH TIME ZONE
        )
      `);

      // Check for consent columns in users table and add to l1_user_permissions if they exist
      const usersColumns = await client.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'users'
      `);
      const usersColumnNames = usersColumns.rows.map((r: any) => r.column_name);
      
      if (usersColumnNames.includes('account_creation_consent_at')) {
        await client.query(`
          ALTER TABLE l1_user_permissions 
          ADD COLUMN IF NOT EXISTS account_creation_consent_at TIMESTAMP WITH TIME ZONE
        `);
      }
      if (usersColumnNames.includes('cookie_consent_at')) {
        await client.query(`
          ALTER TABLE l1_user_permissions 
          ADD COLUMN IF NOT EXISTS cookie_consent_at TIMESTAMP WITH TIME ZONE
        `);
      }
      if (usersColumnNames.includes('cookie_consent_choice')) {
        await client.query(`
          ALTER TABLE l1_user_permissions 
          ADD COLUMN IF NOT EXISTS cookie_consent_choice TEXT
        `);
      }
      if (usersColumnNames.includes('first_upload_consent_at')) {
        await client.query(`
          ALTER TABLE l1_user_permissions 
          ADD COLUMN IF NOT EXISTS first_upload_consent_at TIMESTAMP WITH TIME ZONE
        `);
      }

      results.steps.push({
        step: 2,
        name: 'Create l1_user_permissions table',
        status: 'success',
        message: 'Table created successfully',
      });

      // Step 3: Update l0_pii_users - add email and display_name columns if not exist
      await client.query(`
        ALTER TABLE l0_pii_users 
        ADD COLUMN IF NOT EXISTS email TEXT
      `);
      await client.query(`
        ALTER TABLE l0_pii_users 
        ADD COLUMN IF NOT EXISTS display_name TEXT
      `);

      // Make internal_user_id the PRIMARY KEY if it's not already
      try {
        // Check which column(s) the primary key is currently on
        const pkCheck = await client.query(`
          SELECT 
            tc.constraint_name,
            kcu.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          WHERE tc.table_name = 'l0_pii_users'
            AND tc.constraint_type = 'PRIMARY KEY'
        `);
        
        const pkColumns = pkCheck.rows.map((row: any) => row.column_name);
        const hasInternalUserIdPK = pkColumns.includes('internal_user_id');
        const hasIdPK = pkColumns.includes('id');
        
        if (!hasInternalUserIdPK) {
          // If there's a primary key on 'id' or any other column, drop it first
          if (pkCheck.rows.length > 0) {
            const constraintName = pkCheck.rows[0].constraint_name;
            await client.query(`
              ALTER TABLE l0_pii_users DROP CONSTRAINT IF EXISTS "${constraintName}"
            `);
          }
          
          // Check if id column exists and drop it if it does
          const idColumnCheck = await client.query(`
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'l0_pii_users' AND column_name = 'id'
          `);
          
          if (idColumnCheck.rows.length > 0) {
            // Drop id column (constraint already dropped above)
            await client.query(`
              ALTER TABLE l0_pii_users DROP COLUMN IF EXISTS id
            `);
          }
          
          // Make internal_user_id the primary key
          await client.query(`
            ALTER TABLE l0_pii_users ADD CONSTRAINT l0_pii_users_pkey PRIMARY KEY (internal_user_id)
          `);
        } else {
          // internal_user_id is already the primary key, but we might still need to drop the id column
          const idColumnCheck = await client.query(`
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'l0_pii_users' AND column_name = 'id'
          `);
          
          if (idColumnCheck.rows.length > 0) {
            // Drop id column if it exists (but keep the PK on internal_user_id)
            await client.query(`
              ALTER TABLE l0_pii_users DROP COLUMN IF EXISTS id
            `);
          }
        }
      } catch (e: any) {
        console.error('[Migration] Error updating l0_pii_users primary key:', e);
        results.warnings.push(`Could not update l0_pii_users primary key: ${e.message}`);
      }

      // Add unique constraint on email if not exists
      try {
        await client.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_l0_pii_users_email 
          ON l0_pii_users(email) 
          WHERE email IS NOT NULL
        `);
      } catch (e: any) {
        results.warnings.push(`Could not add unique index on email: ${e.message}`);
      }

      results.steps.push({
        step: 3,
        name: 'Update l0_pii_users schema',
        status: 'success',
        message: 'Added email and display_name columns',
      });

      // Step 4: Migrate data from users to l1_user_permissions
      // Build INSERT statement dynamically based on which columns exist in users table
      const baseColumns = ['id', 'password_hash', 'login_attempts', 'is_active', 'email_validated', 'created_at', 'updated_at'];
      const consentColumns = ['account_creation_consent_at', 'cookie_consent_at', 'cookie_consent_choice', 'first_upload_consent_at'];
      
      // Filter to only include consent columns that exist in users table
      const existingConsentColumns = consentColumns.filter(col => usersColumnNames.includes(col));
      
      // Build column lists
      const insertColumns = [...baseColumns, ...existingConsentColumns];
      const selectColumns = [
        'id',
        'password_hash',
        'COALESCE(login_attempts, 0) as login_attempts',
        'COALESCE(is_active, TRUE) as is_active',
        'COALESCE(email_validated, FALSE) as email_validated',
        'created_at',
        'COALESCE(updated_at, created_at) as updated_at',
        ...existingConsentColumns // These columns exist in users, so we can select them directly
      ];
      
      const migratePermissions = await client.query(`
        INSERT INTO l1_user_permissions (${insertColumns.join(', ')})
        SELECT ${selectColumns.join(', ')}
        FROM users
        ON CONFLICT (id) DO NOTHING
      `);

      results.summary.usersMigrated = migratePermissions.rowCount || 0;
      results.steps.push({
        step: 4,
        name: 'Migrate permissions data',
        status: 'success',
        message: `Migrated ${results.summary.usersMigrated} users to l1_user_permissions`,
      });

      // Step 5: Migrate email and display_name to l0_pii_users
      const migratePII = await client.query(`
        INSERT INTO l0_pii_users (
          internal_user_id, email, display_name, created_at, updated_at
        )
        SELECT 
          id as internal_user_id,
          email,
          display_name,
          created_at,
          COALESCE(updated_at, created_at) as updated_at
        FROM users
        ON CONFLICT (internal_user_id) 
        DO UPDATE SET
          email = EXCLUDED.email,
          display_name = EXCLUDED.display_name,
          updated_at = EXCLUDED.updated_at
        WHERE l0_pii_users.email IS NULL 
           OR l0_pii_users.display_name IS NULL
           OR l0_pii_users.email != EXCLUDED.email
           OR l0_pii_users.display_name != EXCLUDED.display_name
      `);

      results.summary.piiRecordsUpdated = migratePII.rowCount || 0;
      results.steps.push({
        step: 5,
        name: 'Migrate PII data',
        status: 'success',
        message: `Updated ${results.summary.piiRecordsUpdated} PII records`,
      });

      // Step 6: Update foreign key constraints
      // Get all foreign keys that reference users.id
      const foreignKeys = await client.query(`
        SELECT
          tc.table_name,
          kcu.column_name,
          tc.constraint_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = 'users'
          AND ccu.column_name = 'id'
      `);

      for (const fk of foreignKeys.rows) {
        try {
          // Drop old foreign key
          await client.query(`
            ALTER TABLE "${fk.table_name}"
            DROP CONSTRAINT IF EXISTS "${fk.constraint_name}"
          `);
          
          // Check if new constraint already exists
          const newConstraintName = `${fk.table_name}_user_id_fkey`;
          const existingConstraintCheck = await client.query(`
            SELECT constraint_name
            FROM information_schema.table_constraints
            WHERE table_name = $1
              AND constraint_name = $2
              AND constraint_type = 'FOREIGN KEY'
          `, [fk.table_name, newConstraintName]);
          
          if (existingConstraintCheck.rows.length === 0) {
            // Add new foreign key pointing to l1_user_permissions
            await client.query(`
              ALTER TABLE "${fk.table_name}"
              ADD CONSTRAINT "${newConstraintName}"
              FOREIGN KEY ("${fk.column_name}")
              REFERENCES l1_user_permissions(id)
              ON DELETE CASCADE
            `);
          }
          
          results.summary.foreignKeysUpdated++;
        } catch (e: any) {
          console.error(`[Migration] Error updating foreign key ${fk.constraint_name} on ${fk.table_name}:`, e);
          results.warnings.push(`Could not update foreign key ${fk.constraint_name} on ${fk.table_name}: ${e.message}`);
        }
      }

      results.steps.push({
        step: 6,
        name: 'Update foreign keys',
        status: 'success',
        message: `Updated ${results.summary.foreignKeysUpdated} foreign key constraints`,
      });

      // Step 7: Verify data integrity
      const verifyPermissions = await client.query(`
        SELECT COUNT(*) as count FROM l1_user_permissions
      `);
      const verifyPII = await client.query(`
        SELECT COUNT(*) as count FROM l0_pii_users WHERE email IS NOT NULL
      `);

      if (parseInt(verifyPermissions.rows[0]?.count || '0') !== totalUsers) {
        throw new Error(`Data integrity check failed: Expected ${totalUsers} users in l1_user_permissions, found ${verifyPermissions.rows[0]?.count}`);
      }

      results.steps.push({
        step: 7,
        name: 'Verify data integrity',
        status: 'success',
        message: `Verified: ${verifyPermissions.rows[0]?.count} users in l1_user_permissions, ${verifyPII.rows[0]?.count} with email in l0_pii_users`,
      });

      // Commit transaction
      await client.query('COMMIT');
      
      results.steps.push({
        step: 8,
        name: 'Migration complete',
        status: 'success',
        message: 'All steps completed successfully',
      });

      return NextResponse.json(results, { status: 200 });
    } catch (error: any) {
      // Rollback on error
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError: any) {
        console.error('[Migration] Error during rollback:', rollbackError);
      }
      
      console.error('[Migration] Migration error:', {
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
        name: 'Migration failed',
        status: 'error',
        message: error.message || 'Unknown error occurred',
      });
      return NextResponse.json(results, { status: 500 });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[Migration] Unexpected error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to execute migration', 
        details: error.message,
        success: false,
        steps: [],
        errors: [error.message],
      },
      { status: 500 }
    );
  }
}

