import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'canadian-insights-demo-secret-key-change-in-production';
// Session timeout: 5 minutes 20 seconds (320 seconds) - users must re-authenticate after inactivity
// Warning shown at 5 minutes, logout at 5 min 20 sec
const SESSION_TTL_SECONDS = Number(process.env.JWT_TTL_SECONDS || 5 * 60 + 20); // 5 minutes 20 seconds
const BCRYPT_ROUNDS = 12;

/**
 * Helper function to convert base64 to base64url format
 * Base64url uses - and _ instead of + and /, and omits padding
 */
function base64ToBase64URL(base64: string): string {
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Helper function to convert base64url to base64 format
 */
function base64URLToBase64(base64url: string): string {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  while (base64.length % 4) {
    base64 += '=';
  }
  return base64;
}

/**
 * Hash password using bcrypt (secure, slow hash with salt)
 * Replaces old SHA-256 implementation for security
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify password against hash
 * Supports both bcrypt (new) and SHA-256 (legacy) for backward compatibility
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // Check if hash is bcrypt format (starts with $2a$, $2b$, or $2y$)
  if (hash.startsWith('$2')) {
    return bcrypt.compare(password, hash);
  }
  
  // Legacy SHA-256 support (for existing passwords)
  // Will be migrated to bcrypt on next successful login
  const sha256Hash = crypto.createHash('sha256').update(password).digest('hex');
  return sha256Hash === hash;
}

/**
 * Legacy SHA-256 hash function (deprecated)
 * Kept for migration purposes only - do not use for new passwords
 * @deprecated Use hashPassword() instead
 */
export function hashPasswordLegacy(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function createToken(userId: number): string {
  // Use base64 and convert to base64url for compatibility
  const header = base64ToBase64URL(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64'));
  const payload = base64ToBase64URL(Buffer.from(
    JSON.stringify({ 
      sub: userId,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS 
    })
  ).toString('base64'));
  const signature = base64ToBase64URL(crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64'));
  return `${header}.${payload}.${signature}`;
}

export function verifyToken(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [headerPart, payloadPart, signaturePart] = parts;
    
    // Verify signature - convert base64url to base64 for digest, then back to base64url
    const expectedSignature = base64ToBase64URL(crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${headerPart}.${payloadPart}`)
      .digest('base64'));
    
    if (signaturePart !== expectedSignature) {
      return null;
    }
    
    // Decode payload - convert base64url to base64 first
    const payloadBase64 = base64URLToBase64(payloadPart);
    const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf8');
    const payload = JSON.parse(payloadJson);
    
    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    
    return payload;
  } catch (error) {
    console.error('[AUTH] Token verification failed:', error);
    return null;
  }
}

