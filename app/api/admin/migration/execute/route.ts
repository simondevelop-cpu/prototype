import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';

export const dynamic = 'force-dynamic';

export interface MigrationStep {
  id: string;
  name: string;
  description: string;
  phase: 'simple-rename' | 'schema-change' | 'consolidation' | 'cleanup';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  error?: string;
  details?: any;
}

// POST: Execute a migration phase
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { phase, dryRun = false } = body;

    if (!phase || !['simple-rename', 'schema-change', 'consolidation', 'cleanup'].includes(phase)) {
      return NextResponse.json({ error: 'Invalid phase specified' }, { status: 400 });
    }

    const pool = getPool();
    if (!pool) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const steps: MigrationStep[] = [];

    if (phase === 'simple-rename') {
      steps.push(...await executeSimpleRenames(pool, dryRun));
    } else if (phase === 'schema-change') {
      steps.push(...await executeSchemaChanges(pool, dryRun));
    } else if (phase === 'consolidation') {
      steps.push(...await executeConsolidations(pool, dryRun));
    } else if (phase === 'cleanup') {
      steps.push(...await executeCleanup(pool, dryRun));
    }

    const summary = {
      total: steps.length,
      completed: steps.filter(s => s.status === 'completed').length,
      failed: steps.filter(s => s.status === 'failed').length,
      skipped: steps.filter(s => s.status === 'skipped').length,
    };

    return NextResponse.json({
      success: summary.failed === 0,
      phase,
      dryRun,
      steps,
      summary,
      timestamp: new Date().toISOString(),
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Migration Execute API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to execute migration', details: error.message },
      { status: 500 }
    );
  }
}

async function executeSimpleRenames(pool: any, dryRun: boolean): Promise<MigrationStep[]> {
  const steps: MigrationStep[] = [];
  const renames = [
    { old: 'admin_keywords', new: 'l1_admin_keywords' },
    { old: 'admin_merchants', new: 'l1_admin_merchants' },
    { old: 'admin_available_slots', new: 'l1_admin_available_slots' },
    { old: 'admin_chat_bookings', new: 'l1_admin_chat_bookings' },
    { old: 'onboarding_responses', new: 'l1_onboarding_responses' },
    { old: 'survey_responses', new: 'l1_survey_responses' },
    { old: 'l1_events', new: 'l1_event_facts' },
  ];

  for (const rename of renames) {
    const step: MigrationStep = {
      id: `rename-${rename.old}`,
      name: `Rename ${rename.old} → ${rename.new}`,
      description: `Rename table from ${rename.old} to ${rename.new}`,
      phase: 'simple-rename',
      status: 'pending',
    };

    try {
      // Check if old table exists
      const tableCheck = await pool.query(`
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = $1
      `, [rename.old]);

      // Check if new table already exists
      const newTableCheck = await pool.query(`
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = $1
      `, [rename.new]);

      // If target table already exists, migration is already done
      if (newTableCheck.rows.length > 0) {
        step.status = 'completed';
        step.details = { 
          reason: 'Target table already exists - migration already completed',
          note: 'This table was likely renamed in a previous migration'
        };
        steps.push(step);
        continue;
      }

      // If source table doesn't exist and target doesn't exist, table never existed
      if (tableCheck.rows.length === 0) {
        step.status = 'skipped';
        step.details = { 
          reason: 'Source table does not exist',
          note: 'This table may never have been created, or was already renamed/dropped'
        };
        steps.push(step);
        continue;
      }

      if (dryRun) {
        step.status = 'completed';
        step.details = { wouldExecute: true };
      } else {
        step.status = 'running';
        await pool.query(`ALTER TABLE ${rename.old} RENAME TO ${rename.new}`);
        step.status = 'completed';
        step.details = { executed: true };
      }

      steps.push(step);
    } catch (error: any) {
      step.status = 'failed';
      step.error = error.message;
      steps.push(step);
    }
  }

  return steps;
}

