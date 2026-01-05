/**
 * Simple in-memory rate limiter
 * 
 * Tracks request counts per identifier (e.g., email or IP) within time windows.
 * For production, consider using Redis-based solution like @upstash/ratelimit.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Check if request should be rate limited
 * 
 * @param identifier - Unique identifier (email, IP, etc.)
 * @param maxRequests - Maximum requests allowed
 * @param windowMs - Time window in milliseconds
 * @returns true if allowed, false if rate limited
 */
export function checkRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const key = identifier.toLowerCase();
  
  // Get or create entry
  let entry = rateLimitStore.get(key);
  
  // Clean expired entries (every 100 requests to avoid memory bloat)
  if (Math.random() < 0.01) {
    cleanupExpiredEntries(now);
  }
  
  // Check if entry exists and is still valid
  if (entry && entry.resetAt > now) {
    // Within window - increment count
    entry.count++;
    
    if (entry.count > maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.resetAt,
      };
    }
    
    return {
      allowed: true,
      remaining: maxRequests - entry.count,
      resetAt: entry.resetAt,
    };
  }
  
  // New window or expired - reset
  const resetAt = now + windowMs;
  entry = {
    count: 1,
    resetAt,
  };
  
  rateLimitStore.set(key, entry);
  
  return {
    allowed: true,
    remaining: maxRequests - 1,
    resetAt,
  };
}

/**
 * Clean up expired entries to prevent memory bloat
 */
function cleanupExpiredEntries(now: number): void {
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Clear rate limit for an identifier (useful for testing or admin)
 */
export function clearRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier.toLowerCase());
}

/**
 * Get rate limit status for an identifier
 */
export function getRateLimitStatus(
  identifier: string,
  maxRequests: number,
  windowMs: number
): { remaining: number; resetAt: number; resetInSeconds: number } {
  const key = identifier.toLowerCase();
  const entry = rateLimitStore.get(key);
  const now = Date.now();
  
  if (!entry || entry.resetAt <= now) {
    return {
      remaining: maxRequests,
      resetAt: now + windowMs,
      resetInSeconds: Math.ceil(windowMs / 1000),
    };
  }
  
  return {
    remaining: Math.max(0, maxRequests - entry.count),
    resetAt: entry.resetAt,
    resetInSeconds: Math.ceil((entry.resetAt - now) / 1000),
  };
}

