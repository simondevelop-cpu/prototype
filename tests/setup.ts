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

// Suppress console logs in tests (uncomment if needed)
// global.console = {
//   ...console,
//   log: vi.fn(),
//   debug: vi.fn(),
//   info: vi.fn(),
//   warn: vi.fn(),
//   error: vi.fn(),
// };

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

// Mock Next.js server components
vi.mock('next/server', () => ({
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
}));

