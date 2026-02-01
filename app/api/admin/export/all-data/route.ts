import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import * as XLSX from 'xlsx';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';

export const dynamic = 'force-dynamic';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
});

/**
 * API endpoint documentation structure
 */
interface APIEndpoint {
  endpoint: string;
  method: string;
  area: string;
  access: 'read' | 'write' | 'both';
  description: string;
  formula?: string;
  variables?: string;
  authentication: 'user' | 'admin' | 'public';
  database?: string; // 'Neon', 'Vercel Postgres', or 'Both/Unknown'
}

/**
 * Get API endpoints list (shared with api-docs route)
 */
function getAPIEndpoints(): APIEndpoint[] {
  // Import the function from api-docs route by reading it
  // For now, we'll duplicate the list to avoid circular dependencies
  return [
    // Authentication
    { endpoint: '/api/auth/login', method: 'POST', area: 'Authentication', access: 'write', description: 'User login', authentication: 'public', variables: 'email, password' },
    { endpoint: '/api/auth/register', method: 'POST', area: 'Authentication', access: 'write', description: 'User registration', authentication: 'public', variables: 'email, password, name, consentAccepted' },
    { endpoint: '/api/auth/refresh', method: 'POST', area: 'Authentication', access: 'write', description: 'Refresh user token', authentication: 'user', variables: 'token' },
    // User Account
    { endpoint: '/api/account/personal-data', method: 'GET', area: 'User Account', access: 'read', description: 'Get user personal data', authentication: 'user' },
    { endpoint: '/api/account/update', method: 'POST', area: 'User Account', access: 'write', description: 'Update user personal details', authentication: 'user', variables: 'displayName, email, dateOfBirth, province, recoveryPhone' },
    { endpoint: '/api/account/export', method: 'GET', area: 'User Account', access: 'read', description: 'Export user data (PIPEDA)', authentication: 'user' },
    { endpoint: '/api/account', method: 'DELETE', area: 'User Account', access: 'write', description: 'Delete user account', authentication: 'user' },
    // Transactions
    { endpoint: '/api/transactions', method: 'GET', area: 'User Transactions', access: 'read', description: 'Get user transactions', authentication: 'user', variables: 'start, end, months', formula: 'SELECT from l1_transaction_facts WHERE tokenized_user_id' },
    { endpoint: '/api/transactions/create', method: 'POST', area: 'User Transactions', access: 'write', description: 'Create new transaction', authentication: 'user', variables: 'date, description, amount, cashflow, account, category, label' },
    { endpoint: '/api/transactions/update', method: 'PUT', area: 'User Transactions', access: 'write', description: 'Update transaction', authentication: 'user', variables: 'id, date, description, amount, cashflow, account, category, label', formula: 'UPDATE l1_transaction_facts' },
    { endpoint: '/api/transactions/delete', method: 'DELETE', area: 'User Transactions', access: 'write', description: 'Delete transaction', authentication: 'user', variables: 'id' },
    { endpoint: '/api/transactions/bulk-update', method: 'POST', area: 'User Transactions', access: 'write', description: 'Bulk update transactions', authentication: 'user', variables: 'ids[], updates{}', formula: 'UPDATE l1_transaction_facts WHERE id IN' },
    // Summary & Categories
    { endpoint: '/api/summary', method: 'GET', area: 'Summary', access: 'read', description: 'Get financial summary', authentication: 'user', variables: 'start, end, months', formula: 'SELECT from l1_transaction_facts GROUP BY month' },
    { endpoint: '/api/categories', method: 'GET', area: 'Categories', access: 'read', description: 'Get transaction categories', authentication: 'user', variables: 'month, start, end, months, cashflow', formula: 'SELECT from l1_transaction_facts GROUP BY category' },
    // Onboarding
    { endpoint: '/api/onboarding', method: 'POST', area: 'Onboarding', access: 'write', description: 'Submit onboarding response', authentication: 'user', variables: 'step, data' },
    { endpoint: '/api/onboarding', method: 'GET', area: 'Onboarding', access: 'read', description: 'Get onboarding data', authentication: 'user' },
    { endpoint: '/api/onboarding/status', method: 'GET', area: 'Onboarding', access: 'read', description: 'Check onboarding completion status', authentication: 'user' },
    { endpoint: '/api/onboarding/progress', method: 'GET', area: 'Onboarding', access: 'read', description: 'Get onboarding progress', authentication: 'user' },
    // Consent
    { endpoint: '/api/consent', method: 'POST', area: 'Consent', access: 'write', description: 'Log consent event', authentication: 'user', variables: 'consentType, metadata', formula: 'INSERT INTO l1_events' },
    { endpoint: '/api/consent/check', method: 'GET', area: 'Consent', access: 'read', description: 'Check if consent was given', authentication: 'user', variables: 'type', formula: 'SELECT from l1_events WHERE event_type' },
    // Statement Upload
    { endpoint: '/api/statements/upload', method: 'POST', area: 'Statement Upload', access: 'write', description: 'Upload PDF statement', authentication: 'user', variables: 'file' },
    { endpoint: '/api/statements/parse', method: 'POST', area: 'Statement Upload', access: 'write', description: 'Parse uploaded statement', authentication: 'user', variables: 'file', formula: 'PDF parsing, INSERT INTO l1_transaction_facts' },
    { endpoint: '/api/statements/import', method: 'POST', area: 'Statement Upload', access: 'write', description: 'Import parsed transactions', authentication: 'user', variables: 'transactions[]', formula: 'INSERT INTO l1_transaction_facts' },
    // Categorization
    { endpoint: '/api/categorization/learn', method: 'POST', area: 'Categorization', access: 'write', description: 'Learn from user correction', authentication: 'user', variables: 'description, category, label', formula: 'INSERT INTO categorization_learning' },
    { endpoint: '/api/categorization/batch-learn', method: 'POST', area: 'Categorization', access: 'write', description: 'Batch learn from corrections', authentication: 'user', variables: 'corrections[]' },
    { endpoint: '/api/categorization/patterns', method: 'GET', area: 'Categorization', access: 'read', description: 'Get categorization patterns', authentication: 'user', formula: 'SELECT from admin_keywords, admin_merchants' },
    // Bookings
    { endpoint: '/api/bookings/available', method: 'GET', area: 'Chat Bookings', access: 'read', description: 'Get available booking slots', authentication: 'user', formula: 'SELECT from available_slots, chat_bookings' },
    { endpoint: '/api/bookings/create', method: 'POST', area: 'Chat Bookings', access: 'write', description: 'Create booking request', authentication: 'user', variables: 'bookingDate, bookingTime, preferredMethod, shareScreen, recordConversation, notes', formula: 'INSERT INTO chat_bookings' },
    { endpoint: '/api/bookings/my-bookings', method: 'GET', area: 'Chat Bookings', access: 'read', description: 'Get user bookings', authentication: 'user', formula: 'SELECT from chat_bookings WHERE user_id' },
    { endpoint: '/api/bookings/update', method: 'PUT', area: 'Chat Bookings', access: 'write', description: 'Update booking', authentication: 'user', variables: 'id, notes, status', formula: 'UPDATE chat_bookings' },
    // Survey
    { endpoint: '/api/survey/submit', method: 'POST', area: 'Survey', access: 'write', description: 'Submit survey response', authentication: 'user', variables: 'q1, q2, q3, q4, q5', formula: 'INSERT INTO survey_responses' },
    // Feedback
    { endpoint: '/api/feedback', method: 'POST', area: 'Feedback', access: 'write', description: 'Submit feedback', authentication: 'user', variables: 'usefulness, trust, problems, learnMore', formula: 'INSERT INTO user_feedback' },
    // User Activity
    { endpoint: '/api/user/edit-counts', method: 'GET', area: 'User Activity', access: 'read', description: 'Get user edit activity counts', authentication: 'user', formula: 'SELECT COUNT from l1_events WHERE event_type' },
    // Admin Endpoints
    { endpoint: '/api/admin/auth', method: 'POST', area: 'Admin', access: 'write', description: 'Admin login', authentication: 'public', variables: 'email, password' },
    { endpoint: '/api/admin/auth', method: 'GET', area: 'Admin', access: 'read', description: 'Verify admin token', authentication: 'admin' },
    { endpoint: '/api/admin/users', method: 'GET', area: 'Admin', access: 'read', description: 'Get all users with consent info', authentication: 'admin', formula: 'SELECT from users, l1_events' },
    { endpoint: '/api/admin/users/block', method: 'POST', area: 'Admin', access: 'write', description: 'Block/unblock user', authentication: 'admin', variables: 'userId, isActive', formula: 'UPDATE users SET is_active' },
    { endpoint: '/api/admin/customer-data', method: 'GET', area: 'Admin', access: 'read', description: 'Get customer onboarding data', authentication: 'admin', formula: 'SELECT from users, l0_pii_users, onboarding_responses' },
    { endpoint: '/api/admin/events-data', method: 'GET', area: 'Admin', access: 'read', description: 'Get all user events', authentication: 'admin', formula: 'SELECT from l1_events' },
    { endpoint: '/api/admin/editing-events', method: 'GET', area: 'Admin', access: 'read', description: 'Get transaction editing events', authentication: 'admin', formula: 'SELECT from l1_events WHERE event_type = transaction_edit' },
    { endpoint: '/api/admin/recategorizations', method: 'GET', area: 'Admin', access: 'read', description: 'Get recategorization log', authentication: 'admin', formula: 'SELECT from categorization_learning' },
    { endpoint: '/api/admin/cohort-analysis', method: 'GET', area: 'Admin', access: 'read', description: 'Get cohort analysis data', authentication: 'admin', variables: 'totalAccounts, validatedEmails, cohorts, intentCategories, dataCoverage', formula: 'Complex aggregations from users (non-PII only), l1_transaction_facts (tokenized_user_id), l1_events (tokenized_user_id). NO PII access.' },
    { endpoint: '/api/admin/vanity-metrics', method: 'GET', area: 'Admin', access: 'read', description: 'Get vanity metrics', authentication: 'admin', variables: 'totalAccounts, validatedEmails, intentCategories, cohorts, dataCoverage', formula: 'Aggregations from users (non-PII only), l1_transaction_facts (tokenized_user_id). NO PII access.' },
    { endpoint: '/api/admin/engagement-chart', method: 'GET', area: 'Admin', access: 'read', description: 'Get engagement chart data', authentication: 'admin', variables: 'totalAccounts, validatedEmails, cohorts, intentCategories, dataCoverage, userIds', formula: 'Time-series aggregations from l1_events (tokenized_user_id), users (non-PII only). NO PII access.' },
    { endpoint: '/api/admin/health', method: 'GET', area: 'Admin', access: 'read', description: 'App health checks', authentication: 'admin', formula: 'Various database and compliance checks' },
    { endpoint: '/api/admin/privacy-policy-check', method: 'GET', area: 'Admin', access: 'read', description: 'Privacy policy compliance checks', authentication: 'admin', formula: 'Dynamic tests against privacy commitments' },
    { endpoint: '/api/admin/bookings', method: 'GET', area: 'Admin', access: 'read', description: 'Get all chat bookings', authentication: 'admin', formula: 'SELECT from chat_bookings JOIN users' },
    { endpoint: '/api/admin/bookings/update-status', method: 'POST', area: 'Admin', access: 'write', description: 'Update booking status', authentication: 'admin', variables: 'id, status', formula: 'UPDATE chat_bookings SET status' },
    { endpoint: '/api/admin/available-slots', method: 'GET', area: 'Admin', access: 'read', description: 'Get available booking slots', authentication: 'admin', formula: 'SELECT from available_slots' },
    { endpoint: '/api/admin/available-slots', method: 'POST', area: 'Admin', access: 'write', description: 'Set available booking slots', authentication: 'admin', variables: 'slotDate, slotTime, isAvailable', formula: 'INSERT/UPDATE available_slots' },
    { endpoint: '/api/admin/survey-responses', method: 'GET', area: 'Admin', access: 'read', description: 'Get all survey responses', authentication: 'admin', formula: 'SELECT from survey_responses JOIN users' },
    { endpoint: '/api/admin/user-feedback', method: 'GET', area: 'Admin', access: 'read', description: 'Get user feedback', authentication: 'admin', formula: 'SELECT from user_feedback' },
    { endpoint: '/api/admin/logins', method: 'GET', area: 'Admin', access: 'read', description: 'Get admin login events', authentication: 'admin', formula: 'SELECT from l1_events WHERE event_type IN (admin_login, admin_tab_access) AND is_admin = true' },
    { endpoint: '/api/admin/log-action', method: 'POST', area: 'Admin', access: 'write', description: 'Log admin action', authentication: 'admin', variables: 'actionType, tab', formula: 'INSERT INTO l1_events' },
    { endpoint: '/api/admin/keywords', method: 'GET', area: 'Admin', access: 'read', description: 'Get categorization keywords', authentication: 'admin', formula: 'SELECT from admin_keywords' },
    { endpoint: '/api/admin/keywords', method: 'POST', area: 'Admin', access: 'write', description: 'Create keyword', authentication: 'admin', variables: 'keyword, category, label, isActive, notes', formula: 'INSERT INTO admin_keywords' },
    { endpoint: '/api/admin/keywords/[id]', method: 'PUT', area: 'Admin', access: 'write', description: 'Update keyword', authentication: 'admin', variables: 'id, keyword, category, label, isActive, notes', formula: 'UPDATE admin_keywords' },
    { endpoint: '/api/admin/keywords/[id]', method: 'DELETE', area: 'Admin', access: 'write', description: 'Delete keyword', authentication: 'admin', variables: 'id', formula: 'DELETE FROM admin_keywords' },
    { endpoint: '/api/admin/merchants', method: 'GET', area: 'Admin', access: 'read', description: 'Get merchant patterns', authentication: 'admin', formula: 'SELECT from admin_merchants' },
    { endpoint: '/api/admin/merchants', method: 'POST', area: 'Admin', access: 'write', description: 'Create merchant pattern', authentication: 'admin', variables: 'merchantPattern, alternatePatterns, category, label, isActive, notes', formula: 'INSERT INTO admin_merchants' },
    { endpoint: '/api/admin/merchants/[id]', method: 'PUT', area: 'Admin', access: 'write', description: 'Update merchant pattern', authentication: 'admin', variables: 'id, merchantPattern, alternatePatterns, category, label, isActive, notes', formula: 'UPDATE admin_merchants' },
    { endpoint: '/api/admin/merchants/[id]', method: 'DELETE', area: 'Admin', access: 'write', description: 'Delete merchant pattern', authentication: 'admin', variables: 'id', formula: 'DELETE FROM admin_merchants' },
    { endpoint: '/api/admin/intent-categories', method: 'GET', area: 'Admin', access: 'read', description: 'Get intent categories', authentication: 'admin' },
    { endpoint: '/api/admin/view-keywords', method: 'GET', area: 'Admin', access: 'read', description: 'View keywords for categorization', authentication: 'admin', formula: 'SELECT from admin_keywords' },
    { endpoint: '/api/admin/init-db', method: 'POST', area: 'Admin', access: 'write', description: 'Initialize database tables', authentication: 'admin', formula: 'CREATE TABLE IF NOT EXISTS' },
    { endpoint: '/api/admin/cleanup-deleted-users', method: 'GET', area: 'Admin', access: 'read', description: 'Cleanup deleted users (30+ days)', authentication: 'admin', formula: 'DELETE FROM WHERE deleted_at < NOW() - INTERVAL 30 days' },
  ];
}

