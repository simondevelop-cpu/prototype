/**
 * Test setup file - runs before all tests
 * Configures test environment, mocks, and utilities
 * 
 * Note: This file is only used in test environment (Vitest)
 * Next.js build excludes this file via tsconfig.json
 */

import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock environment variables for tests
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
process.env.TOKENIZATION_SALT = process.env.TOKENIZATION_SALT || 'test-salt';
process.env.CLEANUP_API_KEY = process.env.CLEANUP_API_KEY || 'test-cleanup-key';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Next.js server components - use importOriginal to preserve NextRequest
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    NextResponse: {
      json: (data: any, init?: ResponseInit) => {
        return new Response(JSON.stringify(data), {
          ...init,
          headers: {
            'Content-Type': 'application/json',
            ...init?.headers,
          },
        });
      },
    },
  };
});
