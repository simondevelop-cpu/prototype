# Testing Framework Quick Start Guide

This guide provides step-by-step instructions to implement the testing framework **without changing any existing code**.

---

## 🚀 Step 1: Install Dependencies

Run this command to add all testing dependencies:

```bash
npm install --save-dev \
  @playwright/test@^1.40.0 \
  vitest@^1.0.0 \
  @testing-library/react@^14.1.0 \
  @testing-library/jest-dom@^6.1.0 \
  @testing-library/user-event@^14.5.0 \
  @vitejs/plugin-react@^4.2.0 \
  jsdom@^23.0.0 \
  @vitest/ui@^1.0.0 \
  msw@^2.0.0
```

---

## 📝 Step 2: Update package.json Scripts

Add these scripts to your `package.json` (in the `scripts` section):

```json
"test": "vitest",
"test:ui": "vitest --ui",
"test:coverage": "vitest --coverage",
"test:watch": "vitest --watch",
"test:unit": "vitest run tests/unit",
"test:components": "vitest run tests/components",
"test:api": "vitest run tests/api",
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui",
"test:e2e:debug": "playwright test --debug",
"test:all": "npm run test:unit && npm run test:components && npm run test:api && npm run test:e2e"
```

---

## ⚙️ Step 3: Create Configuration Files

### Create `vitest.config.ts` in project root:

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/helpers/setup.ts'],
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['tests/e2e/**', 'node_modules', '.next'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.config.{ts,js}',
        '**/types/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
```

---

## 🗂️ Step 4: Create Test Directory Structure

Create these directories (they can be empty initially):

```bash
mkdir -p tests/unit/lib
mkdir -p tests/components
mkdir -p tests/api/auth
mkdir -p tests/api/transactions
mkdir -p tests/e2e
mkdir -p tests/helpers
```

---

## 🛠️ Step 5: Create Test Helper Files

### Create `tests/helpers/setup.ts`:

```typescript
import '@testing-library/jest-dom';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock environment variables for tests
process.env.JWT_SECRET = 'test-secret-key';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.DISABLE_DB = '1';
```

### Create `tests/helpers/test-auth.ts`:

```typescript
import { createToken } from '@/lib/auth';

export function createTestToken(userId: number = 1): string {
  return createToken(userId);
}

export function createTestHeaders(userId: number = 1): Headers {
  const token = createTestToken(userId);
  const headers = new Headers();
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');
  return headers;
}
```

### Create `tests/helpers/mocks.ts`:

```typescript
export const mockUser = {
  id: 1,
  email: 'test@example.com',
  display_name: 'Test User',
  password_hash: 'hashed-password',
};

export const mockTransaction = {
  id: 1,
  user_id: 1,
  amount: -50.00,
  description: 'Test Transaction',
  date: new Date('2024-01-15'),
  category: 'Groceries',
  merchant: 'Test Store',
};

export const mockTransactions = [
  mockTransaction,
  { ...mockTransaction, id: 2, amount: -25.00, description: 'Another Transaction' },
];
```

---

## ✅ Step 6: Verify Installation

Run these commands to verify everything is set up:

```bash
# Check Vitest installation
npx vitest --version

# Check Playwright installation
npx playwright --version

# Run existing E2E test (should work now)
npm run test:e2e
```

---

## 🧪 Step 7: Write Your First Test

Create `tests/unit/lib/auth.test.ts` as your first test:

```typescript
import { describe, it, expect } from 'vitest';
import { hashPassword, createToken, verifyToken } from '@/lib/auth';

describe('auth', () => {
  describe('hashPassword', () => {
    it('should hash a password consistently', () => {
      const password = 'test-password';
      const hash1 = hashPassword(password);
      const hash2 = hashPassword(password);
      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(password);
    });
  });

  describe('createToken', () => {
    it('should create a valid JWT token', () => {
      const userId = 1;
      const token = createToken(userId);
      expect(token).toBeDefined();
      expect(token.split('.')).toHaveLength(3);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const userId = 1;
      const token = createToken(userId);
      const payload = verifyToken(token);
      expect(payload).toBeDefined();
      expect(payload.sub).toBe(userId);
    });

    it('should reject an invalid token', () => {
      const result = verifyToken('invalid.token.here');
      expect(result).toBeNull();
    });
  });
});
```

Run your first test:

```bash
npm run test
```

---

## 📊 Step 8: Update tsconfig.json (Optional)

Add test files to TypeScript compilation if needed. Update `tsconfig.json`:

```json
{
  "include": [
    "next-env.d.ts",
    "app/**/*.ts",
    "app/**/*.tsx",
    "components/**/*.tsx",
    ".next/types/**/*.ts",
    "tests/**/*.ts",
    "tests/**/*.tsx"
  ]
}
```

---

## 🎯 Next Steps

1. **Start with unit tests** - Test your `lib/` functions first
2. **Add component tests** - Test React components
3. **Add API tests** - Test your API routes
4. **Expand E2E tests** - Add more Playwright tests

See `TESTING_FRAMEWORK_RECOMMENDATIONS.md` for detailed examples and best practices.

---

## 🔍 Troubleshooting

### Issue: Vitest can't find modules
**Solution:** Make sure `vitest.config.ts` has the correct path aliases matching your `tsconfig.json`.

### Issue: Playwright tests fail
**Solution:** Run `npx playwright install` to install browser binaries.

### Issue: React Testing Library errors
**Solution:** Make sure `jsdom` is installed and `environment: 'jsdom'` is set in `vitest.config.ts`.

### Issue: TypeScript errors in tests
**Solution:** Add `vitest/globals` to your TypeScript types or use `import { describe, it, expect } from 'vitest'` in each test file.

---

## 📚 Commands Reference

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run with coverage
npm run test:coverage

# Run only unit tests
npm run test:unit

# Run only component tests
npm run test:components

# Run only API tests
npm run test:api

# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run all tests (unit + components + API + E2E)
npm run test:all
```

---

**That's it!** You now have a comprehensive testing framework set up without changing any of your existing code. Start writing tests incrementally and build up your test coverage over time.



