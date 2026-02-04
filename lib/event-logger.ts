/**
 * Helper functions to log user events
 */

import { getPool } from './db';
import { hashPassword } from './auth';
import crypto from 'crypto';

/**
 * Get or create session ID for a user
 * Sessions are tracked per user and expire after 30 minutes of inactivity
 * Session ID format: {userId}_{timestamp}_{random}
 */
async function getOrCreateSessionId(pool: any, userId: number): Promise<string> {
  try {
    // Check for recent session (within 30 minutes)
    const recentSessionResult = await pool.query(
      `SELECT session_id FROM l1_event_facts 
       WHERE user_id = $1 
         AND session_id IS NOT NULL
         AND event_timestamp > NOW() - INTERVAL '30 minutes'
       ORDER BY event_timestamp DESC 
       LIMIT 1`,
      [userId]
    );
    
    if (recentSessionResult.rows.length > 0) {
      const existingSessionId = recentSessionResult.rows[0].session_id;
      // Parse timestamp from session ID (format: userId_timestamp_random)
      const parts = existingSessionId.split('_');
      if (parts.length >= 2) {
        const sessionTimestamp = parseInt(parts[1], 10);
        const now = Date.now();
        const thirtyMinutes = 30 * 60 * 1000;
        
        // If session is less than 30 minutes old, reuse it
        if (!isNaN(sessionTimestamp) && (now - sessionTimestamp) < thirtyMinutes) {
          return existingSessionId;
        }
      }
    }
  } catch (error) {
    // If query fails (e.g., session_id column doesn't exist yet), continue to create new session
    console.warn('[Event Logger] Could not check for existing session, creating new one:', error);
  }
  
  // Create new session ID
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');
  return `${userId}_${timestamp}_${random}`;
}

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
    
    // Get tokenized_user_id for analytics
    const numericUserId = typeof userId === 'number' ? userId : parseInt(String(userId), 10);
    const tokenizedResult = await pool.query(
      'SELECT tokenized_user_id FROM l0_user_tokenization WHERE internal_user_id = $1',
      [numericUserId]
    );
    const tokenizedUserId = tokenizedResult.rows[0]?.tokenized_user_id || null;
    
    // Get or create session ID
    const sessionId = await getOrCreateSessionId(pool, numericUserId);
    
    await pool.query(
      `INSERT INTO l1_event_facts (user_id, tokenized_user_id, event_type, event_timestamp, metadata, is_admin, session_id)
       VALUES ($1, $2, $3, NOW(), $4::jsonb, FALSE, $5)`,
      [numericUserId, tokenizedUserId, eventType, JSON.stringify(metadata), sessionId]
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
    // Get tokenized_user_id for analytics
    const numericUserId = typeof userId === 'number' ? userId : parseInt(String(userId), 10);
    const tokenizedResult = await pool.query(
      'SELECT tokenized_user_id FROM l0_user_tokenization WHERE internal_user_id = $1',
      [numericUserId]
    );
    const tokenizedUserId = tokenizedResult.rows[0]?.tokenized_user_id || null;
    
    // Get or create session ID
    const sessionId = await getOrCreateSessionId(pool, numericUserId);
    
    await pool.query(
      `INSERT INTO l1_event_facts (user_id, tokenized_user_id, event_type, event_timestamp, metadata, is_admin, session_id)
       VALUES ($1, $2, $3, NOW(), $4::jsonb, FALSE, $5)`,
      [numericUserId, tokenizedUserId, 'feedback', JSON.stringify(feedbackData), sessionId]
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

    // Get tokenized_user_id for analytics
    const numericUserId = typeof userId === 'number' ? userId : parseInt(String(userId), 10);
    const tokenizedResult = await pool.query(
      'SELECT tokenized_user_id FROM l0_user_tokenization WHERE internal_user_id = $1',
      [numericUserId]
    );
    const tokenizedUserId = tokenizedResult.rows[0]?.tokenized_user_id || null;
    
    // Get or create session ID (for account creation, use new session; for others, try to get existing)
    const sessionId = await getOrCreateSessionId(pool, numericUserId);
    
    // Use INSERT ... ON CONFLICT DO NOTHING to prevent race conditions
    // The unique index on (user_id, event_type, metadata->>'consentType') will prevent duplicates
    // For partial unique indexes, we must reference the columns, not the constraint name
    const result = await pool.query(
      `INSERT INTO l1_event_facts (user_id, tokenized_user_id, event_type, event_timestamp, metadata, is_admin, session_id)
       VALUES ($1, $2, $3, NOW(), $4::jsonb, FALSE, $5)
       ON CONFLICT (user_id, event_type, ((metadata->>'consentType')))
       WHERE event_type = 'consent'
       DO NOTHING
       RETURNING id`,
      [numericUserId, tokenizedUserId, 'consent', JSON.stringify(eventMetadata), sessionId]
    );
    
    if (result.rows.length > 0) {
      console.log(`[Event Logger] Logged consent event (${consentType}) for user ${userId}`);
    } else {
      console.log(`[Event Logger] Consent event (${consentType}) for user ${userId} already exists, skipped duplicate`);
    }
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
    // Ensure userId is a number for database consistency
    const userIdNum = typeof userId === 'number' ? userId : parseInt(String(userId), 10);
    if (isNaN(userIdNum)) {
      console.error('[Event Logger] Invalid userId:', userId);
      return;
    }

    // Get tokenized_user_id for analytics
    const tokenizedResult = await pool.query(
      'SELECT tokenized_user_id FROM l0_user_tokenization WHERE internal_user_id = $1',
      [userIdNum]
    );
    const tokenizedUserId = tokenizedResult.rows[0]?.tokenized_user_id || null;
    
    // Get or create session ID
    const sessionId = await getOrCreateSessionId(pool, userIdNum);
    
    await pool.query(
      `INSERT INTO l1_event_facts (user_id, tokenized_user_id, event_type, event_timestamp, metadata, is_admin, session_id)
       VALUES ($1, $2, $3, NOW(), $4::jsonb, FALSE, $5)`,
      [userIdNum, tokenizedUserId, 'transaction_edit', JSON.stringify({
        transactionId,
        changes,
        timestamp: new Date().toISOString(),
      }), sessionId]
    );
    
    console.log(`[Event Logger] Logged transaction edit event for user ${userIdNum}, transaction ${transactionId} with ${changes.length} changes`);
  } catch (error: any) {
    // Don't throw - event logging should not break the main flow
    console.error('[Event Logger] Failed to log transaction edit event:', error);
    console.error('[Event Logger] Error details:', {
      userId,
      transactionId,
      errorMessage: error.message,
      errorCode: error.code,
    });
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
    // Ensure userId is a number for database consistency
    const userIdNum = typeof userId === 'number' ? userId : parseInt(String(userId), 10);
    if (isNaN(userIdNum)) {
      console.error('[Event Logger] Invalid userId:', userId);
      return;
    }

    // Get tokenized_user_id for analytics
    const tokenizedResult = await pool.query(
      'SELECT tokenized_user_id FROM l0_user_tokenization WHERE internal_user_id = $1',
      [userIdNum]
    );
    const tokenizedUserId = tokenizedResult.rows[0]?.tokenized_user_id || null;
    
    // Get or create session ID
    const sessionId = await getOrCreateSessionId(pool, userIdNum);
    
    await pool.query(
      `INSERT INTO l1_event_facts (user_id, tokenized_user_id, event_type, event_timestamp, metadata, is_admin, session_id)
       VALUES ($1, $2, $3, NOW(), $4::jsonb, FALSE, $5)`,
      [userIdNum, tokenizedUserId, 'bulk_edit', JSON.stringify({
        transactionIds,
        fieldsUpdated,
        transactionCount,
        timestamp: new Date().toISOString(),
      }), sessionId]
    );
    
    console.log(`[Event Logger] Logged bulk edit event for user ${userIdNum}, ${transactionCount} transactions`);
  } catch (error: any) {
    // Don't throw - event logging should not break the main flow
    console.error('[Event Logger] Failed to log bulk edit event:', error);
    console.error('[Event Logger] Error details:', {
      userId,
      transactionCount,
      errorMessage: error.message,
      errorCode: error.code,
    });
  }
}

