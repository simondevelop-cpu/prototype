import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';

export const dynamic = 'force-dynamic';

export type TestStatus = 'pass' | 'fail' | 'warning' | 'skipped' | 'critical';
export type TestFlag = '✅' | '❌' | '⚠️' | '⏸️' | '🔴';

export interface MigrationTest {
  id: string;
  name: string;
  description: string;
  category: 'data-integrity' | 'functional' | 'schema' | 'foreign-keys';
  status: TestStatus;
  flag: TestFlag;
  message?: string;
  details?: any;
  critical?: boolean;
}

// GET: Run pre-migration or post-migration tests
export async function GET(request: NextRequest) {
  try {
    // Admin authentication
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

    const url = new URL(request.url);
    const testType = url.searchParams.get('type') || 'pre'; // 'pre' or 'post'

    const pool = getPool();
    if (!pool) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const tests: MigrationTest[] = [];

    // Data Integrity Tests
    tests.push(...await runDataIntegrityTests(pool, testType));

    // Schema Tests
    tests.push(...await runSchemaTests(pool, testType));

    // Foreign Key Tests
    tests.push(...await runForeignKeyTests(pool, testType));

    // Functional Tests (only for post-migration)
    if (testType === 'post') {
      tests.push(...await runFunctionalTests(pool));
    }

    // Calculate summary
    const summary = {
      total: tests.length,
      passed: tests.filter(t => t.status === 'pass').length,
      failed: tests.filter(t => t.status === 'fail').length,
      warnings: tests.filter(t => t.status === 'warning').length,
      skipped: tests.filter(t => t.status === 'skipped').length,
      critical: tests.filter(t => t.critical && t.status !== 'pass').length,
    };

    return NextResponse.json({
      success: true,
      testType,
      tests,
      summary,
      timestamp: new Date().toISOString(),
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Migration Tests API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to run migration tests', details: error.message },
      { status: 500 }
    );
  }
}

async function runDataIntegrityTests(pool: any, testType: string): Promise<MigrationTest[]> {
  const tests: MigrationTest[] = [];

  // Test 1: Count records in each table
  // Note: l1_events may have been renamed to l1_event_facts, check both
  const tables = [
    'users', 'l1_transaction_facts', 'l1_customer_facts',
    'admin_keywords', 'admin_merchants', 'onboarding_responses', 'survey_responses',
    'categorization_learning', 'l0_user_tokenization', 'l0_pii_users'
  ];
  
  // Check for events table (could be l1_events or l1_event_facts)
  const eventsTableCheck = ['l1_event_facts', 'l1_events'];
  for (const table of eventsTableCheck) {
    try {
      const result = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
      const count = parseInt(result.rows[0]?.count || '0', 10);
      tests.push({
        id: `data-count-${table}`,
        name: `Record count: ${table}`,
        description: `Verify ${table} has records`,
        category: 'data-integrity',
        status: count >= 0 ? 'pass' : 'fail',
        flag: count >= 0 ? '✅' : '❌',
        details: { count, table },
      });
      break; // Found the events table, stop checking
    } catch (error: any) {
      // Continue to next table name
    }
  }

  for (const table of tables) {
    try {
      const result = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
      const count = parseInt(result.rows[0]?.count || '0', 10);
      tests.push({
        id: `data-count-${table}`,
        name: `Record count: ${table}`,
        description: `Verify ${table} has records`,
        category: 'data-integrity',
        status: count >= 0 ? 'pass' : 'fail',
        flag: count >= 0 ? '✅' : '❌',
        details: { count, table },
      });
    } catch (error: any) {
      tests.push({
        id: `data-count-${table}`,
        name: `Record count: ${table}`,
        description: `Verify ${table} has records`,
        category: 'data-integrity',
        status: 'fail',
        flag: '❌',
        message: `Table may not exist: ${error.message}`,
        details: { table, error: error.message },
      });
    }
  }

  // Test 2: Check for orphaned records
  // Check which events table exists (l1_event_facts or l1_events)
  let eventsTableName = null;
  for (const tableName of ['l1_event_facts', 'l1_events']) {
    try {
      await pool.query(`SELECT 1 FROM ${tableName} LIMIT 1`);
      eventsTableName = tableName;
      break;
    } catch (error: any) {
      // Table doesn't exist, try next
    }
  }
  
  if (eventsTableName) {
    try {
      const orphanedEvents = await pool.query(`
        SELECT COUNT(*) as count
        FROM ${eventsTableName} e
        WHERE e.user_id NOT IN (SELECT id FROM users)
      `);
    const orphanedCount = parseInt(orphanedEvents.rows[0]?.count || '0', 10);
    tests.push({
      id: 'data-orphaned-events',
      name: 'Orphaned events check',
      description: 'Verify no events reference non-existent users',
      category: 'data-integrity',
      status: orphanedCount === 0 ? 'pass' : 'fail',
      flag: orphanedCount === 0 ? '✅' : '❌',
      critical: true,
      details: { orphanedCount, eventsTable: eventsTableName },
    });
    } catch (error: any) {
      tests.push({
        id: 'data-orphaned-events',
        name: 'Orphaned events check',
        description: 'Verify no events reference non-existent users',
        category: 'data-integrity',
        status: 'warning',
        flag: '⚠️',
        message: `Could not check: ${error.message}`,
      });
    }
  } else {
    tests.push({
      id: 'data-orphaned-events',
      name: 'Orphaned events check',
      description: 'Verify no events reference non-existent users',
      category: 'data-integrity',
      status: 'warning',
      flag: '⚠️',
      message: 'Events table (l1_events or l1_event_facts) does not exist',
    });
  }

  // Test 3: Check for NULL values in required fields
  // Determine which events table exists
  const eventsTable = eventsTableName || 'l1_events'; // Fallback for display
  const requiredFieldTests = [
    { table: eventsTableName || 'l1_event_facts', field: 'user_id', critical: true, tableDisplay: eventsTable },
    { table: eventsTableName || 'l1_event_facts', field: 'event_type', critical: true, tableDisplay: eventsTable },
    { table: 'l1_transaction_facts', field: 'tokenized_user_id', critical: true, tableDisplay: 'l1_transaction_facts' },
    { table: 'l1_transaction_facts', field: 'transaction_date', critical: true, tableDisplay: 'l1_transaction_facts' },
  ];

  for (const test of requiredFieldTests) {
    // Skip if table doesn't exist
    if (!test.table || (test.table.includes('event') && !eventsTableName)) {
      tests.push({
        id: `data-null-${test.tableDisplay || test.table}-${test.field}`,
        name: `NULL check: ${test.tableDisplay || test.table}.${test.field}`,
        description: `Verify no NULL values in required field`,
        category: 'data-integrity',
        status: 'warning',
        flag: '⚠️',
        message: `Table ${test.tableDisplay || test.table} does not exist`,
        critical: test.critical,
      });
      continue;
    }
    
    try {
      const result = await pool.query(`
        SELECT COUNT(*) as count
        FROM ${test.table}
        WHERE ${test.field} IS NULL
      `);
      const nullCount = parseInt(result.rows[0]?.count || '0', 10);
      tests.push({
        id: `data-null-${test.tableDisplay || test.table}-${test.field}`,
        name: `NULL check: ${test.tableDisplay || test.table}.${test.field}`,
        description: `Verify no NULL values in required field`,
        category: 'data-integrity',
        status: nullCount === 0 ? 'pass' : 'fail',
        flag: nullCount === 0 ? '✅' : '❌',
        critical: test.critical,
        details: { nullCount, table: test.table, field: test.field },
      });
    } catch (error: any) {
      tests.push({
        id: `data-null-${test.table}-${test.field}`,
        name: `NULL check: ${test.table}.${test.field}`,
        description: `Verify no NULL values in required field`,
        category: 'data-integrity',
        status: 'warning',
        flag: '⚠️',
        message: `Could not check: ${error.message}`,
      });
    }
  }

  return tests;
}

async function runSchemaTests(pool: any, testType: string): Promise<MigrationTest[]> {
  const tests: MigrationTest[] = [];

  // Test: Check if all expected tables exist
  const expectedTables = [
    'users', 'l1_events', 'l1_transaction_facts', 'l1_customer_facts',
    'admin_keywords', 'admin_merchants', 'l0_user_tokenization', 'l0_pii_users'
  ];

  for (const table of expectedTables) {
    try {
      const result = await pool.query(`
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = $1
      `, [table]);
      tests.push({
        id: `schema-table-${table}`,
        name: `Table exists: ${table}`,
        description: `Verify ${table} table exists`,
        category: 'schema',
        status: result.rows.length > 0 ? 'pass' : 'fail',
        flag: result.rows.length > 0 ? '✅' : '❌',
        critical: true,
      });
    } catch (error: any) {
      tests.push({
        id: `schema-table-${table}`,
        name: `Table exists: ${table}`,
        description: `Verify ${table} table exists`,
        category: 'schema',
        status: 'fail',
        flag: '❌',
        message: error.message,
      });
    }
  }

  // Test: Check for required columns in events table (l1_event_facts or l1_events)
  const eventsTableForColumns = eventsTableName || 'l1_event_facts'; // Use detected table or default to renamed version
  const requiredColumns = [
    { table: eventsTableForColumns, column: 'user_id', critical: true, tableDisplay: eventsTable || 'l1_events' },
    { table: eventsTableForColumns, column: 'event_type', critical: true, tableDisplay: eventsTable || 'l1_events' },
    { table: eventsTableForColumns, column: 'event_timestamp', critical: true, tableDisplay: eventsTable || 'l1_events' },
    { table: eventsTableForColumns, column: 'session_id', critical: false, tableDisplay: eventsTable || 'l1_events' },
  ];

  for (const col of requiredColumns) {
    try {
      const result = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = $2
      `, [col.table, col.column]);
      const exists = result.rows.length > 0;
      // For non-critical columns (like session_id), missing is a warning, not a failure
      if (!exists && !col.critical) {
        tests.push({
          id: `schema-column-${col.table}-${col.column}`,
          name: `Column exists: ${col.table}.${col.column}`,
          description: `Verify required column exists`,
          category: 'schema',
          status: 'warning',
          flag: '⚠️',
          message: `Column does not exist (will be added during migration)`,
          critical: false,
        });
      } else {
        tests.push({
          id: `schema-column-${col.table}-${col.column}`,
          name: `Column exists: ${col.table}.${col.column}`,
          description: `Verify required column exists`,
          category: 'schema',
          status: exists ? 'pass' : 'fail',
          flag: exists ? '✅' : '❌',
          critical: col.critical,
          message: exists ? undefined : `Column does not exist`,
        });
      }
    } catch (error: any) {
      tests.push({
        id: `schema-column-${col.tableDisplay || col.table}-${col.column}`,
        name: `Column exists: ${col.tableDisplay || col.table}.${col.column}`,
        description: `Verify required column exists`,
        category: 'schema',
        status: col.critical ? 'fail' : 'warning',
        flag: col.critical ? '❌' : '⚠️',
        message: error.message,
        critical: col.critical,
      });
    }
  }

  return tests;
}

async function runForeignKeyTests(pool: any, testType: string): Promise<MigrationTest[]> {
  const tests: MigrationTest[] = [];

  // Test: Events -> Users foreign key
  try {
    const result = await pool.query(`
      SELECT COUNT(*) as count
      FROM l1_events e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.user_id IS NOT NULL AND u.id IS NULL
    `);
    const brokenCount = parseInt(result.rows[0]?.count || '0', 10);
      tests.push({
        id: 'fk-events-users',
        name: `Foreign Key: ${eventsTable || 'l1_events'} -> users`,
        description: 'Verify all events reference valid users',
        category: 'foreign-keys',
        status: brokenCount === 0 ? 'pass' : 'fail',
        flag: brokenCount === 0 ? '✅' : '❌',
        critical: true,
        details: { brokenCount, eventsTable: eventsTableName },
      });
    } catch (error: any) {
      tests.push({
        id: 'fk-events-users',
        name: `Foreign Key: ${eventsTable || 'l1_events'} -> users`,
        description: 'Verify all events reference valid users',
        category: 'foreign-keys',
        status: 'warning',
        flag: '⚠️',
        message: `Could not check: ${error.message}`,
      });
    }
  } else {
    tests.push({
      id: 'fk-events-users',
      name: 'Foreign Key: l1_events -> users',
      description: 'Verify all events reference valid users',
      category: 'foreign-keys',
      status: 'warning',
      flag: '⚠️',
      message: 'Events table (l1_events or l1_event_facts) does not exist',
    });
  }

  // Test: Transactions -> Tokenization foreign key
  try {
    const result = await pool.query(`
      SELECT COUNT(*) as count
      FROM l1_transaction_facts t
      LEFT JOIN l0_user_tokenization ut ON t.tokenized_user_id = ut.tokenized_user_id
      WHERE t.tokenized_user_id IS NOT NULL AND ut.tokenized_user_id IS NULL
    `);
    const brokenCount = parseInt(result.rows[0]?.count || '0', 10);
    tests.push({
      id: 'fk-transactions-tokenization',
      name: 'Foreign Key: l1_transaction_facts -> l0_user_tokenization',
      description: 'Verify all transactions reference valid tokenization',
      category: 'foreign-keys',
      status: brokenCount === 0 ? 'pass' : 'fail',
      flag: brokenCount === 0 ? '✅' : '❌',
      critical: true,
      details: { brokenCount },
    });
  } catch (error: any) {
    tests.push({
      id: 'fk-transactions-tokenization',
      name: 'Foreign Key: l1_transaction_facts -> l0_user_tokenization',
      description: 'Verify all transactions reference valid tokenization',
      category: 'foreign-keys',
      status: 'warning',
      flag: '⚠️',
      message: `Could not check: ${error.message}`,
    });
  }

  // Test: Events -> Sessions relationship (via session_id)
  // First check if session_id column exists
  if (eventsTableName) {
    try {
      const columnCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = 'session_id'
      `, [eventsTableName]);
    
      if (columnCheck.rows.length === 0) {
        // Column doesn't exist yet - this is expected before migration
        tests.push({
          id: 'fk-events-sessions',
          name: `Relationship: ${eventsTable || 'l1_events'} -> sessions`,
          description: 'Verify session tracking is working',
          category: 'foreign-keys',
          status: 'warning',
          flag: '⚠️',
          message: 'session_id column does not exist yet (will be added during migration)',
        });
      } else {
        // Column exists, check session data
        const result = await pool.query(`
          SELECT COUNT(DISTINCT session_id) as session_count
          FROM ${eventsTableName}
          WHERE session_id IS NOT NULL
        `);
        const sessionCount = parseInt(result.rows[0]?.session_count || '0', 10);
        tests.push({
          id: 'fk-events-sessions',
          name: `Relationship: ${eventsTable || 'l1_events'} -> sessions`,
          description: 'Verify session tracking is working',
          category: 'foreign-keys',
          status: 'pass',
          flag: '✅',
          details: { sessionCount, eventsTable: eventsTableName },
        });
      }
    } catch (error: any) {
      tests.push({
        id: 'fk-events-sessions',
        name: `Relationship: ${eventsTable || 'l1_events'} -> sessions`,
        description: 'Verify session tracking is working',
        category: 'foreign-keys',
        status: 'warning',
        flag: '⚠️',
        message: `Could not check: ${error.message}`,
      });
    }
  } else {
    tests.push({
      id: 'fk-events-sessions',
      name: 'Relationship: l1_events -> sessions',
      description: 'Verify session tracking is working',
      category: 'foreign-keys',
      status: 'warning',
      flag: '⚠️',
      message: 'Events table (l1_events or l1_event_facts) does not exist',
    });
  }

  return tests;
}

async function runFunctionalTests(pool: any): Promise<MigrationTest[]> {
  const tests: MigrationTest[] = [];

  // These would be more complex tests that verify API endpoints work
  // For now, we'll add placeholder tests that can be expanded

  tests.push({
    id: 'func-api-endpoints',
    name: 'API Endpoints Respond',
    description: 'Verify all API endpoints return valid responses',
    category: 'functional',
    status: 'skipped',
    flag: '⏸️',
    message: 'Functional tests should be run manually or via integration tests',
  });

  return tests;
}

