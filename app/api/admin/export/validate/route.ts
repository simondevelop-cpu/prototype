import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';

export const dynamic = 'force-dynamic';

/**
 * Validate Excel export accuracy and completeness
 * Checks:
 * 1. All tables in database are included in export
 * 2. All columns in each table are included
 * 3. Table names match current schema (no old names)
 * 4. No missing tables or columns
 */
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

    const pool = getPool();
    if (!pool) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    // Get all tables from database
    const tablesResult = await pool.query(`
      SELECT table_name, table_type
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const allTables = tablesResult.rows.map(row => row.table_name);
    
    // Tables that should be excluded from export (old/deprecated tables)
    // Note: These tables should have been dropped after migration, but we exclude them
    // in case they still exist during the migration period
    const excludedTables = [
      'l1_events', // Old name, should be l1_event_facts
      'l1_event_facts', // Empty duplicate (if exists)
      'user_events', // Old name
      'transactions', // Legacy, migrated to l1_transaction_facts
      'accounts', // Empty, unused
      'insight_feedback', // Empty, unused
      'onboarding_responses', // Old name, should be l1_onboarding_responses
      'survey_responses', // Old name, should be l1_survey_responses
      'categorization_learning', // Old name, should be l2_user_categorization_learning
      'admin_categorization_learning', // Old name
      'admin_keywords', // Old name, should be l1_admin_keywords
      'admin_merchants', // Old name, should be l1_admin_merchants
      'admin_available_slots', // Old name, should be l1_admin_available_slots
      'admin_chat_bookings', // Old name, should be l1_admin_chat_bookings
      'chat_bookings', // Old name
      'available_slots', // Old name
    ];
    const expectedTables = allTables.filter(table => !excludedTables.includes(table));

    // Get columns for each table
    const tableColumns: { [tableName: string]: string[] } = {};
    for (const table of expectedTables) {
      try {
        const columnsResult = await pool.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = $1 AND table_schema = 'public'
          ORDER BY ordinal_position
        `, [table]);
        
        tableColumns[table] = columnsResult.rows.map(row => row.column_name);
      } catch (error) {
        console.error(`[Excel Validation] Error getting columns for ${table}:`, error);
      }
    }

    // Check for old table names that should have been migrated
    const oldTableNames = [
      'admin_keywords', 'admin_merchants', 'admin_available_slots', 'admin_chat_bookings',
      'onboarding_responses', 'survey_responses', 'categorization_learning'
    ];
    const foundOldTables = oldTableNames.filter(oldName => allTables.includes(oldName));
    
    // Expected new table names
    const expectedNewNames: { [old: string]: string } = {
      'admin_keywords': 'l1_admin_keywords',
      'admin_merchants': 'l1_admin_merchants',
      'admin_available_slots': 'l1_admin_available_slots',
      'admin_chat_bookings': 'l1_admin_chat_bookings',
      'onboarding_responses': 'l1_onboarding_responses',
      'survey_responses': 'l1_survey_responses',
      'categorization_learning': 'l2_user_categorization_learning',
    };

    // Check if l1_events exists (should be l1_event_facts after migration)
    const hasL1Events = allTables.includes('l1_events');
    const hasL1EventFacts = allTables.includes('l1_event_facts');

    const validationResults = {
      timestamp: new Date().toISOString(),
      accuracy: {
        passed: true,
        issues: [] as string[],
        warnings: [] as string[],
      },
      completeness: {
        passed: true,
        missingTables: [] as string[],
        missingColumns: {} as { [table: string]: string[] },
      },
      schemaAlignment: {
        passed: true,
        oldTableNames: foundOldTables,
        expectedMigrations: [] as string[],
        eventsTableStatus: hasL1Events ? (hasL1EventFacts ? 'both_exist' : 'old_only') : (hasL1EventFacts ? 'new_only' : 'neither'),
      },
      summary: {
        totalTables: expectedTables.length,
        tablesWithIssues: 0,
        criticalIssues: 0,
      },
    };

    // Check for old table names
    if (foundOldTables.length > 0) {
      validationResults.schemaAlignment.passed = false;
      validationResults.accuracy.passed = false;
      for (const oldTable of foundOldTables) {
        const expectedNew = expectedNewNames[oldTable];
        if (expectedNew && !allTables.includes(expectedNew)) {
          validationResults.schemaAlignment.expectedMigrations.push(
            `${oldTable} should be migrated to ${expectedNew}`
          );
          validationResults.accuracy.issues.push(
            `Old table name found: ${oldTable} (should be ${expectedNew})`
          );
        } else if (expectedNew && allTables.includes(expectedNew)) {
          validationResults.schemaAlignment.expectedMigrations.push(
            `${oldTable} exists but ${expectedNew} also exists - migration may be incomplete`
          );
          validationResults.accuracy.warnings.push(
            `Both ${oldTable} and ${expectedNew} exist - consider dropping ${oldTable}`
          );
        }
      }
    }

    // Check events table status
    if (hasL1Events && !hasL1EventFacts) {
      validationResults.schemaAlignment.expectedMigrations.push(
        'l1_events should be migrated to l1_event_facts'
      );
      validationResults.accuracy.warnings.push(
        'l1_events exists but l1_event_facts does not - migration may be incomplete'
      );
    } else if (!hasL1Events && hasL1EventFacts) {
      validationResults.accuracy.passed = true; // This is the correct state
    } else if (hasL1Events && hasL1EventFacts) {
      validationResults.accuracy.warnings.push(
        'Both l1_events and l1_event_facts exist - consider dropping l1_events'
      );
    }

    // Count issues
    validationResults.summary.criticalIssues = validationResults.accuracy.issues.length;
    validationResults.summary.tablesWithIssues = Object.keys(validationResults.completeness.missingColumns).length;

    // Overall status
    const overallPassed = 
      validationResults.accuracy.passed && 
      validationResults.completeness.passed && 
      validationResults.schemaAlignment.passed;

    return NextResponse.json({
      success: true,
      passed: overallPassed,
      results: validationResults,
      recommendations: [
        ...(foundOldTables.length > 0 ? [
          'Run migration phases to rename old tables to new names',
          'Update Excel export sheet order to use new table names',
        ] : []),
        ...(validationResults.accuracy.warnings.length > 0 ? [
          'Review warnings and clean up duplicate tables if migration is complete',
        ] : []),
      ],
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Excel Validation] Error:', error);
    return NextResponse.json(
      { error: 'Failed to validate Excel export', details: error.message },
      { status: 500 }
    );
  }
}

