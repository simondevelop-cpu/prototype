/**
 * Export Cohort Analysis and Vanity Metrics Data
 * Includes data details sheets for both metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import * as XLSX from 'xlsx';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';
import { getPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

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

    // Create a new workbook
    const workbook = XLSX.utils.book_new();

    // 1. Detect database type from connection string
    const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';
    let databaseType = 'Unknown';
    if (dbUrl.includes('neon.tech') || dbUrl.includes('neon')) {
      databaseType = 'Neon';
    } else if (dbUrl.includes('vercel') || dbUrl.includes('vercel-storage')) {
      databaseType = 'Vercel Postgres';
    } else if (dbUrl) {
      databaseType = 'PostgreSQL (Unknown Provider)';
    } else {
      databaseType = 'Not Configured';
    }

    // 2. Add Cohort Analysis Data Details sheet
    const cohortDataDetails = [
      { 'KPI / Metric': 'ACTIVATION METRICS', 'Formula / Calculation': '', 'Data Source': '' },
      { 'KPI / Metric': 'Number of users by onboarding step completed - Started onboarding', 'Formula / Calculation': 'COUNT(*) WHERE created_at IS NOT NULL', 'Data Source': 'users table (created_at column)' },
      { 'KPI / Metric': 'Number of users by onboarding step completed - Drop-off at Step 1', 'Formula / Calculation': 'COUNT(*) FILTER WHERE last_step = 1 AND completed_at IS NULL', 'Data Source': 'users table (last_step, completed_at columns)' },
      { 'KPI / Metric': 'Number of users by onboarding step completed - Drop-off at Step 2', 'Formula / Calculation': 'COUNT(*) FILTER WHERE last_step = 2 AND completed_at IS NULL', 'Data Source': 'users table (last_step, completed_at columns)' },
      { 'KPI / Metric': 'Number of users by onboarding step completed - Drop-off at Step 3', 'Formula / Calculation': 'COUNT(*) FILTER WHERE last_step = 3 AND completed_at IS NULL', 'Data Source': 'users table (last_step, completed_at columns)' },
      { 'KPI / Metric': 'Number of users by onboarding step completed - Drop-off at Step 4', 'Formula / Calculation': 'COUNT(*) FILTER WHERE last_step = 4 AND completed_at IS NULL', 'Data Source': 'users table (last_step, completed_at columns)' },
      { 'KPI / Metric': 'Number of users by onboarding step completed - Drop-off at Step 5', 'Formula / Calculation': 'COUNT(*) FILTER WHERE last_step = 5 AND completed_at IS NULL', 'Data Source': 'users table (last_step, completed_at columns)' },
      { 'KPI / Metric': 'Number of users by onboarding step completed - Drop-off at Step 6', 'Formula / Calculation': 'COUNT(*) FILTER WHERE last_step = 6 AND completed_at IS NULL', 'Data Source': 'users table (last_step, completed_at columns)' },
      { 'KPI / Metric': 'Number of users by onboarding step completed - Drop-off at Step 7', 'Formula / Calculation': 'COUNT(*) FILTER WHERE last_step = 7 AND completed_at IS NULL', 'Data Source': 'users table (last_step, completed_at columns)' },
      { 'KPI / Metric': 'Number of users by onboarding step completed - Completed onboarding', 'Formula / Calculation': 'COUNT(*) FILTER WHERE completed_at IS NOT NULL', 'Data Source': 'users table (completed_at column)' },
      { 'KPI / Metric': 'Started but not completed (no drop-off recorded)', 'Formula / Calculation': 'MAX(0, starting - completed - sum of all drop-offs)', 'Data Source': 'users table (calculated from created_at, completed_at, last_step)' },
      { 'KPI / Metric': 'Average time to onboard (minutes)', 'Formula / Calculation': 'AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 60) FILTER WHERE completed_at IS NOT NULL', 'Data Source': 'users table (created_at, completed_at columns)' },
      { 'KPI / Metric': 'ENGAGEMENT METRICS - ONBOARDING AND DATA COVERAGE', 'Formula / Calculation': '', 'Data Source': '' },
      { 'KPI / Metric': 'Onboarding completed', 'Formula / Calculation': 'COUNT(DISTINCT user_id) FILTER WHERE completed_at IS NOT NULL', 'Data Source': 'users table (completed_at column)' },
      { 'KPI / Metric': 'Uploaded first statement', 'Formula / Calculation': 'COUNT(DISTINCT user_id) FILTER WHERE transaction EXISTS', 'Data Source': 'l1_transaction_facts table (JOIN with l0_user_tokenization)' },
      { 'KPI / Metric': 'Uploaded two statements', 'Formula / Calculation': 'COUNT(DISTINCT user_id) FILTER WHERE COUNT(DISTINCT upload_session_id) >= 2', 'Data Source': 'l1_transaction_facts table (upload_session_id column)' },
      { 'KPI / Metric': 'Uploaded three or more statements', 'Formula / Calculation': 'COUNT(DISTINCT tokenized_user_id) FILTER WHERE COUNT(DISTINCT upload_session_id) >= 3', 'Data Source': 'l1_transaction_facts table (upload_session_id column)' },
      { 'KPI / Metric': 'ENGAGEMENT METRICS - TIME TO ACHIEVE', 'Formula / Calculation': '', 'Data Source': '' },
      { 'KPI / Metric': 'Number of users who uploaded on the first day', 'Formula / Calculation': 'COUNT(DISTINCT tokenized_user_id) FILTER WHERE DATE(first_transaction_date) = DATE(created_at)', 'Data Source': 'l1_transaction_facts table (MIN(transaction_date) per tokenized_user_id) JOIN l0_user_tokenization JOIN users table (created_at)' },
      { 'KPI / Metric': 'Average time to first upload, who uploaded on their first day (minutes)', 'Formula / Calculation': 'AVG(EXTRACT(EPOCH FROM (first_transaction_date - created_at)) / 60) FILTER WHERE DATE(first_transaction_date) = DATE(created_at)', 'Data Source': 'l1_transaction_facts table (MIN(transaction_date) per tokenized_user_id) JOIN l0_user_tokenization JOIN users table (created_at)' },
      { 'KPI / Metric': 'Number of users who uploaded after the first day', 'Formula / Calculation': 'COUNT(DISTINCT tokenized_user_id) FILTER WHERE DATE(first_transaction_date) > DATE(created_at)', 'Data Source': 'l1_transaction_facts table (MIN(transaction_date) per tokenized_user_id) JOIN l0_user_tokenization JOIN users table (created_at)' },
      { 'KPI / Metric': 'Average time to first upload, who uploaded after the first day (days)', 'Formula / Calculation': 'AVG(EXTRACT(EPOCH FROM (first_transaction_date - created_at)) / 86400) FILTER WHERE DATE(first_transaction_date) > DATE(created_at)', 'Data Source': 'l1_transaction_facts table (MIN(transaction_date) per tokenized_user_id) JOIN l0_user_tokenization JOIN users table (created_at)' },
      { 'KPI / Metric': 'ENGAGEMENT METRICS - ENGAGEMENT SIGNALS', 'Formula / Calculation': '', 'Data Source': '' },
      { 'KPI / Metric': 'Average transactions per user', 'Formula / Calculation': 'AVG(COUNT(*) per user) FILTER WHERE transaction_count > 0', 'Data Source': 'l1_transaction_facts table (COUNT(*) grouped by tokenized_user_id)' },
      { 'KPI / Metric': 'Users with transactions', 'Formula / Calculation': 'COUNT(DISTINCT tokenized_user_id) FILTER WHERE transaction_count > 0', 'Data Source': 'l1_transaction_facts table (COUNT(*) grouped by tokenized_user_id)' },
      { 'KPI / Metric': 'BANK STATEMENT SOURCE TRACKING', 'Formula / Calculation': '', 'Data Source': '' },
      { 'KPI / Metric': 'Bank Statement Source - Bank', 'Formula / Calculation': "metadata->'bank' FROM l1_events WHERE event_type IN ('statement_upload', 'statement_linked')", 'Data Source': 'l1_events table (metadata JSONB column, event_type = statement_upload or statement_linked)' },
      { 'KPI / Metric': 'Bank Statement Source - Account Type', 'Formula / Calculation': "metadata->'accountType' FROM l1_events WHERE event_type IN ('statement_upload', 'statement_linked')", 'Data Source': 'l1_events table (metadata JSONB column, event_type = statement_upload or statement_linked)' },
      { 'KPI / Metric': 'Bank Statement Source - Uploaded or Linked', 'Formula / Calculation': "metadata->'source' FROM l1_events WHERE event_type IN ('statement_upload', 'statement_linked')", 'Data Source': 'l1_events table (metadata JSONB column, event_type = statement_upload or statement_linked, source = uploaded or linked)' },
      { 'KPI / Metric': 'FILTERS', 'Formula / Calculation': '', 'Data Source': '' },
      { 'KPI / Metric': 'Account Type - Total Accounts', 'Formula / Calculation': 'No filter applied (includes all accounts)', 'Data Source': 'users table (all records)' },
      { 'KPI / Metric': 'Account Type - Validated Emails', 'Formula / Calculation': 'FILTER WHERE email_validated = true', 'Data Source': 'users table (email_validated column)' },
      { 'KPI / Metric': 'Intent Categories', 'Formula / Calculation': 'FILTER WHERE motivation = ANY(selected_categories)', 'Data Source': 'users table (motivation column)' },
      { 'KPI / Metric': 'Cohorts (Signup Weeks)', 'Formula / Calculation': "FILTER WHERE DATE_TRUNC('week', created_at) = selected_week", 'Data Source': 'users table (created_at column, grouped by week)' },
      { 'KPI / Metric': 'Data Coverage', 'Formula / Calculation': 'FILTER users based on transaction upload counts (1 upload, 2 uploads, 3+ uploads)', 'Data Source': 'l1_transaction_facts table (upload_session_id column, COUNT DISTINCT per tokenized_user_id)' },
    ];
    const cohortWorksheet = XLSX.utils.json_to_sheet(cohortDataDetails);
    cohortWorksheet['!cols'] = [
      { wch: 60 }, // KPI / Metric
      { wch: 80 }, // Formula / Calculation
      { wch: 80 }, // Data Source
    ];
    XLSX.utils.book_append_sheet(workbook, cohortWorksheet, 'Cohort Analysis - Data Details');

    // 3. Add Vanity Metrics Data Details sheet
    const vanityDataDetails = [
      { 'KPI / Metric': 'Total users (cumulative)', 'Formula / Calculation': 'COUNT(*) WHERE created_at <= weekEnd', 'Data Source': 'users table (created_at column, cumulative count up to end of week)' },
      { 'KPI / Metric': 'Weekly active users', 'Formula / Calculation': "COUNT(DISTINCT user_id) WHERE event_type = 'login' AND event_timestamp BETWEEN weekStart AND weekEnd", 'Data Source': 'l1_events table (event_type, event_timestamp columns) JOIN l0_user_tokenization' },
      { 'KPI / Metric': 'New users', 'Formula / Calculation': 'COUNT(*) WHERE created_at BETWEEN weekStart AND weekEnd', 'Data Source': 'users table (created_at column, filtered by week)' },
      { 'KPI / Metric': 'Transactions', 'Formula / Calculation': 'COUNT(*) WHERE transaction_date BETWEEN weekStart AND weekEnd', 'Data Source': 'l1_transaction_facts table (transaction_date column, filtered by week)' },
      { 'KPI / Metric': 'Unique banks', 'Formula / Calculation': "COUNT(DISTINCT metadata->'bank') WHERE event_type IN ('statement_upload', 'statement_linked') AND event_timestamp BETWEEN weekStart AND weekEnd", 'Data Source': 'l1_events table (metadata JSONB column, event_type, event_timestamp columns)' },
    ];
    const vanityWorksheet = XLSX.utils.json_to_sheet(vanityDataDetails);
    vanityWorksheet['!cols'] = [
      { wch: 40 }, // KPI / Metric
      { wch: 80 }, // Formula / Calculation
      { wch: 80 }, // Data Source
    ];
    XLSX.utils.book_append_sheet(workbook, vanityWorksheet, 'Vanity Metrics - Data Details');

    // 4. Fetch and add Cohort Analysis data
    try {
      const cohortResponse = await fetch(`${request.nextUrl.origin}/api/admin/cohort-analysis`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (cohortResponse.ok) {
        const cohortData = await cohortResponse.json();
        const cohortDataSheet = XLSX.utils.json_to_sheet(cohortData.cohorts || []);
        XLSX.utils.book_append_sheet(workbook, cohortDataSheet, 'Cohort Analysis Data');
      }
    } catch (error) {
      console.error('[Export] Error fetching cohort analysis data:', error);
    }

    // 5. Fetch and add Vanity Metrics data
    try {
      const vanityResponse = await fetch(`${request.nextUrl.origin}/api/admin/vanity-metrics`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (vanityResponse.ok) {
        const vanityData = await vanityResponse.json();
        const vanityDataSheet = XLSX.utils.json_to_sheet(vanityData.metrics || []);
        XLSX.utils.book_append_sheet(workbook, vanityDataSheet, 'Vanity Metrics Data');
      }
    } catch (error) {
      console.error('[Export] Error fetching vanity metrics data:', error);
    }

    // Generate Excel file buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Return as downloadable file
    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="cohort-vanity-metrics-${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error('[Export] Error exporting cohort and vanity metrics:', error);
    return NextResponse.json(
      { error: 'Failed to export data', details: error.message },
      { status: 500 }
    );
  }
}

