/**
 * Centralized API client with automatic token refresh and 401 error handling
 */

import { verifyToken } from './auth';

const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000; // Refresh token if it expires in less than 5 minutes
const WARNING_THRESHOLD = 5 * 60 * 1000; // Show warning if token expires in less than 5 minutes

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
}

/**
 * Check if token is expired or about to expire
 */
export function isTokenExpiring(token: string | null): boolean {
  if (!token) return true;
  
  const payload = verifyToken(token);
  if (!payload || !payload.exp) return true;
  
  const expirationTime = payload.exp * 1000; // Convert to milliseconds
  const now = Date.now();
  const timeUntilExpiry = expirationTime - now;
  
  return timeUntilExpiry < TOKEN_REFRESH_THRESHOLD;
}

/**
 * Check if token should show warning (expires in less than 5 minutes)
 */
export function shouldShowExpirationWarning(token: string | null): boolean {
  if (!token) return false;
  
  const payload = verifyToken(token);
  if (!payload || !payload.exp) return false;
  
  const expirationTime = payload.exp * 1000; // Convert to milliseconds
  const now = Date.now();
  const timeUntilExpiry = expirationTime - now;
  
  return timeUntilExpiry > 0 && timeUntilExpiry < WARNING_THRESHOLD;
}

/**
 * Get time until token expiration in milliseconds
 */
export function getTimeUntilExpiration(token: string | null): number | null {
  if (!token) return null;
  
  const payload = verifyToken(token);
  if (!payload || !payload.exp) return null;
  
  const expirationTime = payload.exp * 1000; // Convert to milliseconds
  const now = Date.now();
  return Math.max(0, expirationTime - now);
}

/**
 * Refresh the user token
 */
export async function refreshToken(currentToken: string): Promise<string | null> {
  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${currentToken}`,
        'Content-Type': 'application/json',
        'Origin': window.location.origin,
      },
    });

    if (!response.ok) {
      console.error('[API Client] Token refresh failed:', response.status);
      return null;
    }

    const data = await response.json();
    if (data.token) {
      // Update token in localStorage
      localStorage.setItem('ci.session.token', data.token);
      return data.token;
    }

    return null;
  } catch (error) {
    console.error('[API Client] Token refresh error:', error);
    return null;
  }
}

/**
 * Centralized fetch wrapper with automatic token refresh and 401 handling
 */
export async function apiFetch<T = any>(
  url: string,
  options: RequestInit = {},
  onUnauthorized?: () => void
): Promise<ApiResponse<T>> {
  // Get current token
  let token = localStorage.getItem('ci.session.token');
  
  if (!token) {
    // No token, trigger logout
    if (onUnauthorized) {
      onUnauthorized();
    } else {
      // Default: redirect to home (which will show login)
      window.location.href = '/';
    }
    return { error: 'No authentication token', status: 401 };
  }

  // Check for inactivity timeout (30 minutes)
  const lastActivityKey = 'ci.session.lastActivity';
  const lastActivity = localStorage.getItem(lastActivityKey);
  const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes in milliseconds
  
  if (lastActivity) {
    const lastActivityTime = parseInt(lastActivity, 10);
    const timeSinceActivity = Date.now() - lastActivityTime;
    
    if (timeSinceActivity > INACTIVITY_TIMEOUT_MS) {
      // User has been inactive for more than 30 minutes - force logout
      console.log('[API Client] Session expired due to inactivity (30 minutes)');
      localStorage.removeItem('ci.session.token');
      localStorage.removeItem('ci.session.user');
      localStorage.removeItem(lastActivityKey);
      if (onUnauthorized) {
        onUnauthorized();
      } else {
        window.location.href = '/';
      }
      return { error: 'Session expired due to inactivity', status: 401 };
    }
  }
  
  // Update last activity time
  localStorage.setItem(lastActivityKey, Date.now().toString());

  // Check if token needs refresh before making request
  // Only refresh if there's been recent activity (within 30 minutes)
  if (isTokenExpiring(token)) {
    const newToken = await refreshToken(token);
    if (newToken) {
      token = newToken;
      // Update last activity after successful refresh
      localStorage.setItem(lastActivityKey, Date.now().toString());
    } else {
      // Refresh failed, token is invalid
      localStorage.removeItem('ci.session.token');
      localStorage.removeItem('ci.session.user');
      localStorage.removeItem(lastActivityKey);
      if (onUnauthorized) {
        onUnauthorized();
      } else {
        window.location.href = '/';
      }
      return { error: 'Token refresh failed', status: 401 };
    }
  }

  // Add Authorization header
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  
  // Add Origin header for CSRF protection if not present
  if (!headers.has('Origin')) {
    headers.set('Origin', window.location.origin);
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle 401 Unauthorized
    if (response.status === 401) {
      // Try refreshing token once more
      const refreshedToken = await refreshToken(token);
      
      if (refreshedToken) {
        // Retry the request with new token
        headers.set('Authorization', `Bearer ${refreshedToken}`);
        const retryResponse = await fetch(url, {
          ...options,
          headers,
        });

        if (retryResponse.status === 401) {
          // Still unauthorized after refresh, logout
          localStorage.removeItem('ci.session.token');
          localStorage.removeItem('ci.session.user');
          if (onUnauthorized) {
            onUnauthorized();
          } else {
            window.location.href = '/';
          }
          return { error: 'Unauthorized', status: 401 };
        }

        // Retry succeeded
        const retryData = await retryResponse.json().catch(() => ({}));
        return { data: retryData, status: retryResponse.status };
      } else {
        // Refresh failed, logout
        localStorage.removeItem('ci.session.token');
        localStorage.removeItem('ci.session.user');
        if (onUnauthorized) {
          onUnauthorized();
        } else {
          window.location.href = '/';
        }
        return { error: 'Unauthorized', status: 401 };
      }
    }

    // Handle other errors
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { 
        error: errorData.error || `Request failed with status ${response.status}`, 
        status: response.status 
      };
    }

    // Success
    const data = await response.json().catch(() => ({}));
    return { data, status: response.status };
  } catch (error: any) {
    console.error('[API Client] Fetch error:', error);
    return { 
      error: error.message || 'Network error', 
      status: 0 
    };
  }
}

