import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';

export const dynamic = 'force-dynamic';

/**
 * Test endpoint for table consolidation migration
 * Tests all aspects of the migration without making changes
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

    const pool = getPool();
    if (!pool) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const results: any = {
      passed: true,
      tests: [],
      warnings: [],
      errors: [],
      summary: {
        usersTableExists: false,
        usersRowCount: 0,
        l0PiiUsersExists: false,
        l0PiiUsersRowCount: 0,
        onboardingResponsesExists: false,
        onboardingResponsesRowCount: 0,
        canCreateL1UserPermissions: false,
        foreignKeyDependencies: [],
      },
    };

    // Test 1: Check if users table exists
    try {
      const usersCheck = await pool.query(`
        SELECT COUNT(*) as count FROM information_schema.tables 
        WHERE table_name = 'users'
      `);
      results.summary.usersTableExists = parseInt(usersCheck.rows[0]?.count || '0') > 0;
      
      if (results.summary.usersTableExists) {
        const usersCount = await pool.query('SELECT COUNT(*) as count FROM users');
        results.summary.usersRowCount = parseInt(usersCount.rows[0]?.count || '0');
        results.tests.push({
          name: 'Users table exists',
          status: 'pass',
          message: `Found ${results.summary.usersRowCount} users`,
        });
      } else {
        results.tests.push({
          name: 'Users table exists',
          status: 'fail',
          message: 'Users table not found',
        });
        results.passed = false;
        results.errors.push('Users table does not exist');
      }
    } catch (error: any) {
      results.tests.push({
        name: 'Users table exists',
        status: 'error',
        message: error.message,
      });
      results.passed = false;
      results.errors.push(`Error checking users table: ${error.message}`);
    }

    // Test 2: Check users table schema
    if (results.summary.usersTableExists) {
      try {
        const columns = await pool.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = 'users'
          ORDER BY ordinal_position
        `);
        
        const requiredColumns = ['id', 'email', 'password_hash', 'created_at'];
        const optionalColumns = ['display_name', 'login_attempts', 'is_active', 'email_validated', 'updated_at'];
        const foundColumns = columns.rows.map((r: any) => r.column_name);
        
        const missingRequired = requiredColumns.filter(col => !foundColumns.includes(col));
        if (missingRequired.length > 0) {
          results.tests.push({
            name: 'Users table schema',
            status: 'fail',
            message: `Missing required columns: ${missingRequired.join(', ')}`,
          });
          results.passed = false;
          results.errors.push(`Missing required columns in users table: ${missingRequired.join(', ')}`);
        } else {
          results.tests.push({
            name: 'Users table schema',
            status: 'pass',
            message: `Found ${foundColumns.length} columns`,
          });
        }
      } catch (error: any) {
        results.tests.push({
          name: 'Users table schema',
          status: 'error',
          message: error.message,
        });
        results.errors.push(`Error checking users schema: ${error.message}`);
      }
    }

    // Test 3: Check l0_pii_users table
    try {
      const piiCheck = await pool.query(`
        SELECT COUNT(*) as count FROM information_schema.tables 
        WHERE table_name = 'l0_pii_users'
      `);
      results.summary.l0PiiUsersExists = parseInt(piiCheck.rows[0]?.count || '0') > 0;
      
      if (results.summary.l0PiiUsersExists) {
        const piiCount = await pool.query('SELECT COUNT(*) as count FROM l0_pii_users');
        results.summary.l0PiiUsersRowCount = parseInt(piiCount.rows[0]?.count || '0');
        
        // Check if email and display_name columns exist
        const piiColumns = await pool.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_name = 'l0_pii_users'
        `);
        const piiColumnNames = piiColumns.rows.map((r: any) => r.column_name);
        const hasEmail = piiColumnNames.includes('email');
        const hasDisplayName = piiColumnNames.includes('display_name');
        
        results.tests.push({
          name: 'l0_pii_users table exists',
          status: 'pass',
          message: `Found ${results.summary.l0PiiUsersRowCount} records. Email column: ${hasEmail ? 'Yes' : 'No'}, Display name column: ${hasDisplayName ? 'Yes' : 'No'}`,
        });
        
        if (!hasEmail || !hasDisplayName) {
          results.warnings.push('l0_pii_users missing email or display_name columns - will be added during migration');
        }
      } else {
        results.tests.push({
          name: 'l0_pii_users table exists',
          status: 'fail',
          message: 'l0_pii_users table not found',
        });
        results.passed = false;
        results.errors.push('l0_pii_users table does not exist');
      }
    } catch (error: any) {
      results.tests.push({
        name: 'l0_pii_users table exists',
        status: 'error',
        message: error.message,
      });
      results.errors.push(`Error checking l0_pii_users: ${error.message}`);
    }

    // Test 4: Check onboarding_responses table
    try {
      const onboardingCheck = await pool.query(`
        SELECT COUNT(*) as count FROM information_schema.tables 
        WHERE table_name = 'onboarding_responses'
      `);
      results.summary.onboardingResponsesExists = parseInt(onboardingCheck.rows[0]?.count || '0') > 0;
      
      if (results.summary.onboardingResponsesExists) {
        const onboardingCount = await pool.query('SELECT COUNT(*) as count FROM onboarding_responses');
        results.summary.onboardingResponsesRowCount = parseInt(onboardingCount.rows[0]?.count || '0');
        results.tests.push({
          name: 'onboarding_responses table exists',
          status: 'pass',
          message: `Found ${results.summary.onboardingResponsesRowCount} records`,
        });
      } else {
        results.tests.push({
          name: 'onboarding_responses table exists',
          status: 'warning',
          message: 'onboarding_responses table not found (optional)',
        });
        results.warnings.push('onboarding_responses table does not exist (this is OK if no users have completed onboarding)');
      }
    } catch (error: any) {
      results.tests.push({
        name: 'onboarding_responses table exists',
        status: 'error',
        message: error.message,
      });
      results.warnings.push(`Error checking onboarding_responses: ${error.message}`);
    }

    // Test 5: Check if l1_user_permissions table already exists
    try {
      const l1PermsCheck = await pool.query(`
        SELECT COUNT(*) as count FROM information_schema.tables 
        WHERE table_name = 'l1_user_permissions'
      `);
      const l1PermsExists = parseInt(l1PermsCheck.rows[0]?.count || '0') > 0;
      
      if (l1PermsExists) {
        results.tests.push({
          name: 'l1_user_permissions table',
          status: 'warning',
          message: 'l1_user_permissions table already exists - migration may have already run',
        });
        results.warnings.push('l1_user_permissions table already exists');
      } else {
        results.tests.push({
          name: 'l1_user_permissions table',
          status: 'pass',
          message: 'l1_user_permissions table does not exist - ready to create',
        });
        results.summary.canCreateL1UserPermissions = true;
      }
    } catch (error: any) {
      results.tests.push({
        name: 'l1_user_permissions table',
        status: 'error',
        message: error.message,
      });
      results.errors.push(`Error checking l1_user_permissions: ${error.message}`);
    }

    // Test 6: Check foreign key dependencies
    try {
      const fkCheck = await pool.query(`
        SELECT
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name,
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
      `);
      
      results.summary.foreignKeyDependencies = fkCheck.rows.map((row: any) => ({
        table: row.table_name,
        column: row.column_name,
        references: `${row.foreign_table_name}.${row.foreign_column_name}`,
        constraint: row.constraint_name,
      }));
      
      if (results.summary.foreignKeyDependencies.length > 0) {
        results.tests.push({
          name: 'Foreign key dependencies',
          status: 'pass',
          message: `Found ${results.summary.foreignKeyDependencies.length} tables with foreign keys to users`,
        });
      } else {
        results.tests.push({
          name: 'Foreign key dependencies',
          status: 'warning',
          message: 'No foreign key dependencies found (unusual)',
        });
      }
    } catch (error: any) {
      results.tests.push({
        name: 'Foreign key dependencies',
        status: 'error',
        message: error.message,
      });
      results.warnings.push(`Error checking foreign keys: ${error.message}`);
    }

    // Test 7: Check data integrity - users without l0_pii_users
    if (results.summary.usersTableExists && results.summary.l0PiiUsersExists) {
      try {
        const orphanedUsers = await pool.query(`
          SELECT COUNT(*) as count
          FROM users u
          LEFT JOIN l0_pii_users p ON u.id = p.internal_user_id
          WHERE p.internal_user_id IS NULL
        `);
        const orphanedCount = parseInt(orphanedUsers.rows[0]?.count || '0');
        
        if (orphanedCount > 0) {
          results.tests.push({
            name: 'Data integrity - orphaned users',
            status: 'warning',
            message: `${orphanedCount} users without l0_pii_users records`,
          });
          results.warnings.push(`${orphanedCount} users do not have corresponding l0_pii_users records - will be created during migration`);
        } else {
          results.tests.push({
            name: 'Data integrity - orphaned users',
            status: 'pass',
            message: 'All users have l0_pii_users records',
          });
        }
      } catch (error: any) {
        results.tests.push({
          name: 'Data integrity - orphaned users',
          status: 'error',
          message: error.message,
        });
        results.warnings.push(`Error checking orphaned users: ${error.message}`);
      }
    }

    // Test 8: Check for duplicate emails
    if (results.summary.usersTableExists) {
      try {
        const duplicateEmails = await pool.query(`
          SELECT email, COUNT(*) as count
          FROM users
          GROUP BY email
          HAVING COUNT(*) > 1
        `);
        
        if (duplicateEmails.rows.length > 0) {
          results.tests.push({
            name: 'Data integrity - duplicate emails',
            status: 'fail',
            message: `Found ${duplicateEmails.rows.length} duplicate emails`,
          });
          results.passed = false;
          results.errors.push(`Found duplicate emails: ${duplicateEmails.rows.map((r: any) => r.email).join(', ')}`);
        } else {
          results.tests.push({
            name: 'Data integrity - duplicate emails',
            status: 'pass',
            message: 'No duplicate emails found',
          });
        }
      } catch (error: any) {
        results.tests.push({
          name: 'Data integrity - duplicate emails',
          status: 'error',
          message: error.message,
        });
        results.warnings.push(`Error checking duplicate emails: ${error.message}`);
      }
    }

    return NextResponse.json(results, { status: results.passed ? 200 : 400 });
  } catch (error: any) {
    console.error('[Migration Test] Error:', error);
    return NextResponse.json(
      { error: 'Failed to test migration', details: error.message },
      { status: 500 }
    );
  }
}

