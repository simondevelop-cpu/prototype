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

/**
 * Log a consent event
 */
export async function logConsentEvent(
  userId: string | number,
  consentType: 'account_creation' | 'cookie_banner' | 'first_upload' | 'account_linking' | 'settings_update',
  metadata: {
    version?: string; // Terms/Privacy Policy version
    scope?: string; // What consent covers
    choice?: string; // User's choice (e.g., 'accept_all', 'essential_only')
    setting?: string; // For settings updates, which setting was changed
    value?: boolean; // For settings updates, the new value
    [key: string]: any;
  }
): Promise<void> {
  const pool = getPool();
  if (!pool) {
    console.warn('[Event Logger] Database not available, skipping event log');
    return;
  }

  try {
    const eventMetadata = {
      ...metadata,
      consentType,
      timestamp: new Date().toISOString(),
    };

    await pool.query(
      `INSERT INTO user_events (user_id, event_type, event_timestamp, metadata)
       VALUES ($1, $2, NOW(), $3::jsonb)`,
      [userId, 'consent', JSON.stringify(eventMetadata)]
    );
    
    console.log(`[Event Logger] Logged consent event (${consentType}) for user ${userId}`);
  } catch (error: any) {
    // Don't throw - event logging should not break the main flow
    console.error('[Event Logger] Failed to log consent event:', error);
  }
}

/**
 * Log a transaction editing event
 */
export async function logTransactionEditEvent(
  userId: string | number,
  transactionId: number,
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[]
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
      [userId, 'transaction_edit', JSON.stringify({
        transactionId,
        changes,
        timestamp: new Date().toISOString(),
      })]
    );
    
    console.log(`[Event Logger] Logged transaction edit event for user ${userId}, transaction ${transactionId}`);
  } catch (error: any) {
    // Don't throw - event logging should not break the main flow
    console.error('[Event Logger] Failed to log transaction edit event:', error);
  }
}

/**
 * Log a bulk transaction editing event
 */
export async function logBulkEditEvent(
  userId: string | number,
  transactionIds: number[],
  fieldsUpdated: string[],
  transactionCount: number
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
      [userId, 'bulk_edit', JSON.stringify({
        transactionIds,
        fieldsUpdated,
        transactionCount,
        timestamp: new Date().toISOString(),
      })]
    );
    
    console.log(`[Event Logger] Logged bulk edit event for user ${userId}, ${transactionCount} transactions`);
  } catch (error: any) {
    // Don't throw - event logging should not break the main flow
    console.error('[Event Logger] Failed to log bulk edit event:', error);
  }
}

/**
 * Log an admin event (login, tab access, etc.)
 */
export async function logAdminEvent(
  adminEmail: string,
  eventType: 'admin_login' | 'admin_tab_access',
  metadata: {
    action?: string;
    tab?: string;
    [key: string]: any;
  }
): Promise<void> {
  const pool = getPool();
  if (!pool) {
    console.warn('[Event Logger] Database not available, skipping event log');
    return;
  }

  try {
    // Get admin user ID (use a special admin user ID or create a system user)
    // For now, we'll use email as identifier and store in metadata
    await pool.query(
      `INSERT INTO user_events (user_id, event_type, event_timestamp, metadata)
       VALUES (0, $1, NOW(), $2::jsonb)`,
      [eventType, JSON.stringify({
        adminEmail,
        ...metadata,
        timestamp: new Date().toISOString(),
      })]
    );
    
    console.log(`[Event Logger] Logged admin event: ${eventType} for ${adminEmail}`);
  } catch (error: any) {
    // Don't throw - event logging should not break the main flow
    console.error('[Event Logger] Failed to log admin event:', error);
  }
}