/**
 * Log a user login event (for WAU/MAU tracking)
 */
export async function logUserLoginEvent(userId: string | number): Promise<void> {
  const pool = getPool();
  if (!pool) {
    console.warn('[Event Logger] Database not available, skipping login event log');
    return;
  }

  try {
    const numericUserId = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    if (isNaN(numericUserId)) {
      console.error('[Event Logger] Invalid userId provided for login event:', userId);
      return;
    }

    // Get tokenized_user_id for analytics
    const tokenizedResult = await pool.query(
      'SELECT tokenized_user_id FROM l0_user_tokenization WHERE internal_user_id = $1',
      [numericUserId]
    );
    const tokenizedUserId = tokenizedResult.rows[0]?.tokenized_user_id || null;
    
    // Get or create session ID
    const sessionId = await getOrCreateSessionId(pool, numericUserId);
    
    await pool.query(
      `INSERT INTO l1_event_facts (user_id, tokenized_user_id, event_type, event_timestamp, metadata, is_admin, session_id)
       VALUES ($1, $2, $3, NOW(), $4::jsonb, FALSE, $5)`,
      [numericUserId, tokenizedUserId, 'login', JSON.stringify({
        timestamp: new Date().toISOString(),
      }), sessionId]
    );
    
    console.log(`[Event Logger] Logged login event for user ${numericUserId}`);
  } catch (error: any) {
    // Don't throw - event logging should not break the main flow
    console.error('[Event Logger] Failed to log login event:', error);
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
    // Find or create admin user for event logging
    // First, try to find a user with the admin email
    let adminUserId: number | null = null;
    
    try {
      const userResult = await pool.query(
        'SELECT id FROM users WHERE email = $1 LIMIT 1',
        [adminEmail.toLowerCase()]
      );
      
      if (userResult.rows.length > 0) {
        adminUserId = userResult.rows[0].id;
      } else {
        // Admin user doesn't exist - create a minimal admin user record for event logging
        // This allows us to track admin events without requiring a full user account
        try {
          // Create a minimal admin user (password hash is required but won't be used for login)
          // Use a secure random password hash that will never match any real password
          const randomPassword = crypto.randomBytes(32).toString('hex');
          const dummyHash = await hashPassword(randomPassword);
          const createResult = await pool.query(
            'INSERT INTO users (email, password_hash, display_name, email_validated) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING id',
            [adminEmail.toLowerCase(), dummyHash, 'Admin User', true]
          );
          adminUserId = createResult.rows[0].id;
          console.log(`[Event Logger] Created admin user record for ${adminEmail} with ID ${adminUserId}`);
        } catch (createError: any) {
          // If creation fails (e.g., email conflict), try to fetch again
          if (createError.code === '23505') { // Unique violation
            const retryResult = await pool.query(
              'SELECT id FROM users WHERE email = $1 LIMIT 1',
              [adminEmail.toLowerCase()]
            );
            if (retryResult.rows.length > 0) {
              adminUserId = retryResult.rows[0].id;
            }
          }
          if (!adminUserId) {
            console.warn(`[Event Logger] Could not create or find admin user for ${adminEmail}, skipping event log`);
            return;
          }
        }
      }
    } catch (userError) {
      console.error('[Event Logger] Failed to find/create admin user:', userError);
      return;
    }

    if (!adminUserId) {
      console.warn(`[Event Logger] Could not determine admin user ID for ${adminEmail}`);
      return;
    }

    // Insert the admin event with the valid user_id and is_admin flag
    await pool.query(
      `INSERT INTO l1_event_facts (user_id, event_type, event_timestamp, metadata, is_admin)
       VALUES ($1, $2, NOW(), $3::jsonb, TRUE)`,
      [adminUserId, eventType, JSON.stringify({
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

