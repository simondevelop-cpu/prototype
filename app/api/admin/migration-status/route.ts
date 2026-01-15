/**
 * Migration Status Diagnostic API
 * Checks where onboarding data actually exists and migration status
 * No authentication required for diagnostic purposes (or we can add it)
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export async function GET(request: NextRequest) {
  try {
    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      tables: {},
      migration: {},
      dataLocation: {},
      recommendations: []
    };

    // Check if users table has onboarding columns
    const usersSchemaCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('completed_at', 'motivation', 'emotional_state', 'financial_context', 'last_step', 'is_active', 'email_validated')
    `);
    
    const usersColumns = usersSchemaCheck.rows.map(row => row.column_name);
    diagnostics.tables.users = {
      exists: true,
      hasOnboardingColumns: usersColumns.length > 0,
      columns: usersColumns
    };

    // Check if onboarding_responses table exists
    const onboardingTableCheck = await pool.query(`
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'onboarding_responses'
      LIMIT 1
    `);
    
    diagnostics.tables.onboarding_responses = {
      exists: onboardingTableCheck.rows.length > 0
    };

    // Count data in users table
    if (usersColumns.length > 0) {
      const usersDataCheck = await pool.query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) as users_with_completed_at,
          COUNT(CASE WHEN motivation IS NOT NULL THEN 1 END) as users_with_motivation,
          COUNT(CASE WHEN emotional_state IS NOT NULL THEN 1 END) as users_with_emotional_state,
          COUNT(CASE WHEN financial_context IS NOT NULL THEN 1 END) as users_with_financial_context,
          COUNT(CASE WHEN completed_at IS NOT NULL OR motivation IS NOT NULL OR emotional_state IS NOT NULL THEN 1 END) as users_with_any_onboarding_data
        FROM users
        WHERE email != 'admin@canadianinsights.ca'
      `);
      
      diagnostics.dataLocation.users = usersDataCheck.rows[0];
      
      // Get sample user creation dates to check vanity metrics issue
      const sampleDates = await pool.query(`
        SELECT 
          id,
          email,
          created_at,
          completed_at,
          motivation
        FROM users
        WHERE email != 'admin@canadianinsights.ca'
        ORDER BY created_at
        LIMIT 20
      `);
      
      diagnostics.dataLocation.userSampleDates = sampleDates.rows.map((row: any) => ({
        id: row.id,
        email: row.email?.substring(0, 20) + '...',
        created_at: row.created_at,
        completed_at: row.completed_at,
        motivation: row.motivation
      }));
    }

    // Count data in onboarding_responses table
    if (diagnostics.tables.onboarding_responses.exists) {
      const onboardingDataCheck = await pool.query(`
        SELECT 
          COUNT(*) as total_records,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) as records_with_completed_at,
          COUNT(CASE WHEN motivation IS NOT NULL THEN 1 END) as records_with_motivation
        FROM onboarding_responses
      `);
      
      diagnostics.dataLocation.onboarding_responses = onboardingDataCheck.rows[0];
      
      // Check if there are users with onboarding_responses but no data in users table
      if (usersColumns.length > 0) {
        const unmigratedCheck = await pool.query(`
          SELECT COUNT(DISTINCT o.user_id) as count
          FROM onboarding_responses o
          LEFT JOIN users u ON u.id = o.user_id
          WHERE u.motivation IS NULL 
            AND o.motivation IS NOT NULL
        `);
        diagnostics.migration.unmigratedUsers = parseInt(unmigratedCheck.rows[0]?.count || '0', 10);
      }
    }

    // Determine migration status
    const hasUsersColumns = usersColumns.length > 0;
    const usersHasData = diagnostics.dataLocation.users?.users_with_any_onboarding_data > 0;
    const onboardingHasData = diagnostics.dataLocation.onboarding_responses?.total_records > 0;
    
    diagnostics.migration = {
      columnsExist: hasUsersColumns,
      usersTableHasData: usersHasData,
      onboardingResponsesHasData: onboardingHasData,
      migrationNeeded: hasUsersColumns && !usersHasData && onboardingHasData,
      migrationComplete: hasUsersColumns && usersHasData,
      dataInBothTables: usersHasData && onboardingHasData
    };

    // Generate recommendations
    if (!hasUsersColumns) {
      diagnostics.recommendations.push('Run migration to add onboarding columns to users table');
    } else if (hasUsersColumns && !usersHasData && onboardingHasData) {
      diagnostics.recommendations.push('Migration columns exist but data not migrated. Run migration to copy data from onboarding_responses to users table.');
    } else if (hasUsersColumns && usersHasData && onboardingHasData) {
      diagnostics.recommendations.push('Data exists in both tables. Migration appears complete. Consider deleting onboarding_responses table.');
    } else if (hasUsersColumns && usersHasData && !onboardingHasData) {
      diagnostics.recommendations.push('Migration complete. Safe to delete onboarding_responses table.');
    }

    return NextResponse.json({
      success: true,
      diagnostics
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Migration Status] Error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to check migration status', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}
