/**
 * Helper functions to log user events
 */

import { getPool } from './db';

export interface BankStatementEventMetadata {
  bank: string;
  accountType: string;
  source: 'uploaded' | 'linked';
  filename?: string;
  transactionCount?: number;
}

/**
 * Log a bank statement event (upload or link)
 */
export async function logBankStatementEvent(
  userId: string | number,
  metadata: BankStatementEventMetadata
): Promise<void> {
  const pool = getPool();
  if (!pool) {
    console.warn('[Event Logger] Database not available, skipping event log');
    return;
  }

  try {
    const eventType = metadata.source === 'uploaded' ? 'statement_upload' : 'statement_linked';
    
    await pool.query(
      `INSERT INTO user_events (user_id, event_type, event_timestamp, metadata)
       VALUES ($1, $2, NOW(), $3::jsonb)`,
      [userId, eventType, JSON.stringify(metadata)]
    );
    
    console.log(`[Event Logger] Logged ${eventType} event for user ${userId}`);
  } catch (error: any) {
    // Don't throw - event logging should not break the main flow
    console.error('[Event Logger] Failed to log bank statement event:', error);
  }
}

/**
 * Log a user feedback event
 */
export async function logFeedbackEvent(
  userId: string | number,
  feedbackData: {
    usefulness: number;
    trust: number;
    problems?: string;
    learnMore?: string;
  }
): Promise<void> {
  const pool = getPool();
  if (!pool) {
    console.warn('[Event Logger] Database not available, skipping event log');
    return;
  }

  try {
    await pool.query(
      `INSERT INTO user_events (user_id, event_type, event_timestamp, metadata)
       VALUES ($1, $2, NOW(), $3::jsonb)`,
      [userId, 'feedback', JSON.stringify(feedbackData)]
    );
    
    console.log(`[Event Logger] Logged feedback event for user ${userId}`);
  } catch (error: any) {
    // Don't throw - event logging should not break the main flow
    console.error('[Event Logger] Failed to log feedback event:', error);
  }
}

