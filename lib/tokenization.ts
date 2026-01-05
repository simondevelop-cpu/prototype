/**
 * Tokenization Utilities
 * 
 * Provides functions to work with tokenized user IDs for analytics.
 * Ensures PII is isolated in L0, and analytics only use anonymized IDs.
 */

import crypto from 'crypto';
import { getPool } from './db';

const TOKENIZATION_SALT = process.env.TOKENIZATION_SALT || 'default_salt_change_in_production';

/**
 * Generate a deterministic tokenized user ID from internal user ID
 * This is a one-way hash that cannot be reversed
 */
export function generateTokenizedUserId(internalUserId: number): string {
  return crypto
    .createHash('sha256')
    .update(`${internalUserId}${TOKENIZATION_SALT}`)
    .digest('hex');
}

/**
 * Get or create tokenized user ID for an internal user ID
 * Uses database function to ensure consistency
 */
export async function getTokenizedUserId(internalUserId: number): Promise<string | null> {
  const pool = getPool();
  if (!pool) return null;

  try {
    // Try to get existing tokenized ID
    const result = await pool.query(
      'SELECT tokenized_user_id FROM l0_user_tokenization WHERE internal_user_id = $1',
      [internalUserId]
    );

    if (result.rows.length > 0) {
      return result.rows[0].tokenized_user_id;
    }

    // If not found, create it
    const tokenizedId = generateTokenizedUserId(internalUserId);
    await pool.query(
      'INSERT INTO l0_user_tokenization (internal_user_id, tokenized_user_id) VALUES ($1, $2) ON CONFLICT (internal_user_id) DO UPDATE SET tokenized_user_id = EXCLUDED.tokenized_user_id',
      [internalUserId, tokenizedId]
    );

    return tokenizedId;
  } catch (error) {
    console.error('[Tokenization] Error getting tokenized user ID:', error);
    return null;
  }
}

/**
 * Get internal user ID from tokenized ID (for admin/PII operations only)
 * This should ONLY be used in L0 operations, never in analytics
 */
export async function getInternalUserId(tokenizedUserId: string): Promise<number | null> {
  const pool = getPool();
  if (!pool) return null;

  try {
    const result = await pool.query(
      'SELECT internal_user_id FROM l0_user_tokenization WHERE tokenized_user_id = $1',
      [tokenizedUserId]
    );

    return result.rows.length > 0 ? result.rows[0].internal_user_id : null;
  } catch (error) {
    console.error('[Tokenization] Error getting internal user ID:', error);
    return null;
  }
}

/**
 * Check if a user ID is a tokenized ID (starts with hex characters, 64 chars)
 */
export function isTokenizedUserId(userId: string | number): boolean {
  if (typeof userId === 'number') return false;
  return /^[a-f0-9]{64}$/i.test(userId);
}

/**
 * Ensure user ID is tokenized for analytics queries
 * If internal ID provided, converts to tokenized ID
 */
export async function ensureTokenizedForAnalytics(userId: number | string): Promise<string | null> {
  if (typeof userId === 'string') {
    // Already tokenized or invalid
    return isTokenizedUserId(userId) ? userId : null;
  }

  // Internal ID - convert to tokenized
  return await getTokenizedUserId(userId);
}

