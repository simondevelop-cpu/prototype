/**
 * Shared constants for admin API routes
 * Single source of truth for admin configuration
 */

export const ADMIN_EMAIL = 'admin@canadianinsights.ca';
export const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

