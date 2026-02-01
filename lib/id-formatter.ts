/**
 * ID Formatting Utilities
 * 
 * Provides functions to format database IDs with prefixes for display clarity:
 * - User IDs: U123, U456
 * - Transaction IDs: T789, T101
 * - Event IDs: E202, E303
 * 
 * These are display-only - database IDs remain numeric/text
 */

/**
 * Format a user ID with "U" prefix
 * @param userId - The user ID (number or string)
 * @returns Formatted ID string (e.g., "U123")
 */
export function formatUserId(userId: number | string | null | undefined): string {
  if (userId === null || userId === undefined) return 'N/A';
  return `U${userId}`;
}

/**
 * Format a transaction ID with "T" prefix
 * @param transactionId - The transaction ID (number or string)
 * @returns Formatted ID string (e.g., "T789")
 */
export function formatTransactionId(transactionId: number | string | null | undefined): string {
  if (transactionId === null || transactionId === undefined) return 'N/A';
  return `T${transactionId}`;
}

/**
 * Format an event ID with "E" prefix
 * @param eventId - The event ID (number or string)
 * @returns Formatted ID string (e.g., "E202")
 */
export function formatEventId(eventId: number | string | null | undefined): string {
  if (eventId === null || eventId === undefined) return 'N/A';
  return `E${eventId}`;
}

/**
 * Parse a formatted ID back to its numeric value
 * @param formattedId - Formatted ID string (e.g., "U123", "T789")
 * @returns The numeric ID or null if invalid
 */
export function parseFormattedId(formattedId: string): number | null {
  if (!formattedId || formattedId.length < 2) return null;
  
  const prefix = formattedId[0].toUpperCase();
  const numericPart = formattedId.slice(1);
  
  // Validate prefix
  if (!['U', 'T', 'E'].includes(prefix)) return null;
  
  // Parse numeric part
  const parsed = parseInt(numericPart, 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Format multiple IDs of the same type
 * @param ids - Array of IDs
 * @param formatter - Formatter function (formatUserId, formatTransactionId, etc.)
 * @returns Array of formatted IDs
 */
export function formatIds<T>(
  ids: (T | null | undefined)[],
  formatter: (id: T | null | undefined) => string
): string[] {
  return ids.map(formatter);
}