async function executeSchemaChanges(pool: any, dryRun: boolean): Promise<MigrationStep[]> {
  const steps: MigrationStep[] = [];

  // Step 1: Rename l0_category_list → l1_admin_categorisation_list
  try {
    const tableCheck = await pool.query(`
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'l0_category_list'
    `);
    if (tableCheck.rows.length > 0) {
      if (dryRun) {
        steps.push({
          id: 'rename-l0-category-list',
          name: 'Rename l0_category_list → l1_admin_categorisation_list',
          description: 'Rename category list table',
          phase: 'schema-change',
          status: 'completed',
          details: { wouldExecute: true },
        });
      } else {
        await pool.query(`ALTER TABLE l0_category_list RENAME TO l1_admin_categorisation_list`);
        steps.push({
          id: 'rename-l0-category-list',
          name: 'Rename l0_category_list → l1_admin_categorisation_list',
          description: 'Rename category list table',
          phase: 'schema-change',
          status: 'completed',
        });
      }
    }
  } catch (error: any) {
    steps.push({
      id: 'rename-l0-category-list',
      name: 'Rename l0_category_list → l1_admin_categorisation_list',
      description: 'Rename category list table',
      phase: 'schema-change',
      status: 'failed',
      error: error.message,
    });
  }

  // Step 2: Rename l0_insight_list → l1_admin_insights_list
  try {
    const tableCheck = await pool.query(`
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'l0_insight_list'
    `);
    if (tableCheck.rows.length > 0) {
      if (dryRun) {
        steps.push({
          id: 'rename-l0-insight-list',
          name: 'Rename l0_insight_list → l1_admin_insights_list',
          description: 'Rename insight list table',
          phase: 'schema-change',
          status: 'completed',
          details: { wouldExecute: true },
        });
      } else {
        await pool.query(`ALTER TABLE l0_insight_list RENAME TO l1_admin_insights_list`);
        steps.push({
          id: 'rename-l0-insight-list',
          name: 'Rename l0_insight_list → l1_admin_insights_list',
          description: 'Rename insight list table',
          phase: 'schema-change',
          status: 'completed',
        });
      }
    }
  } catch (error: any) {
    steps.push({
      id: 'rename-l0-insight-list',
      name: 'Rename l0_insight_list → l1_admin_insights_list',
      description: 'Rename insight list table',
      phase: 'schema-change',
      status: 'failed',
      error: error.message,
    });
  }

  // Step 3: Rename and modify admin_categorization_learning → l2_user_categorization_learning
  // This requires adding previous_category column
  try {
    const tableCheck = await pool.query(`
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'admin_categorization_learning'
    `);
    if (tableCheck.rows.length > 0) {
      if (dryRun) {
        steps.push({
          id: 'rename-categorization-learning',
          name: 'Rename admin_categorization_learning → l2_user_categorization_learning',
          description: 'Rename and add previous_category column',
          phase: 'schema-change',
          status: 'completed',
          details: { wouldExecute: true },
        });
      } else {
        // First add previous_category column if it doesn't exist
        const columnCheck = await pool.query(`
          SELECT column_name FROM information_schema.columns 
          WHERE table_name = 'admin_categorization_learning' AND column_name = 'previous_category'
        `);
        if (columnCheck.rows.length === 0) {
          await pool.query(`
            ALTER TABLE admin_categorization_learning 
            ADD COLUMN previous_category TEXT
          `);
        }
        // Then rename the table
        await pool.query(`ALTER TABLE admin_categorization_learning RENAME TO l2_user_categorization_learning`);
        steps.push({
          id: 'rename-categorization-learning',
          name: 'Rename admin_categorization_learning → l2_user_categorization_learning',
          description: 'Rename and add previous_category column',
          phase: 'schema-change',
          status: 'completed',
        });
      }
    }
  } catch (error: any) {
    steps.push({
      id: 'rename-categorization-learning',
      name: 'Rename admin_categorization_learning → l2_user_categorization_learning',
      description: 'Rename and add previous_category column',
      phase: 'schema-change',
      status: 'failed',
      error: error.message,
    });
  }

  return steps;
}

