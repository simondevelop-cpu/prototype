/**
 * IP Address Utilities
 * 
 * Provides functions to extract and log IP addresses for PII compliance
 */

import { NextRequest } from 'next/server';

/**
 * Extract IP address from Next.js request
 * Checks various headers in order of preference
 */
export function getClientIpAddress(request: NextRequest): string | null {
  // Check X-Forwarded-For header (most common in production)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    const ips = forwardedFor.split(',').map(ip => ip.trim());
    return ips[0] || null;
  }

  // Check X-Real-IP header (alternative)
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Check CF-Connecting-IP header (Cloudflare)
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) {
    return cfIp;
  }

  // Fallback to request IP (may not work in all environments)
  // Note: NextRequest doesn't have a direct IP property, so we return null
  return null;
}

/**
 * Update IP address in l0_pii_users table
 */
export async function updateUserIpAddress(
  internalUserId: number,
  ipAddress: string | null
): Promise<void> {
  if (!ipAddress) return;

  const { getPool } = await import('./db');
  const pool = getPool();
  if (!pool) {
    console.warn('[IP Logger] Database not available, skipping IP log');
    return;
  }

  try {
    await pool.query(
      `UPDATE l0_pii_users 
       SET ip_address = $1, ip_address_updated_at = CURRENT_TIMESTAMP
       WHERE internal_user_id = $2`,
      [ipAddress, internalUserId]
    );
    
    console.log(`[IP Logger] Updated IP address for user ${internalUserId}: ${ipAddress}`);
  } catch (error: any) {
    // Don't throw - IP logging should not break the main flow
    console.error('[IP Logger] Failed to update IP address:', error);
  }
}