/**
 * Get table descriptions for table of contents
 */
function getTableDescription(tableName: string): string {
  const descriptions: { [key: string]: string } = {
    'users': 'Core user accounts table. Contains user authentication and basic profile information. Email stored here for auth (also in l0_pii_users).',
    'l0_pii_users': 'Personally Identifiable Information (PII) table. Stores sensitive user data separated for security compliance. PRIMARY KEY: internal_user_id.',
    'l1_transaction_facts': 'Transaction facts table. Contains all financial transactions with normalized data. Uses tokenized_user_id for PII isolation. See Foreign Keys sheet for relationships.',
    'l2_aggregated_insights': 'Aggregated insights table. Pre-computed financial summaries and analytics.',
    'onboarding_responses': 'User onboarding responses. Stores answers from the onboarding flow (non-PII only - PII migrated to l0_pii_users).',
    'l1_events': 'Event facts table. Tracks all user and admin actions, consent events, and system events. Replaces user_events. Uses user_id for operational events. See Foreign Keys sheet for relationships.',
    'l1_customer_facts': 'Customer facts table. Contains anonymized customer attributes and analytics classifications (user_segment). Uses tokenized_user_id. See Foreign Keys sheet for relationships.',
    'l0_user_tokenization': 'User tokenization mapping. Maps internal_user_id to tokenized_user_id for analytics (PII isolation). See Foreign Keys sheet for relationships.',
    'l2_customer_summary_view': 'Customer summary view. Aggregated metrics per user using l1_transaction_facts.',
    'categorization_learning': 'Categorization learning patterns. Stores user corrections for automatic categorization. See Foreign Keys sheet for relationships.',
    'admin_keywords': 'Admin-defined keyword patterns for transaction categorization.',
    'admin_merchants': 'Admin-defined merchant patterns for transaction categorization.',
    'chat_bookings': 'Chat booking requests. Stores user requests for 20-minute chat sessions. Notes field may contain unstructured PII. See Foreign Keys sheet for relationships.',
    'available_slots': 'Available chat slots. Admin-marked time slots available for booking.',
    'survey_responses': 'Survey responses. User responses to the "What\'s coming" feature prioritization survey. Free text fields may contain unstructured PII. See Foreign Keys sheet for relationships.',
    'user_feedback': 'User feedback submissions. Stores user feedback and suggestions. Free text fields may contain unstructured PII.',
    'l1_support_tickets': 'Support tickets table. Reserved for future use. See Foreign Keys sheet for relationships.',
    'l0_category_list': 'Category configuration table. Admin-defined transaction categories. See Foreign Keys sheet for relationships.',
    'l0_insight_list': 'Insight configuration table. Admin-defined financial insights.',
    'l0_admin_list': 'Admin user list. Configuration table for admin users.',
    'l0_privacy_metadata': 'Privacy metadata table. Privacy compliance tracking and configuration.',
  };
  
  return descriptions[tableName] || `Database table: ${tableName}. Contains raw data from the application.`;
}

