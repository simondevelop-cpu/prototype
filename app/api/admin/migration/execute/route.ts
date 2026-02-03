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

      if (tableCheck.rows.length === 0) {
        step.status = 'skipped';
        step.details = { reason: 'Source table does not exist' };
        steps.push(step);
        continue;
      }

      // Check if new table already exists
      const newTableCheck = await pool.query(`
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = $1
      `, [rename.new]);

      if (newTableCheck.rows.length > 0) {
        step.status = 'skipped';
        step.details = { reason: 'Target table already exists' };
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

  // This is complex - will need detailed implementation
  // For now, return placeholder
  steps.push({
    id: 'consolidate-customer-facts',
    name: 'Consolidate l1_users + l2_customer_summary_view → l1_customer_facts',
    description: 'Complex consolidation requiring data mapping and API updates',
    phase: 'consolidation',
    status: 'skipped',
    details: { reason: 'Requires detailed implementation and testing' },
  });

  return steps;
}

async function executeCleanup(pool: any, dryRun: boolean): Promise<MigrationStep[]> {
  const steps: MigrationStep[] = [];

  // Check if l2_transactions_view exists and if it's needed
  try {
    const viewCheck = await pool.query(`
      SELECT 1 FROM information_schema.views 
      WHERE table_name = 'l2_transactions_view'
    `);
    if (viewCheck.rows.length > 0) {
      // Check if it's used anywhere (simplified check)
      steps.push({
        id: 'review-l2-transactions-view',
        name: 'Review l2_transactions_view',
        description: 'Determine if l2_transactions_view is needed or duplicative',
        phase: 'cleanup',
        status: 'skipped',
        details: { reason: 'Manual review required - may be duplicative of l1_transaction_facts' },
      });
    }
  } catch (error: any) {
    // View doesn't exist or error checking
  }

  return steps;
}