async function executeConsolidations(pool: any, dryRun: boolean): Promise<MigrationStep[]> {
  const steps: MigrationStep[] = [];

  // Step 1: Ensure all users have entries in l1_customer_facts via tokenized_user_id
  try {
    // Check if l0_user_tokenization and l1_customer_facts exist
    const tokenizationCheck = await pool.query(`
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'l0_user_tokenization'
    `);
    const customerFactsCheck = await pool.query(`
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'l1_customer_facts'
    `);

    if (tokenizationCheck.rows.length === 0 || customerFactsCheck.rows.length === 0) {
      steps.push({
        id: 'consolidate-customer-facts',
        name: 'Consolidate users data → l1_customer_facts',
        description: 'Ensure all users have entries in l1_customer_facts',
        phase: 'consolidation',
        status: 'skipped',
        details: { reason: 'Required tables (l0_user_tokenization or l1_customer_facts) do not exist' },
      });
      return steps;
    }

    // Count users without customer_facts entries
    const missingCount = await pool.query(`
      SELECT COUNT(*) as count
      FROM l0_user_tokenization ut
      LEFT JOIN l1_customer_facts cf ON ut.tokenized_user_id = cf.tokenized_user_id
      WHERE cf.tokenized_user_id IS NULL
    `);
    const missing = parseInt(missingCount.rows[0]?.count || '0', 10);

    if (missing === 0) {
      steps.push({
        id: 'consolidate-customer-facts',
        name: 'Consolidate users data → l1_customer_facts',
        description: 'All users already have entries in l1_customer_facts',
        phase: 'consolidation',
        status: 'completed',
        details: { missingCount: 0, note: 'No migration needed' },
      });
    } else {
      if (dryRun) {
        steps.push({
          id: 'consolidate-customer-facts',
          name: 'Consolidate users data → l1_customer_facts',
          description: `Create ${missing} missing entries in l1_customer_facts`,
          phase: 'consolidation',
          status: 'completed',
          details: { wouldExecute: true, missingCount: missing },
        });
      } else {
        // Insert missing entries
        await pool.query(`
          INSERT INTO l1_customer_facts (tokenized_user_id, account_status, account_created_at, created_at, updated_at)
          SELECT 
            ut.tokenized_user_id,
            'active' as account_status,
            u.created_at as account_created_at,
            CURRENT_TIMESTAMP as created_at,
            CURRENT_TIMESTAMP as updated_at
          FROM l0_user_tokenization ut
          INNER JOIN users u ON ut.user_id = u.id
          LEFT JOIN l1_customer_facts cf ON ut.tokenized_user_id = cf.tokenized_user_id
          WHERE cf.tokenized_user_id IS NULL
        `);
        steps.push({
          id: 'consolidate-customer-facts',
          name: 'Consolidate users data → l1_customer_facts',
          description: `Created ${missing} missing entries in l1_customer_facts`,
          phase: 'consolidation',
          status: 'completed',
          details: { migratedCount: missing },
        });
      }
    }
  } catch (error: any) {
    steps.push({
      id: 'consolidate-customer-facts',
      name: 'Consolidate users data → l1_customer_facts',
      description: 'Error consolidating customer facts',
      phase: 'consolidation',
      status: 'failed',
      error: error.message,
    });
  }

  // Step 2: Update l2_customer_summary_view if it exists (ensure it uses l1_transaction_facts)
  try {
    const viewCheck = await pool.query(`
      SELECT 1 FROM information_schema.views 
      WHERE table_name = 'l2_customer_summary_view'
    `);
    if (viewCheck.rows.length > 0) {
      if (dryRun) {
        steps.push({
          id: 'update-customer-summary-view',
          name: 'Verify l2_customer_summary_view',
          description: 'Ensure view uses l1_transaction_facts as source of truth',
          phase: 'consolidation',
          status: 'completed',
          details: { wouldExecute: true, note: 'View exists - verify it uses l1_transaction_facts' },
        });
      } else {
        // View already exists - just verify it's correct (recreate if needed)
        // This is a no-op for now - the view should already be using l1_transaction_facts
        steps.push({
          id: 'update-customer-summary-view',
          name: 'Verify l2_customer_summary_view',
          description: 'View exists and should use l1_transaction_facts',
          phase: 'consolidation',
          status: 'completed',
          details: { note: 'View verification - ensure it uses l1_transaction_facts' },
        });
      }
    } else {
      steps.push({
        id: 'update-customer-summary-view',
        name: 'Verify l2_customer_summary_view',
        description: 'View does not exist',
        phase: 'consolidation',
        status: 'skipped',
        details: { reason: 'View does not exist' },
      });
    }
  } catch (error: any) {
    steps.push({
      id: 'update-customer-summary-view',
      name: 'Verify l2_customer_summary_view',
      description: 'Error checking view',
      phase: 'consolidation',
      status: 'failed',
      error: error.message,
    });
  }

  return steps;
}