/**
 * Check if a table contains PII columns (besides user_id)
 */
async function checkTableForPII(pool: any, tableName: string): Promise<boolean> {
  try {
    // l0_pii_users is explicitly the PII table
    if (tableName === 'l0_pii_users') {
      return true;
    }
    
    const columnsResult = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = $1 AND table_schema = 'public'
    `, [tableName]);
    
    const piiKeywords = ['email', 'first_name', 'last_name', 'date_of_birth', 'recovery_phone', 'province_region', 'phone', 'address'];
    
    for (const col of columnsResult.rows) {
      const colName = col.column_name.toLowerCase();
      
      // Check for explicit PII fields (excluding user_id, internal_user_id, tokenized_user_id)
      if (colName === 'user_id' || colName === 'internal_user_id' || colName === 'tokenized_user_id') {
        continue; // Skip user ID fields
      }
      
      if (piiKeywords.some(keyword => colName.includes(keyword))) {
        return true;
      }
      
      // Check for free text fields that could contain PII in specific tables
      // These are user-provided text that might contain personal information
      if (['notes', 'comments', 'feedback', 'message', 'text', 'other'].some(keyword => colName.includes(keyword))) {
        // Tables where free text could contain PII
        if (['chat_bookings', 'survey_responses', 'user_feedback', 'onboarding_responses'].includes(tableName)) {
          return true;
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error(`[Export] Error checking PII for table ${tableName}:`, error);
    return false;
  }
}

/**
 * Check if a table is empty
 */
async function isTableEmpty(pool: any, tableName: string): Promise<boolean> {
  try {
    const countResult = await pool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
    return parseInt(countResult.rows[0].count) === 0;
  } catch (error) {
    console.error(`[Export] Error checking if table ${tableName} is empty:`, error);
    return false;
  }
}

/**
 * Get all foreign key relationships in the database
 */
async function getForeignKeyRelationships(pool: any): Promise<Array<{
  from_table: string;
  from_column: string;
  to_table: string;
  to_column: string;
  constraint_name: string;
  on_delete: string;
}>> {
  try {
    const result = await pool.query(`
      SELECT
        tc.table_name AS from_table,
        kcu.column_name AS from_column,
        ccu.table_name AS to_table,
        ccu.column_name AS to_column,
        tc.constraint_name,
        rc.delete_rule AS on_delete
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      LEFT JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
        AND rc.constraint_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name
    `);
    return result.rows;
  } catch (error) {
    console.error('[Export] Error getting foreign key relationships:', error);
    return [];
  }
}

/**
 * Export all database tables as Excel workbook (one sheet per table)
 * Includes API documentation and table of contents as first sheets
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

    // 2. Get list of all tables and views first (needed for ordering)
    const tablesResult = await pool.query(`
      SELECT table_name, table_type
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type IN ('BASE TABLE', 'VIEW')
      ORDER BY table_type, table_name
    `);

    const allTables = tablesResult.rows.filter(row => row.table_type === 'BASE TABLE').map(row => row.table_name);
    const allViews = tablesResult.rows.filter(row => row.table_type === 'VIEW').map(row => row.table_name);

    // Define sheet order based on categories
    const sheetOrder = [
      // Documentation sheets first
      'Table of Contents',
      'API Documentation',
      'Foreign Keys',
      // Raw user data
      'l0_pii_users',
      'l0_user_tokenization',
      'users',
      'l1_customer_facts',
      'onboarding_responses',
      'survey_responses',
      // Transaction and events
      'l1_transaction_facts',
      'l1_events',
      // Admin tooling
      'admin_keywords',
      'admin_merchants',
      'available_slots',
      'categorization_learning',
      'chat_bookings',
      // TBC
      'l0_category_list',
      'l0_insight_list',
      'l1_support_tickets',
      'l2_customer_summary_view',
      'l2_transactions_view',
    ];

    // 3. Add API Documentation sheet
    const endpoints = getAPIEndpoints();
    const apiData = endpoints.map(ep => ({
      'Endpoint': ep.endpoint,
      'Method': ep.method,
      'Area': ep.area,
      'Access': ep.access,
      'Description': ep.description,
      'Formula/Variables': ep.formula || ep.variables || '',
      'Authentication': ep.authentication,
      'Database': ep.database || databaseType, // Use endpoint-specific database if specified, otherwise use detected type
    }));
    const apiWorksheet = XLSX.utils.json_to_sheet(apiData);
    apiWorksheet['!cols'] = [
      { wch: 40 }, // Endpoint
      { wch: 8 },  // Method
      { wch: 20 }, // Area
      { wch: 10 }, // Access
      { wch: 30 }, // Description
      { wch: 50 }, // Formula/Variables
      { wch: 15 }, // Authentication
      { wch: 20 }, // Database
    ];
    // Store worksheets in a map first, then add in order
    const worksheets = new Map<string, any>();
    worksheets.set('API Documentation', apiWorksheet);

    // 4. Get foreign key relationships and add as a sheet
    const foreignKeys = await getForeignKeyRelationships(pool);
    if (foreignKeys.length > 0) {
      const fkData = foreignKeys.map(fk => ({
        'From Table': fk.from_table,
        'From Column': fk.from_column,
        'To Table': fk.to_table,
        'To Column': fk.to_column,
        'On Delete': fk.on_delete || 'NO ACTION',
        'Constraint Name': fk.constraint_name,
      }));
      const fkWorksheet = XLSX.utils.json_to_sheet(fkData);
      fkWorksheet['!cols'] = [
        { wch: 25 }, // From Table
        { wch: 20 }, // From Column
        { wch: 25 }, // To Table
        { wch: 20 }, // To Column
        { wch: 15 }, // On Delete
        { wch: 40 }, // Constraint Name
      ];
      worksheets.set('Foreign Keys', fkWorksheet);
    }

    // 5. Get table info for table of contents
    
    // 6. Check which tables are empty and contain PII (views don't need PII check)
    const tableInfo = await Promise.all(
      allTables.map(async (tableName) => {
        const isEmpty = await isTableEmpty(pool, tableName);
        const hasPII = await checkTableForPII(pool, tableName);
        return {
          name: tableName,
          isEmpty,
          hasPII,
          type: 'TABLE',
        };
      })
    );

    // Add views to table info (no PII check needed for views)
    const viewInfo = allViews.map(viewName => ({
      name: viewName,
      isEmpty: false, // Views are computed, not "empty"
      hasPII: false, // Views don't store data, they query it
      type: 'VIEW',
    }));

    const allTableInfo = [...tableInfo, ...viewInfo];
    
    // 7. Add Table of Contents sheet
    const tocData = [
      { 
        'Sheet Name': 'API Documentation', 
        'Description': 'Complete list of all API endpoints with methods, areas, access levels, and authentication requirements.',
        'Empty?': '',
        'PII data?': ''
      },
      { 
        'Sheet Name': 'Foreign Keys', 
        'Description': 'All foreign key relationships between tables. Shows how tables are linked together.',
        'Empty?': '',
        'PII data?': ''
      },
      { 
        'Sheet Name': 'Table of Contents', 
        'Description': 'This sheet. Overview of all sheets in this workbook.',
        'Empty?': '',
        'PII data?': ''
      },
      ...allTableInfo.map(info => ({
        'Sheet Name': info.name.length > 31 ? info.name.substring(0, 31) : info.name,
        'Description': info.type === 'VIEW' 
          ? `Database view: ${info.name}. Computed from base tables.`
          : getTableDescription(info.name),
        'Empty?': info.type === 'VIEW' ? 'N/A (View)' : (info.isEmpty ? 'Yes' : 'No'),
        'PII data?': info.hasPII ? 'Yes' : 'No',
      })),
    ];
    const tocWorksheet = XLSX.utils.json_to_sheet(tocData);
    tocWorksheet['!cols'] = [
      { wch: 35 }, // Sheet Name
      { wch: 80 }, // Description
      { wch: 10 }, // Empty?
      { wch: 12 }, // PII data?
    ];
    worksheets.set('Table of Contents', tocWorksheet);

    // 8. Export each table and view as a sheet (store in map, then add in order)
    const allDataObjects = [...allTables, ...allViews];
    for (const objectName of allDataObjects) {
      try {
        // Get all data from the table/view
        const dataResult = await pool.query(`SELECT * FROM "${objectName}"`);
        
        if (dataResult.rows.length > 0) {
          // Convert to worksheet
          const worksheet = XLSX.utils.json_to_sheet(dataResult.rows);
          
          // Store worksheet in map (will add in order later)
          // Excel sheet names are limited to 31 characters
          const sheetName = objectName.length > 31 ? objectName.substring(0, 31) : objectName;
          worksheets.set(sheetName, worksheet);
        } else {
          // Create empty sheet with just headers if table is empty
          const columnResult = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = $1 AND table_schema = 'public'
            ORDER BY ordinal_position
          `, [objectName]);
          
          if (columnResult.rows.length > 0) {
            const headers = columnResult.rows.map(row => row.column_name);
            const worksheet = XLSX.utils.aoa_to_sheet([headers]);
            const sheetName = objectName.length > 31 ? objectName.substring(0, 31) : objectName;
            worksheets.set(sheetName, worksheet);
          }
        }
      } catch (tableError: any) {
        console.error(`[Export] Error exporting table/view ${objectName}:`, tableError);
        // Continue with other tables even if one fails
      }
    }

    // 9. Add all worksheets to workbook in the specified order
    for (const sheetName of sheetOrder) {
      const worksheet = worksheets.get(sheetName);
      if (worksheet) {
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        worksheets.delete(sheetName); // Remove from map after adding
      }
    }

    // 10. Add any remaining worksheets that weren't in the order list (in alphabetical order)
    const remainingSheets = Array.from(worksheets.keys()).sort();
    for (const sheetName of remainingSheets) {
      const worksheet = worksheets.get(sheetName);
      if (worksheet) {
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      }
    }

    // Generate Excel file buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Return as downloadable file
    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="all-database-data-${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error('[Export] Error exporting all data:', error);
    return NextResponse.json(
      { error: 'Failed to export data', details: error.message },
      { status: 500 }
    );
  }
}

