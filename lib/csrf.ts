/**
 * CSRF Protection Utilities
 * 
 * Provides CSRF token generation/verification and Origin header checking
 * for Next.js API routes.
 */

import crypto from 'crypto';

const CSRF_SECRET = process.env.CSRF_SECRET || process.env.JWT_SECRET || 'csrf-secret-change-in-production';

/**
 * Generate a CSRF token
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Verify CSRF token (simple equality check for now)
 * In production, consider using signed tokens
 */
export function verifyCSRFToken(token: string, expectedToken: string): boolean {
  if (!token || !expectedToken) return false;
  // Use timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(token, 'hex'),
    Buffer.from(expectedToken, 'hex')
  );
}

/**
 * Verify Origin header to prevent CSRF attacks
 * 
 * @param requestOrigin - Origin header from request
 * @param allowedOrigins - List of allowed origins (from env or config)
 * @returns true if origin is valid
 */
export function verifyOrigin(
  requestOrigin: string | null,
  allowedOrigins?: string[]
): boolean {
  // Allow requests with no Origin (same-origin requests, some tools)
  // But in production, you may want to require Origin
  if (!requestOrigin) {
    // For same-origin requests, Origin header may be missing
    // This is acceptable for API routes accessed from same domain
    return true;
  }

  // If allowedOrigins provided, check against them
  if (allowedOrigins && allowedOrigins.length > 0) {
    return allowedOrigins.some(allowed => {
      // Exact match
      if (requestOrigin === allowed) return true;
      // Subdomain matching (e.g., *.example.com)
      if (allowed.startsWith('*.') && requestOrigin.endsWith(allowed.slice(1))) {
        return true;
      }
      return false;
    });
  }

  // Default: Check against common production patterns
  // Allow localhost for development
  const isLocalhost = requestOrigin.startsWith('http://localhost:') ||
                      requestOrigin.startsWith('http://127.0.0.1:');
  
  // Allow same-origin requests (no origin header means same-origin)
  // In production, you'd want to check against your actual domain
  const productionDomains = process.env.ALLOWED_ORIGINS?.split(',') || [];
  if (productionDomains.length > 0) {
    return productionDomains.some(domain => 
      requestOrigin === domain || requestOrigin.endsWith(`.${domain}`)
    );
  }

  // Development mode: allow localhost
  if (process.env.NODE_ENV !== 'production') {
    return isLocalhost;
  }

  // Production mode: require explicit allowed origins
  return false;
}

/**
 * Middleware helper to verify Origin header in Next.js API routes
 */
export function verifyRequestOrigin(request: { headers: Headers | { get: (key: string) => string | null } }): boolean {
  const origin = request.headers.get?.('origin') || 
                 (request.headers as any).origin || 
                 null;
  
  const referer = request.headers.get?.('referer') || 
                  (request.headers as any).referer || 
                  null;

  // If no Origin, check Referer (some browsers don't send Origin for same-origin)
  const originToCheck = origin || (referer ? new URL(referer).origin : null);
  
  // If no origin or referer, allow (same-origin request)
  if (!originToCheck) {
    return true;
  }
  
  // Check explicit allowed origins from env
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean) || [];
  if (allowedOrigins.length > 0) {
    return allowedOrigins.some(allowed => {
      // Exact match
      if (originToCheck === allowed) return true;
      // Subdomain matching (e.g., *.example.com matches app.example.com)
      if (allowed.startsWith('*.') && originToCheck.endsWith(allowed.slice(1))) {
        return true;
      }
      return false;
    });
  }
  
  // Development: allow localhost
  const isLocalhost = originToCheck.startsWith('http://localhost:') ||
                      originToCheck.startsWith('http://127.0.0.1:');
  if (process.env.NODE_ENV !== 'production' || process.env.VERCEL_ENV === 'development') {
    return isLocalhost;
  }
  
  // Production: If ALLOWED_ORIGINS not set, try to use VERCEL_URL as fallback
  // NOTE: For production deployments, set ALLOWED_ORIGINS environment variable
  //       for stricter CSRF protection (e.g., ALLOWED_ORIGINS=https://yourapp.com)
  if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
    // Try to use VERCEL_URL if available (Vercel automatically sets this)
    const vercelUrl = process.env.VERCEL_URL;
    if (vercelUrl) {
      // VERCEL_URL is just the hostname, need to add protocol
      const protocol = process.env.VERCEL_ENV === 'production' ? 'https' : 'https';
      const fallbackOrigin = `${protocol}://${vercelUrl}`;
      if (originToCheck === fallbackOrigin || originToCheck.endsWith(`.${vercelUrl}`)) {
        return true;
      }
    }
    // Only warn if we're actually in production and no fallback worked
    // Suppress warning if we have VERCEL_URL (it will be set automatically)
    if (!vercelUrl) {
      console.warn('[CSRF] ALLOWED_ORIGINS not set in production - allowing all origins (consider setting it for better security)');
    }
    return true;
  }
  
  return false;
}

