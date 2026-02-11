import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';

export const dynamic = 'force-dynamic';

/**
 * Post-migration verification tests
 * Tests all functionality after table consolidation migration
 */
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

    const pool = getPool();
    if (!pool) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const results: any = {
      allPassed: true,
      tests: [],
      summary: {
        passed: 0,
        failed: 0,
        warnings: 0,
      },
    };

    // ============================================
    // 1. DATABASE STRUCTURE TESTS
    // ============================================
    
    // Test 1.1: l1_user_permissions table exists
    try {
      const check = await pool.query(`
        SELECT COUNT(*) as count FROM information_schema.tables 
        WHERE table_name = 'l1_user_permissions'
      `);
      const exists = parseInt(check.rows[0]?.count || '0') > 0;
      results.tests.push({
        category: 'Database Structure',
        name: 'l1_user_permissions table exists',
        status: exists ? 'pass' : 'fail',
        message: exists ? 'Table exists' : 'Table does not exist',
      });
      if (exists) results.summary.passed++; else { results.summary.failed++; results.allPassed = false; }
    } catch (e: any) {
      results.tests.push({
        category: 'Database Structure',
        name: 'l1_user_permissions table exists',
        status: 'fail',
        message: `Error: ${e.message}`,
      });
      results.summary.failed++;
      results.allPassed = false;
    }

    // Test 1.2: l0_pii_users has email and display_name
    try {
      const check = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'l0_pii_users' 
          AND column_name IN ('email', 'display_name')
      `);
      const hasEmail = check.rows.some((r: any) => r.column_name === 'email');
      const hasDisplayName = check.rows.some((r: any) => r.column_name === 'display_name');
      results.tests.push({
        category: 'Database Structure',
        name: 'l0_pii_users has email and display_name',
        status: hasEmail && hasDisplayName ? 'pass' : 'warn',
        message: hasEmail && hasDisplayName 
          ? 'Both columns exist' 
          : `Missing: ${!hasEmail ? 'email' : ''} ${!hasDisplayName ? 'display_name' : ''}`,
      });
      if (hasEmail && hasDisplayName) results.summary.passed++;
      else { results.summary.warnings++; results.allPassed = false; }
    } catch (e: any) {
      results.tests.push({
        category: 'Database Structure',
        name: 'l0_pii_users has email and display_name',
        status: 'fail',
        message: `Error: ${e.message}`,
      });
      results.summary.failed++;
      results.allPassed = false;
    }

    // Test 1.3: l0_pii_users.internal_user_id is primary key
    try {
      const check = await pool.query(`
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'l0_pii_users'
          AND tc.constraint_type = 'PRIMARY KEY'
      `);
      const isPK = check.rows.some((r: any) => r.column_name === 'internal_user_id');
      results.tests.push({
        category: 'Database Structure',
        name: 'l0_pii_users.internal_user_id is primary key',
        status: isPK ? 'pass' : 'fail',
        message: isPK ? 'internal_user_id is primary key' : 'internal_user_id is not primary key',
      });
      if (isPK) results.summary.passed++; else { results.summary.failed++; results.allPassed = false; }
    } catch (e: any) {
      results.tests.push({
        category: 'Database Structure',
        name: 'l0_pii_users.internal_user_id is primary key',
        status: 'fail',
        message: `Error: ${e.message}`,
      });
      results.summary.failed++;
      results.allPassed = false;
    }

    // Test 1.4: l1_customer_facts has no PII columns (migration complete)
    try {
      const check = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'l1_customer_facts'
          AND column_name IN ('age_range', 'province_region', 'migration_flag')
      `);
      const piiColumnsPresent = check.rows.map((r: any) => r.column_name);
      const allRemoved = piiColumnsPresent.length === 0;
      results.tests.push({
        category: 'Database Structure',
        name: 'l1_customer_facts PII columns removed',
        status: allRemoved ? 'pass' : 'fail',
        message: allRemoved
          ? 'age_range, province_region, migration_flag successfully removed'
          : `Run schema-change migration to drop: ${piiColumnsPresent.join(', ')}`,
      });
      if (allRemoved) results.summary.passed++;
      else { results.summary.failed++; results.allPassed = false; }
    } catch (e: any) {
      results.tests.push({
        category: 'Database Structure',
        name: 'l1_customer_facts PII columns removed',
        status: 'warn',
        message: `Could not check: ${e.message}`,
      });
      results.summary.warnings++;
    }

    // ============================================
    // 2. DATA INTEGRITY TESTS
    // ============================================

    // Test 2.1: All users have l1_user_permissions records
    try {
      const check = await pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM l1_user_permissions) as permissions_count,
          (SELECT COUNT(*) FROM l0_pii_users) as pii_count
      `);
      const permCount = parseInt(check.rows[0]?.permissions_count || '0');
      const piiCount = parseInt(check.rows[0]?.pii_count || '0');
      const match = permCount === piiCount;
      results.tests.push({
        category: 'Data Integrity',
        name: 'User records match between l1_user_permissions and l0_pii_users',
        status: match ? 'pass' : 'warn',
        message: match 
          ? `Both tables have ${permCount} records` 
          : `Mismatch: l1_user_permissions has ${permCount}, l0_pii_users has ${piiCount}`,
      });
      if (match) results.summary.passed++;
      else { results.summary.warnings++; }
    } catch (e: any) {
      results.tests.push({
        category: 'Data Integrity',
        name: 'User records match',
        status: 'fail',
        message: `Error: ${e.message}`,
      });
      results.summary.failed++;
      results.allPassed = false;
    }

    // Test 2.2: All l0_pii_users have emails
    try {
      const check = await pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(email) as with_email
        FROM l0_pii_users
      `);
      const total = parseInt(check.rows[0]?.total || '0');
      const withEmail = parseInt(check.rows[0]?.with_email || '0');
      const allHaveEmail = total === withEmail;
      results.tests.push({
        category: 'Data Integrity',
        name: 'All l0_pii_users have email',
        status: allHaveEmail ? 'pass' : 'warn',
        message: allHaveEmail 
          ? `All ${total} users have email` 
          : `${withEmail}/${total} users have email`,
      });
      if (allHaveEmail) results.summary.passed++;
      else { results.summary.warnings++; }
    } catch (e: any) {
      results.tests.push({
        category: 'Data Integrity',
        name: 'All l0_pii_users have email',
        status: 'fail',
        message: `Error: ${e.message}`,
      });
      results.summary.failed++;
      results.allPassed = false;
    }

    // Test 2.3: Foreign keys are valid
    try {
      const check = await pool.query(`
        SELECT COUNT(*) as count
        FROM l0_pii_users pii
        LEFT JOIN l1_user_permissions perm ON pii.internal_user_id = perm.id
        WHERE perm.id IS NULL
      `);
      const orphaned = parseInt(check.rows[0]?.count || '0');
      results.tests.push({
        category: 'Data Integrity',
        name: 'No orphaned l0_pii_users records',
        status: orphaned === 0 ? 'pass' : 'fail',
        message: orphaned === 0 
          ? 'All l0_pii_users have matching l1_user_permissions' 
          : `${orphaned} orphaned records found`,
      });
      if (orphaned === 0) results.summary.passed++;
      else { results.summary.failed++; results.allPassed = false; }
    } catch (e: any) {
      results.tests.push({
        category: 'Data Integrity',
        name: 'No orphaned l0_pii_users records',
        status: 'fail',
        message: `Error: ${e.message}`,
      });
      results.summary.failed++;
      results.allPassed = false;
    }

    // Test 2.4: PII data migration completeness (if users table still exists)
    try {
      const usersTableCheck = await pool.query(`
        SELECT COUNT(*) as count FROM information_schema.tables 
        WHERE table_name = 'users'
      `);
      const usersTableExists = parseInt(usersTableCheck.rows[0]?.count || '0') > 0;
      
      if (usersTableExists) {
        // Check if users table has email/display_name columns
        const usersColumns = await pool.query(`
          SELECT column_name FROM information_schema.columns
          WHERE table_name = 'users' 
            AND column_name IN ('email', 'display_name')
        `);
        const hasEmailCol = usersColumns.rows.some((r: any) => r.column_name === 'email');
        const hasDisplayNameCol = usersColumns.rows.some((r: any) => r.column_name === 'display_name');
        
        if (hasEmailCol || hasDisplayNameCol) {
          // Compare data between users and l0_pii_users
          const emailCheck = hasEmailCol ? await pool.query(`
            SELECT 
              COUNT(*) as total,
              COUNT(CASE WHEN u.email IS NOT NULL AND pii.email IS NOT NULL AND u.email = pii.email THEN 1 END) as matched,
              COUNT(CASE WHEN u.email IS NOT NULL AND (pii.email IS NULL OR u.email != pii.email) THEN 1 END) as mismatched
            FROM users u
            LEFT JOIN l0_pii_users pii ON u.id = pii.internal_user_id
          `) : null;
          
          const displayNameCheck = hasDisplayNameCol ? await pool.query(`
            SELECT 
              COUNT(*) as total,
              COUNT(CASE WHEN u.display_name IS NOT NULL AND pii.display_name IS NOT NULL AND u.display_name = pii.display_name THEN 1 END) as matched,
              COUNT(CASE WHEN u.display_name IS NOT NULL AND (pii.display_name IS NULL OR u.display_name != pii.display_name) THEN 1 END) as mismatched
            FROM users u
            LEFT JOIN l0_pii_users pii ON u.id = pii.internal_user_id
          `) : null;
          
          const emailStatus = emailCheck ? {
            total: parseInt(emailCheck.rows[0]?.total || '0'),
            matched: parseInt(emailCheck.rows[0]?.matched || '0'),
            mismatched: parseInt(emailCheck.rows[0]?.mismatched || '0'),
          } : null;
          
          const displayNameStatus = displayNameCheck ? {
            total: parseInt(displayNameCheck.rows[0]?.total || '0'),
            matched: parseInt(displayNameCheck.rows[0]?.matched || '0'),
            mismatched: parseInt(displayNameCheck.rows[0]?.mismatched || '0'),
          } : null;
          
          const allMatched = (!emailStatus || emailStatus.mismatched === 0) && 
                            (!displayNameStatus || displayNameStatus.mismatched === 0);
          
          let message = '';
          if (emailStatus) {
            message += `Email: ${emailStatus.matched}/${emailStatus.total} matched`;
            if (emailStatus.mismatched > 0) message += `, ${emailStatus.mismatched} mismatched`;
          }
          if (displayNameStatus) {
            if (message) message += '. ';
            message += `Display name: ${displayNameStatus.matched}/${displayNameStatus.total} matched`;
            if (displayNameStatus.mismatched > 0) message += `, ${displayNameStatus.mismatched} mismatched`;
          }
          
          results.tests.push({
            category: 'Data Integrity',
            name: 'PII data migration completeness (users → l0_pii_users)',
            status: allMatched ? 'pass' : 'warn',
            message: allMatched 
              ? `All PII data migrated: ${message}` 
              : `PII migration incomplete: ${message}`,
          });
          if (allMatched) results.summary.passed++;
          else { results.summary.warnings++; }
        } else {
          results.tests.push({
            category: 'Data Integrity',
            name: 'PII data migration completeness',
            status: 'pass',
            message: 'Users table no longer has email/display_name columns - migration complete',
          });
          results.summary.passed++;
        }
      } else {
        results.tests.push({
          category: 'Data Integrity',
          name: 'PII data migration completeness',
          status: 'pass',
          message: 'Users table does not exist - migration complete',
        });
        results.summary.passed++;
      }
    } catch (e: any) {
      results.tests.push({
        category: 'Data Integrity',
        name: 'PII data migration completeness',
        status: 'warn',
        message: `Could not verify: ${e.message}`,
      });
      results.summary.warnings++;
    }

    // ============================================
    // 3. API FUNCTIONALITY TESTS
    // ============================================

    // Test 3.1: Admin users endpoint works
    try {
      const check = await pool.query(`
        SELECT COUNT(*) as count FROM l1_user_permissions
      `);
      const count = parseInt(check.rows[0]?.count || '0');
      results.tests.push({
        category: 'API Functionality',
        name: 'Admin users endpoint can query l1_user_permissions',
        status: 'pass',
        message: `Can query ${count} users from l1_user_permissions`,
      });
      results.summary.passed++;
    } catch (e: any) {
      results.tests.push({
        category: 'API Functionality',
        name: 'Admin users endpoint can query l1_user_permissions',
        status: 'fail',
        message: `Error: ${e.message}`,
      });
      results.summary.failed++;
      results.allPassed = false;
    }

    // Test 3.2: Customer data endpoint can join tables
    try {
      const check = await pool.query(`
        SELECT COUNT(*) as count
        FROM l1_user_permissions perm
        LEFT JOIN l0_pii_users pii ON perm.id = pii.internal_user_id
        LIMIT 1
      `);
      results.tests.push({
        category: 'API Functionality',
        name: 'Customer data endpoint can join l1_user_permissions and l0_pii_users',
        status: 'pass',
        message: 'Join query successful',
      });
      results.summary.passed++;
    } catch (e: any) {
      results.tests.push({
        category: 'API Functionality',
        name: 'Customer data endpoint can join tables',
        status: 'fail',
        message: `Error: ${e.message}`,
      });
      results.summary.failed++;
      results.allPassed = false;
    }

    // Test 3.3: Analytics endpoints can query fact tables
    try {
      const check = await pool.query(`
        SELECT COUNT(*) as count FROM information_schema.tables 
        WHERE table_name IN ('l1_event_facts', 'l1_transaction_facts', 'l1_customer_facts')
      `);
      const factTables = parseInt(check.rows[0]?.count || '0');
      results.tests.push({
        category: 'API Functionality',
        name: 'Analytics fact tables exist',
        status: factTables === 3 ? 'pass' : 'warn',
        message: factTables === 3 
          ? 'All fact tables exist' 
          : `Found ${factTables}/3 fact tables`,
      });
      if (factTables === 3) results.summary.passed++;
      else { results.summary.warnings++; }
    } catch (e: any) {
      results.tests.push({
        category: 'API Functionality',
        name: 'Analytics fact tables exist',
        status: 'fail',
        message: `Error: ${e.message}`,
      });
      results.summary.failed++;
      results.allPassed = false;
    }

    // ============================================
    // 4. USER FUNCTIONALITY TESTS
    // ============================================

    // Test 4.1: Authentication can query l1_user_permissions
    try {
      const check = await pool.query(`
        SELECT COUNT(*) as count 
        FROM l1_user_permissions 
        WHERE password_hash IS NOT NULL
      `);
      const count = parseInt(check.rows[0]?.count || '0');
      results.tests.push({
        category: 'User Functionality',
        name: 'Authentication can query l1_user_permissions',
        status: count > 0 ? 'pass' : 'warn',
        message: count > 0 
          ? `${count} users have password hashes` 
          : 'No users with password hashes found',
      });
      if (count > 0) results.summary.passed++;
      else { results.summary.warnings++; }
    } catch (e: any) {
      results.tests.push({
        category: 'User Functionality',
        name: 'Authentication can query l1_user_permissions',
        status: 'fail',
        message: `Error: ${e.message}`,
      });
      results.summary.failed++;
      results.allPassed = false;
    }

    // Test 4.2: Email lookup can query l0_pii_users
    try {
      const check = await pool.query(`
        SELECT COUNT(*) as count 
        FROM l0_pii_users 
        WHERE email IS NOT NULL
      `);
      const count = parseInt(check.rows[0]?.count || '0');
      results.tests.push({
        category: 'User Functionality',
        name: 'Email lookup can query l0_pii_users',
        status: count > 0 ? 'pass' : 'warn',
        message: count > 0 
          ? `${count} users have emails in l0_pii_users` 
          : 'No emails found in l0_pii_users',
      });
      if (count > 0) results.summary.passed++;
      else { results.summary.warnings++; }
    } catch (e: any) {
      results.tests.push({
        category: 'User Functionality',
        name: 'Email lookup can query l0_pii_users',
        status: 'fail',
        message: `Error: ${e.message}`,
      });
      results.summary.failed++;
      results.allPassed = false;
    }

    // Test 4.3: Onboarding responses table exists (optional)
    try {
      const check = await pool.query(`
        SELECT COUNT(*) as count FROM information_schema.tables 
        WHERE table_name IN ('onboarding_responses', 'l1_onboarding_responses')
      `);
      const exists = parseInt(check.rows[0]?.count || '0') > 0;
      results.tests.push({
        category: 'User Functionality',
        name: 'Onboarding responses table exists',
        status: exists ? 'pass' : 'warn',
        message: exists ? 'Onboarding responses table exists' : 'Onboarding responses table not found (optional)',
      });
      if (exists) results.summary.passed++;
      else { results.summary.warnings++; }
    } catch (e: any) {
      results.tests.push({
        category: 'User Functionality',
        name: 'Onboarding responses table exists',
        status: 'warn',
        message: `Error: ${e.message}`,
      });
      results.summary.warnings++;
    }

    // ============================================
    // 5. ADMIN FUNCTIONALITY TESTS
    // ============================================

    // Test 5.1: Admin dashboard can query user data
    try {
      const check = await pool.query(`
        SELECT 
          COUNT(DISTINCT perm.id) as user_count,
          COUNT(DISTINCT pii.internal_user_id) as pii_count
        FROM l1_user_permissions perm
        LEFT JOIN l0_pii_users pii ON perm.id = pii.internal_user_id
      `);
      const userCount = parseInt(check.rows[0]?.user_count || '0');
      results.tests.push({
        category: 'Admin Functionality',
        name: 'Admin dashboard can query user data',
        status: userCount > 0 ? 'pass' : 'warn',
        message: userCount > 0 
          ? `Can query ${userCount} users for admin dashboard` 
          : 'No users found',
      });
      if (userCount > 0) results.summary.passed++;
      else { results.summary.warnings++; }
    } catch (e: any) {
      results.tests.push({
        category: 'Admin Functionality',
        name: 'Admin dashboard can query user data',
        status: 'fail',
        message: `Error: ${e.message}`,
      });
      results.summary.failed++;
      results.allPassed = false;
    }

    // Test 5.2: Analytics can query fact tables
    try {
      const check = await pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM l1_event_facts) as events,
          (SELECT COUNT(*) FROM l1_transaction_facts) as transactions,
          (SELECT COUNT(*) FROM l1_customer_facts) as customers
      `);
      const events = parseInt(check.rows[0]?.events || '0');
      const transactions = parseInt(check.rows[0]?.transactions || '0');
      const customers = parseInt(check.rows[0]?.customers || '0');
      results.tests.push({
        category: 'Admin Functionality',
        name: 'Analytics can query fact tables',
        status: 'pass',
        message: `Events: ${events}, Transactions: ${transactions}, Customers: ${customers}`,
      });
      results.summary.passed++;
    } catch (e: any) {
      results.tests.push({
        category: 'Admin Functionality',
        name: 'Analytics can query fact tables',
        status: 'fail',
        message: `Error: ${e.message}`,
      });
      results.summary.failed++;
      results.allPassed = false;
    }

    return NextResponse.json(results, { status: 200 });
  } catch (error: any) {
    console.error('[Post-Migration Verification] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to run verification tests', 
        details: error.message,
        allPassed: false,
        tests: [],
        summary: { passed: 0, failed: 1, warnings: 0 },
      },
      { status: 500 }
    );
  }
}

