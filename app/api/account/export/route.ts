/**
 * Data Export Endpoint
 * PIPEDA "right to access" - allows users to export all their data
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { ensureTokenizedForAnalytics } from '@/lib/tokenization';

export const dynamic = 'force-dynamic';

/**
 * GET /api/account/export?format=json|csv
 * Export all user data (transactions, profile, onboarding responses)
 * PIPEDA "right to access"
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = payload.sub;
    const pool = getPool();
    if (!pool) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    // Get format (json or csv, default json)
    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'json';

    // Check if L0/L1 tables exist (gracefully handle pg-mem or other environments)
    let hasL0 = false;
    try {
      // Try to query the table directly - if it exists, this will work
      await pool.query('SELECT 1 FROM l0_pii_users LIMIT 1');
      hasL0 = true;
    } catch (e: any) {
      // Table doesn't exist or query failed
      hasL0 = false;
    }

    // Get user profile/PII
    let profile: any = {};
    if (hasL0) {
      const profileResult = await pool.query(`
        SELECT p.email, p.first_name, p.last_name, p.date_of_birth,
               p.recovery_phone, p.province_region, p.created_at, p.updated_at
        FROM l0_pii_users p
        WHERE p.internal_user_id = $1
        AND p.deleted_at IS NULL
      `, [userId]);
      
      if (profileResult.rows.length > 0) {
        profile = profileResult.rows[0];
      }
    }

    // Fallback to users table if no L0 record
    if (!profile.email) {
      const userResult = await pool.query(
        'SELECT email, created_at FROM users WHERE id = $1',
        [userId]
      );
      if (userResult.rows.length > 0) {
        profile = {
          email: userResult.rows[0].email,
          created_at: userResult.rows[0].created_at,
        };
      }
    }

    // Get tokenized user ID for analytics data
    const tokenizedUserId = await ensureTokenizedForAnalytics(userId);

    // Get transactions (from L1 if available, otherwise legacy table)
    let transactions: any[] = [];
    if (hasL0 && tokenizedUserId) {
      const txResult = await pool.query(`
        SELECT id, transaction_date, description, merchant, amount,
               cashflow, account, category, label, created_at
        FROM l1_transaction_facts
        WHERE tokenized_user_id = $1
        ORDER BY transaction_date DESC, created_at DESC
      `, [tokenizedUserId]);
      transactions = txResult.rows;
    } else {
      const txResult = await pool.query(`
        SELECT id, date as transaction_date, description, merchant, amount,
               cashflow, account, category, label, created_at
        FROM transactions
        WHERE user_id = $1
        ORDER BY date DESC, created_at DESC
      `, [userId]);
      transactions = txResult.rows;
    }

    // Get onboarding responses - Schema-adaptive: check if columns exist in users table
    let onboarding: any = null;
    try {
      const schemaCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'completed_at'
      `);
      const useUsersTable = schemaCheck.rows.length > 0;

      if (useUsersTable) {
        // Use users table (post-migration)
        const onboardingResult = await pool.query(`
          SELECT emotional_state, financial_context, motivation, motivation_other,
                 acquisition_source, acquisition_other, insight_preferences, insight_other,
                 last_step, completed_at, updated_at
          FROM users
          WHERE id = $1
        `, [userId]);
        onboarding = onboardingResult.rows.length > 0 ? onboardingResult.rows[0] : null;
      } else {
        // Fallback to onboarding_responses table (pre-migration)
        const onboardingResult = await pool.query(`
          SELECT emotional_state, financial_context, motivation, motivation_other,
                 acquisition_source, insight_preferences, insight_other,
                 completed_at, created_at, updated_at
          FROM onboarding_responses
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT 1
        `, [userId]);
        onboarding = onboardingResult.rows.length > 0 ? onboardingResult.rows[0] : null;
      }
    } catch (error: any) {
      console.error('[Account Export] Error fetching onboarding data:', error);
      // Continue without onboarding data if there's an error
    }

    // Compile export data
    const exportData = {
      profile,
      transactions,
      onboarding,
      exportedAt: new Date().toISOString(),
      format: format,
    };

    // Return in requested format
    if (format === 'csv') {
      // Convert to CSV format
      const csvRows: string[] = [];
      
      // Profile section
      csvRows.push('Section,Field,Value');
      csvRows.push('Profile,Email,' + (profile.email || ''));
      csvRows.push('Profile,First Name,' + (profile.first_name || ''));
      csvRows.push('Profile,Last Name,' + (profile.last_name || ''));
      csvRows.push('Profile,Date of Birth,' + (profile.date_of_birth || ''));
      csvRows.push('Profile,Phone,' + (profile.recovery_phone || ''));
      csvRows.push('Profile,Province/Region,' + (profile.province_region || ''));
      csvRows.push('Profile,Created At,' + (profile.created_at || ''));
      
      // Transactions section
      csvRows.push('');
      csvRows.push('Transactions');
      csvRows.push('ID,Date,Description,Merchant,Amount,Cashflow,Account,Category,Label');
      transactions.forEach(tx => {
        csvRows.push(
          `${tx.id},${tx.transaction_date},${tx.description || ''},${tx.merchant || ''},${tx.amount},${tx.cashflow},${tx.account || ''},${tx.category || ''},${tx.label || ''}`
        );
      });

      return new NextResponse(csvRows.join('\n'), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="user-data-export-${userId}-${Date.now()}.csv"`,
        },
      });
    } else {
      // JSON format (default)
      return NextResponse.json(exportData, {
        headers: {
          'Content-Disposition': `attachment; filename="user-data-export-${userId}-${Date.now()}.json"`,
        },
      });
    }
  } catch (error: any) {
    console.error('[Data Export] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Data export failed',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

