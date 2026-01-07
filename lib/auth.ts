import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'canadian-insights-demo-secret-key-change-in-production';
const SESSION_TTL_SECONDS = Number(process.env.JWT_TTL_SECONDS || 60 * 60 * 24); // 24 hours
const BCRYPT_ROUNDS = 12;

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
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ 
      sub: userId,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS 
    })
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

export function verifyToken(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [headerPart, payloadPart, signaturePart] = parts;
    
    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${headerPart}.${payloadPart}`)
      .digest('base64url');
    
    if (signaturePart !== expectedSignature) {
      return null;
    }
    
    // Decode payload
    const payloadJson = Buffer.from(payloadPart, 'base64url').toString('utf8');
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