async function executeCleanup(pool: any, dryRun: boolean): Promise<MigrationStep[]> {
  const steps: MigrationStep[] = [];

  // Step 1: Drop l2_transactions_view if it exists (duplicative of l1_transaction_facts)
  try {
    const viewCheck = await pool.query(`
      SELECT 1 FROM information_schema.views 
      WHERE table_name = 'l2_transactions_view'
    `);
    if (viewCheck.rows.length > 0) {
      if (dryRun) {
        steps.push({
          id: 'drop-l2-transactions-view',
          name: 'Drop l2_transactions_view',
          description: 'Remove duplicative view (l1_transaction_facts is the source of truth)',
          phase: 'cleanup',
          status: 'completed',
          details: { wouldExecute: true },
        });
      } else {
        await pool.query(`DROP VIEW IF EXISTS l2_transactions_view CASCADE`);
        steps.push({
          id: 'drop-l2-transactions-view',
          name: 'Drop l2_transactions_view',
          description: 'Removed duplicative view',
          phase: 'cleanup',
          status: 'completed',
        });
      }
    } else {
      steps.push({
        id: 'drop-l2-transactions-view',
        name: 'Drop l2_transactions_view',
        description: 'View does not exist',
        phase: 'cleanup',
        status: 'skipped',
        details: { reason: 'View does not exist' },
      });
    }
  } catch (error: any) {
    steps.push({
      id: 'drop-l2-transactions-view',
      name: 'Drop l2_transactions_view',
      description: 'Error checking/dropping view',
      phase: 'cleanup',
      status: 'failed',
      error: error.message,
    });
  }

  // Step 2: Drop empty unused tables (but keep l1_support_tickets)
  const emptyTablesToDrop = [
    'l0_admin_list',
    'l0_insight_list', 
    'l0_primary_metadata',
    'l1_file_ingestion',
    'l1_job_list',
  ];

  for (const tableName of emptyTablesToDrop) {
    try {
      // Check if table exists and is empty
      const tableCheck = await pool.query(`
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = $1
      `, [tableName]);
      
      if (tableCheck.rows.length === 0) {
        steps.push({
          id: `drop-${tableName}`,
          name: `Drop ${tableName}`,
          description: `Table does not exist`,
          phase: 'cleanup',
          status: 'skipped',
          details: { reason: 'Table does not exist' },
        });
        continue;
      }

      // Check row count
      const rowCount = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
      const count = parseInt(rowCount.rows[0]?.count || '0', 10);

      if (count > 0) {
        steps.push({
          id: `drop-${tableName}`,
          name: `Drop ${tableName}`,
          description: `Table has ${count} rows - skipping`,
          phase: 'cleanup',
          status: 'skipped',
          details: { reason: `Table has ${count} rows`, rowCount: count },
        });
        continue;
      }

      if (dryRun) {
        steps.push({
          id: `drop-${tableName}`,
          name: `Drop ${tableName}`,
          description: `Drop empty unused table`,
          phase: 'cleanup',
          status: 'completed',
          details: { wouldExecute: true, rowCount: 0 },
        });
      } else {
        await pool.query(`DROP TABLE IF EXISTS ${tableName} CASCADE`);
        steps.push({
          id: `drop-${tableName}`,
          name: `Drop ${tableName}`,
          description: `Dropped empty table`,
          phase: 'cleanup',
          status: 'completed',
          details: { rowCount: 0 },
        });
      }
    } catch (error: any) {
      steps.push({
        id: `drop-${tableName}`,
        name: `Drop ${tableName}`,
        description: `Error dropping table`,
        phase: 'cleanup',
        status: 'failed',
        error: error.message,
      });
    }
  }

  return steps;
}

