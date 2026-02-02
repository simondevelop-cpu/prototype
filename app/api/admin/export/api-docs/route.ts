import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';

export const dynamic = 'force-dynamic';

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
 * Manually defined API endpoints with documentation
 * This is a comprehensive list of all API endpoints in the application
 */
function getAPIEndpoints(): APIEndpoint[] {
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
    { endpoint: '/api/admin/cohort-analysis', method: 'GET', area: 'Admin', access: 'read', description: 'Get cohort analysis data', authentication: 'admin', variables: 'totalAccounts, validatedEmails, cohorts, intentCategories, dataCoverage', formula: 'Complex aggregations from users (non-PII only), l1_transaction_facts (tokenized_user_id), l1_events (tokenized_user_id for analytics, user_id for operational). NO PII access.' },
    { endpoint: '/api/admin/vanity-metrics', method: 'GET', area: 'Admin', access: 'read', description: 'Get vanity metrics', authentication: 'admin', variables: 'totalAccounts, validatedEmails, intentCategories, cohorts, dataCoverage', formula: 'Aggregations from users (non-PII only), l1_transaction_facts (tokenized_user_id). NO PII access.' },
    { endpoint: '/api/admin/engagement-chart', method: 'GET', area: 'Admin', access: 'read', description: 'Get engagement chart data', authentication: 'admin', variables: 'totalAccounts, validatedEmails, cohorts, intentCategories, dataCoverage, userIds', formula: 'Time-series aggregations from l1_events (tokenized_user_id for analytics, user_id for operational), users (non-PII only). NO PII access.' },
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
 * Export API documentation as Excel workbook
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

    // Detect database type from connection string
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

    // Get all API endpoints
    const endpoints = getAPIEndpoints();
    
    // Prepare data for Excel
    const excelData = endpoints.map(ep => ({
      'Endpoint': ep.endpoint,
      'Method': ep.method,
      'Area': ep.area,
      'Access': ep.access,
      'Description': ep.description,
      'Formula/Variables': ep.formula || ep.variables || '',
      'Authentication': ep.authentication,
      'Database': ep.database || databaseType, // Use endpoint-specific database if specified, otherwise use detected type
    }));

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // Set column widths
    worksheet['!cols'] = [
      { wch: 40 }, // Endpoint
      { wch: 8 },  // Method
      { wch: 20 }, // Area
      { wch: 10 }, // Access
      { wch: 30 }, // Description
      { wch: 50 }, // Formula/Variables
      { wch: 15 }, // Authentication
      { wch: 20 }, // Database
    ];
    
    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'API Endpoints');
    
    // Generate Excel file buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Return as downloadable file
    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="api-documentation-${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error('[API Docs] Error exporting API documentation:', error);
    return NextResponse.json(
      { error: 'Failed to export API documentation', details: error.message },
      { status: 500 }
    );
  }
}

