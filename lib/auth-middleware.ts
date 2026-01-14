import { Pool } from 'pg';

/**
 * Check if a user has completed onboarding
 * This should be called in protected API endpoints to ensure
 * users cannot access the app without completing onboarding
 */
export async function requireCompletedOnboarding(
  pool: Pool,
  userId: number
): Promise<{ completed: boolean; error?: string }> {
  try {
    // Schema-adaptive: Check if onboarding columns exist in users table (post-migration)
    let useUsersTable = false;
    try {
      const schemaCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'completed_at'
      `);
      useUsersTable = schemaCheck.rows.length > 0;
    } catch (e) {
      console.log('[Auth Middleware] Could not check schema, using fallback');
    }

    let hasCompleted = false;

    if (useUsersTable) {
      // Use users table (post-migration)
      const result = await pool.query(
        `SELECT completed_at 
         FROM users 
         WHERE id = $1`,
        [userId]
      );
      hasCompleted = result.rows.length > 0 && result.rows[0].completed_at !== null;
    } else {
      // Fallback to onboarding_responses table (pre-migration)
      const schemaCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'onboarding_responses' 
        AND column_name = 'completed_at'
      `);
      const hasCompletedAtColumn = schemaCheck.rows.length > 0;

      if (!hasCompletedAtColumn) {
        // Old schema without completed_at - allow access (backward compatibility)
        console.log('[Auth Middleware] Old schema detected, allowing access');
        return { completed: true };
      }

      const result = await pool.query(
        `SELECT COUNT(*) as count 
         FROM onboarding_responses 
         WHERE user_id = $1 AND completed_at IS NOT NULL`,
        [userId]
      );
      hasCompleted = parseInt(result.rows[0]?.count || '0') > 0;
    }

    if (!hasCompleted) {
      return {
        completed: false,
        error: 'Please complete onboarding before accessing this resource'
      };
    }

    return { completed: true };
  } catch (error: any) {
    console.error('[Auth Middleware] Error checking onboarding status:', error);
    // On error, allow access (fail open) to prevent breaking the app
    return { completed: true };
  }
}

/**
 * Centralized function to clear all authentication tokens
 * Use this in logout handlers to ensure complete session cleanup
 */
export function clearAllAuthTokens(): void {
  if (typeof window === 'undefined') return; // Server-side guard

  // Clear current standard keys
  localStorage.removeItem('ci.session.token');
  localStorage.removeItem('ci.session.user');

  // Clear legacy keys (for migration)
  localStorage.removeItem('token');
  localStorage.removeItem('user');

  console.log('[Auth] All authentication tokens cleared');
}

/**
 * Get the current authentication token
 * Checks both current and legacy keys for backward compatibility
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null; // Server-side guard

  // Prefer current standard key
  const token = localStorage.getItem('ci.session.token');
  if (token) return token;

  // Fallback to legacy key
  const legacyToken = localStorage.getItem('token');
  if (legacyToken) {
    // Migrate to new key
    localStorage.setItem('ci.session.token', legacyToken);
    localStorage.removeItem('token');
    console.log('[Auth] Migrated legacy token to new key');
    return legacyToken;
  }

  return null;
}

/**
 * Set the authentication token
 * Always uses the standard key
 */
export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return; // Server-side guard

  localStorage.setItem('ci.session.token', token);
  // Remove legacy key if it exists
  localStorage.removeItem('token');
}

/**
 * Get the current user data
 * Checks both current and legacy keys for backward compatibility
 */
export function getAuthUser(): any | null {
  if (typeof window === 'undefined') return null; // Server-side guard

  // Prefer current standard key
  const userStr = localStorage.getItem('ci.session.user');
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  // Fallback to legacy key
  const legacyUserStr = localStorage.getItem('user');
  if (legacyUserStr) {
    try {
      const user = JSON.parse(legacyUserStr);
      // Migrate to new key
      localStorage.setItem('ci.session.user', legacyUserStr);
      localStorage.removeItem('user');
      console.log('[Auth] Migrated legacy user data to new key');
      return user;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Set the user data
 * Always uses the standard key
 */
export function setAuthUser(user: any): void {
  if (typeof window === 'undefined') return; // Server-side guard

  localStorage.setItem('ci.session.user', JSON.stringify(user));
  // Remove legacy key if it exists
  localStorage.removeItem('user');
}

