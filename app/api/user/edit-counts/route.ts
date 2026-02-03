import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { verifyRequestOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // CSRF protection
    if (!verifyRequestOrigin(request)) {
      return NextResponse.json(
        { error: 'Invalid request origin' },
        { status: 403 }
      );
    }

    // Verify authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userIdRaw = decoded.userId || decoded.id || decoded.sub;
    if (!userIdRaw) {
      return NextResponse.json({ error: 'Invalid token: no user ID' }, { status: 401 });
    }
    const userId = typeof userIdRaw === 'number' ? userIdRaw : parseInt(userIdRaw, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 401 });
    }

    const pool = getPool();
    if (!pool) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    // Check if l1_events table exists
    let hasEventsTable = false;
    try {
      const tableCheck = await pool.query(`
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'l1_events'
        LIMIT 1
      `);
      hasEventsTable = tableCheck.rows.length > 0;
    } catch (e) {
      console.log('[Edit Counts API] Could not check for l1_events table');
    }

    // Get tokenized_user_id for querying transactions
    const tokenizedResult = await pool.query(
      'SELECT tokenized_user_id FROM l0_user_tokenization WHERE internal_user_id = $1',
      [userId]
    );
    const tokenizedUserId = tokenizedResult.rows[0]?.tokenized_user_id;

    if (!hasEventsTable) {
      return NextResponse.json({ 
        totalUploads: 0,
        monthsWithData: 0,
        autoCategorisedNumerator: 0,
        autoCategorisedDenominator: 0,
        notCategorisedNumerator: 0,
        notCategorisedDenominator: 0,
        description: 0,
        date: 0,
        amount: 0,
        label: 0,
        bulkEdit: 0,
      }, { status: 200 });
    }

    // Fetch statement upload events for this user (include both statement_upload and statement_linked)
    const statementResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM l1_events
      WHERE user_id = $1
        AND (event_type = 'statement_upload' OR event_type = 'statement_linked')
    `, [userId]);

    // Fetch bulk edit events for this user
    const bulkEditResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM l1_events
      WHERE user_id = $1
        AND event_type = 'bulk_edit'
    `, [userId]);

    // Fetch transaction editing events for this user
    const editResult = await pool.query(`
      SELECT metadata
      FROM l1_events
      WHERE user_id = $1
        AND event_type = 'transaction_edit'
    `, [userId]);

    // Fetch bulk edit events to get transaction IDs that were edited
    const bulkEditDetailsResult = await pool.query(`
      SELECT metadata
      FROM l1_events
      WHERE user_id = $1
        AND event_type = 'bulk_edit'
    `, [userId]);

    // Count edits by field (description, date, amount, label - exclude category)
    const counts = {
      description: 0,
      date: 0,
      amount: 0,
      label: 0,
    };

    // Track unique transaction IDs that have had their category edited
    const categoryEditedTransactionIds = new Set<number>();

    editResult.rows.forEach((row: any) => {
      const metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
      if (metadata && metadata.changes && Array.isArray(metadata.changes)) {
        metadata.changes.forEach((change: any) => {
          const field = change.field;
          if (field === 'description') {
            counts.description++;
          } else if (field === 'date') {
            counts.date++;
          } else if (field === 'amount') {
            counts.amount++;
          } else if (field === 'label') {
            counts.label++;
          } else if (field === 'category' && metadata.transactionId) {
            // Track unique transaction IDs that had category edited
            categoryEditedTransactionIds.add(metadata.transactionId);
          }
        });
      }
    });

    // Also check bulk edits for category changes
    bulkEditDetailsResult.rows.forEach((row: any) => {
      const metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
      if (metadata && metadata.transactionIds && Array.isArray(metadata.transactionIds)) {
        // If bulk edit includes category change, mark all those transactions
        if (metadata.updates && metadata.updates.category !== undefined) {
          metadata.transactionIds.forEach((txId: number) => {
            categoryEditedTransactionIds.add(txId);
          });
        }
      }
    });

    // Get transaction statistics if tokenized_user_id exists
    let monthsWithData = 0;
    let autoCategorisedDenominator = 0; // Total transactions with category
    let autoCategorisedNumerator = 0; // Transactions with category that haven't been edited (still correctly auto-categorised)
    let notCategorisedDenominator = 0; // Total transactions currently without category (uncategorised pool)
    let notCategorisedNumerator = 0; // Transactions you categorised (moved from uncategorised to categorised) - shows your progress in catching and fixing uncategorised transactions

    if (tokenizedUserId) {
      try {
        // Get months with data
        const monthsResult = await pool.query(`
          SELECT COUNT(DISTINCT DATE_TRUNC('month', transaction_date)) as count
          FROM l1_transaction_facts
          WHERE tokenized_user_id = $1
        `, [tokenizedUserId]);
        monthsWithData = parseInt(monthsResult.rows[0]?.count || '0', 10);

        // Get all transactions with their categories
        const transactionsResult = await pool.query(`
          SELECT id, category
          FROM l1_transaction_facts
          WHERE tokenized_user_id = $1
        `, [tokenizedUserId]);

        transactionsResult.rows.forEach((row: any) => {
          const txId = row.id;
          const category = row.category;
          const hasCategory = category && category !== 'Uncategorised' && category !== null && category.trim() !== '';

          if (hasCategory) {
            autoCategorisedDenominator++;
            // If this transaction hasn't had its category edited, it's still auto-categorised
            if (!categoryEditedTransactionIds.has(txId)) {
              autoCategorisedNumerator++;
            }
          } else {
            notCategorisedDenominator++;
            // If this transaction had its category edited (moved from uncategorised to categorised)
            // We check if it was edited by seeing if it's in the edited set but currently has no category
            // Actually, if it was edited and now has a category, it won't be in notCategorisedDenominator
            // So we need to track transactions that were categorised from uncategorised
            // This is tricky - we need to check if a transaction that was uncategorised got a category added
          }
        });

        // Track unique transactions that were categorised (moved from uncategorised to categorised)
        const categorisedFromUncategorised = new Set<number>();
        
        // Check individual edits for transactions that were categorised
        editResult.rows.forEach((row: any) => {
          const metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
          if (metadata && metadata.changes && Array.isArray(metadata.changes)) {
            metadata.changes.forEach((change: any) => {
              if (change.field === 'category' && metadata.transactionId) {
                const oldValue = change.oldValue;
                const newValue = change.newValue;
                // If old value was null/Uncategorised and new value is a category, this was categorised
                if ((!oldValue || oldValue === 'Uncategorised' || oldValue === null || (typeof oldValue === 'string' && oldValue.trim() === '')) &&
                    newValue && newValue !== 'Uncategorised' && newValue !== null && (typeof newValue === 'string' && newValue.trim() !== '')) {
                  categorisedFromUncategorised.add(metadata.transactionId);
                }
              }
            });
          }
        });

        // Also check bulk edits for categorisation
        bulkEditDetailsResult.rows.forEach((row: any) => {
          const metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
          if (metadata && metadata.updates && metadata.updates.category !== undefined) {
            const newCategory = metadata.updates.category;
            if (newCategory && newCategory !== 'Uncategorised' && newCategory !== null && (typeof newCategory === 'string' && newCategory.trim() !== '')) {
              if (metadata.transactionIds && Array.isArray(metadata.transactionIds)) {
                // For bulk edits, we need to check if transactions were uncategorised before
                // Query the transaction states before the bulk edit to see which were uncategorised
                // For now, we'll track all transaction IDs in the bulk edit
                // Note: This might slightly overcount if some already had categories, but we're tracking unique IDs
                metadata.transactionIds.forEach((txId: number) => {
                  categorisedFromUncategorised.add(txId);
                });
              }
            }
          }
        });

        notCategorisedNumerator = categorisedFromUncategorised.size;
      } catch (txError) {
        console.error('[Edit Counts API] Error fetching transaction stats:', txError);
      }
    }

    return NextResponse.json({
      totalUploads: parseInt(statementResult.rows[0]?.count || '0', 10),
      monthsWithData,
      autoCategorisedNumerator,
      autoCategorisedDenominator,
      notCategorisedNumerator,
      notCategorisedDenominator,
      description: counts.description,
      date: counts.date,
      amount: counts.amount,
      label: counts.label,
      bulkEdit: parseInt(bulkEditResult.rows[0]?.count || '0', 10),
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error fetching edit counts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch edit counts', details: error.message },
      { status: 500 }
    );
  }
}

