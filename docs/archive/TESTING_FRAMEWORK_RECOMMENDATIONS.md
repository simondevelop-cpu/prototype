# Comprehensive Testing Framework Recommendations

## 📋 Current State Analysis

**Existing:**
- ✅ Playwright configured (but not in package.json)
- ✅ One E2E smoke test (`tests/ui-smoke.spec.ts`)
- ✅ Playwright config file exists

**Missing:**
- ❌ Unit testing framework
- ❌ Component testing setup
- ❌ API route testing
- ❌ Test utilities and helpers
- ❌ Database testing utilities
- ❌ CI/CD test integration

---

## 🎯 Recommended Testing Stack

### 1. **Unit Testing: Vitest** (Recommended over Jest)
**Why Vitest:**
- Native TypeScript/ESM support
- Faster than Jest
- Better Next.js integration
- Compatible with Jest API (easy migration)
- Built-in coverage

**What to Test:**
- `lib/auth.ts` - Token creation, verification, password hashing
- `lib/categorization-engine.ts` - Pattern matching, learning logic
- `lib/pdf-parser.ts` - PDF parsing functions
- `lib/db.ts` - Database connection utilities
- Utility functions and helpers

### 2. **Component Testing: React Testing Library + Vitest**
**Why React Testing Library:**
- Tests components from user perspective
- Encourages accessible components
- Works seamlessly with Vitest

**What to Test:**
- `components/Dashboard.tsx` - Rendering, data display
- `components/TransactionsList.tsx` - Filtering, searching
- `components/CashflowChart.tsx` - Chart rendering
- `components/Login.tsx` - Form validation, submission
- All modal components

### 3. **API Route Testing: Vitest + Next.js Test Utilities**
**Why:**
- Test API routes in isolation
- Mock database calls
- Test authentication middleware
- Test request/response handling

**What to Test:**
- All `/app/api/**/route.ts` files
- Authentication flows
- Data validation
- Error handling
- Authorization checks

### 4. **E2E Testing: Playwright** (Already Configured)
**Enhancements Needed:**
- Add Playwright to package.json
- Add more comprehensive E2E tests
- Add visual regression testing
- Add API E2E tests

### 5. **Database Testing: Test Containers or Mocking**
**Options:**
- **Option A:** Use `DISABLE_DB=1` for unit tests (current approach)
- **Option B:** Use test database with transactions (rollback after tests)
- **Option C:** Use in-memory mocks for database calls

---

## 📦 Required Dependencies

### Core Testing Dependencies
```json
{
  "devDependencies": {
    "@playwright/test": "^1.40.0",
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.1.0",
    "@testing-library/jest-dom": "^6.1.0",
    "@testing-library/user-event": "^14.5.0",
    "@vitejs/plugin-react": "^4.2.0",
    "jsdom": "^23.0.0",
    "@vitest/ui": "^1.0.0",
    "msw": "^2.0.0"
  }
}
```

### Optional (Advanced)
```json
{
  "devDependencies": {
    "@faker-js/faker": "^8.0.0",
    "testcontainers": "^10.0.0",
    "@playwright/test": "^1.40.0"
  }
}
```

---

## 🗂️ Recommended Test Structure

```
prototype/
├── tests/
│   ├── e2e/                    # Playwright E2E tests
│   │   ├── auth.spec.ts
│   │   ├── transactions.spec.ts
│   │   ├── dashboard.spec.ts
│   │   └── api.spec.ts
│   │
│   ├── unit/                   # Vitest unit tests
│   │   ├── lib/
│   │   │   ├── auth.test.ts
│   │   │   ├── categorization-engine.test.ts
│   │   │   ├── pdf-parser.test.ts
│   │   │   └── db.test.ts
│   │   └── utils/
│   │
│   ├── components/             # Component tests
│   │   ├── Dashboard.test.tsx
│   │   ├── TransactionsList.test.tsx
│   │   ├── Login.test.tsx
│   │   └── CashflowChart.test.tsx
│   │
│   ├── api/                    # API route tests
│   │   ├── auth/
│   │   │   ├── login.test.ts
│   │   │   └── register.test.ts
│   │   ├── transactions/
│   │   │   └── route.test.ts
│   │   └── summary/
│   │       └── route.test.ts
│   │
│   └── helpers/                 # Test utilities
│       ├── test-db.ts           # Database test helpers
│       ├── test-auth.ts         # Auth test helpers
│       ├── mocks.ts             # Mock data
│       └── setup.ts             # Test setup
│
├── vitest.config.ts             # Vitest configuration
├── playwright.config.ts         # Already exists
└── .test.env                    # Test environment variables
```

---

## ⚙️ Configuration Files

### 1. `vitest.config.ts`
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

### 2. `tests/helpers/setup.ts`
```typescript
import '@testing-library/jest-dom';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock environment variables
process.env.JWT_SECRET = 'test-secret-key';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.DISABLE_DB = '1';
```

### 3. `tests/helpers/test-db.ts`
```typescript
import { Pool } from 'pg';

export function createTestPool(): Pool | null {
  if (process.env.DISABLE_DB === '1') return null;
  
  return new Pool({
    connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
  });
}

export async function cleanupTestData(pool: Pool, userId: number) {
  if (!pool) return;
  
  await pool.query('DELETE FROM transactions WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
}
```

### 4. `tests/helpers/test-auth.ts`
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

### 5. `tests/helpers/mocks.ts`
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

## 📝 Example Test Files

### Unit Test Example: `tests/unit/lib/auth.test.ts`
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

    it('should reject an expired token', () => {
      // Mock expired token
      const expiredToken = createToken(1);
      // Manually expire it (would need to adjust time in test)
      // This is a simplified example
    });
  });
});
```

### Component Test Example: `tests/components/Login.test.tsx`
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login from '@/components/Login';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('Login', () => {
  it('should render login form', () => {
    render(<Login />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('should show validation errors for empty fields', async () => {
    const user = userEvent.setup();
    render(<Login />);
    
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
    });
  });

  it('should submit form with valid data', async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'test-token', user: { id: 1 } }),
    });

    render(<Login />);
    
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/login'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });
});
```

### API Route Test Example: `tests/api/auth/login.test.ts`
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/auth/login/route';
import { createTestHeaders } from '../../helpers/test-auth';

// Mock database
vi.mock('@/lib/db', () => ({
  getPool: () => ({
    query: vi.fn(),
  }),
}));

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 for missing email', async () => {
    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password: 'password' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should return 401 for invalid credentials', async () => {
    // Mock database to return no user
    const { getPool } = await import('@/lib/db');
    const pool = getPool();
    if (pool) {
      vi.mocked(pool.query).mockResolvedValue({ rows: [] } as any);
    }

    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'wrong@example.com', password: 'wrong' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('should return 200 with token for valid credentials', async () => {
    // Mock database to return user
    const { getPool } = await import('@/lib/db');
    const pool = getPool();
    if (pool) {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [{
          id: 1,
          email: 'test@example.com',
          password_hash: 'hashed-password',
        }],
      } as any);
    }

    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'password' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.token).toBeDefined();
    expect(data.user).toBeDefined();
  });
});
```

### Enhanced E2E Test Example: `tests/e2e/auth.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should login with demo credentials', async ({ page }) => {
    await page.goto('/');
    
    await page.fill('input[type="email"]', 'demo@canadianinsights.ca');
    await page.fill('input[type="password"]', 'northstar-demo');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator('text=Taylor Nguyen')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/');
    
    await page.fill('input[type="email"]', 'wrong@example.com');
    await page.fill('input[type="password"]', 'wrong-password');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=/invalid credentials/i')).toBeVisible();
  });

  test('should register new user', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Create Account');
    
    await page.fill('input[name="name"]', 'New User');
    await page.fill('input[name="email"]', `test-${Date.now()}@example.com`);
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*dashboard/);
  });
});
```

---

## 🚀 Package.json Scripts

Add these scripts to `package.json`:

```json
{
  "scripts": {
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
  }
}
```

---

## 🔧 CI/CD Integration

### GitHub Actions Workflow: `.github/workflows/test.yml`
```yaml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:components
      - run: npm run test:api

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## 📊 Testing Strategy by Layer

### 1. **Unit Tests (70% coverage goal)**
- Pure functions (auth, categorization logic)
- Utility functions
- Business logic
- **Fast execution** (< 1 second per test)

### 2. **Component Tests (60% coverage goal)**
- User interactions
- Form validation
- Conditional rendering
- Props handling
- **Medium execution** (< 5 seconds per test)

### 3. **API Tests (80% coverage goal)**
- Request validation
- Authentication/authorization
- Error handling
- Response formatting
- **Medium execution** (< 3 seconds per test)

### 4. **E2E Tests (Critical paths only)**
- User journeys
- Integration between frontend/backend
- Real browser testing
- **Slow execution** (< 30 seconds per test)

---

## 🎯 Priority Implementation Order

### Phase 1: Foundation (Week 1)
1. ✅ Install all dependencies
2. ✅ Set up Vitest configuration
3. ✅ Create test helpers and utilities
4. ✅ Write unit tests for `lib/auth.ts`
5. ✅ Write unit tests for `lib/categorization-engine.ts`

### Phase 2: Components (Week 2)
1. ✅ Set up React Testing Library
2. ✅ Write tests for `components/Login.tsx`
3. ✅ Write tests for `components/Dashboard.tsx`
4. ✅ Write tests for `components/TransactionsList.tsx`

### Phase 3: API Routes (Week 3)
1. ✅ Write tests for `/api/auth/login`
2. ✅ Write tests for `/api/auth/register`
3. ✅ Write tests for `/api/transactions`
4. ✅ Write tests for `/api/summary`

### Phase 4: E2E Enhancement (Week 4)
1. ✅ Add Playwright to package.json
2. ✅ Expand E2E test coverage
3. ✅ Add visual regression tests
4. ✅ Set up CI/CD integration

---

## 🛠️ Testing Best Practices

### 1. **Test Organization**
- One test file per source file
- Group related tests with `describe` blocks
- Use descriptive test names

### 2. **Test Data**
- Use factories for test data
- Keep test data realistic
- Clean up after tests

### 3. **Mocks and Stubs**
- Mock external dependencies (database, APIs)
- Use MSW for API mocking
- Keep mocks simple and focused

### 4. **Assertions**
- Test behavior, not implementation
- Use meaningful error messages
- Test edge cases and error conditions

### 5. **Performance**
- Keep unit tests fast (< 1s)
- Run tests in parallel when possible
- Use test isolation

---

## 📈 Coverage Goals

- **Unit Tests:** 70%+ coverage
- **Component Tests:** 60%+ coverage
- **API Tests:** 80%+ coverage
- **E2E Tests:** All critical user paths

---

## 🔍 Debugging Tests

### Vitest
```bash
# Run with UI
npm run test:ui

# Run specific test
npm run test -- tests/unit/lib/auth.test.ts

# Run in watch mode
npm run test:watch
```

### Playwright
```bash
# Run with UI
npm run test:e2e:ui

# Debug mode
npm run test:e2e:debug

# Run specific test
npx playwright test tests/e2e/auth.spec.ts
```

---

## 📚 Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

---

## ✅ Next Steps

1. **Review this document** and adjust priorities based on your needs
2. **Install dependencies** (see package.json additions above)
3. **Set up configuration files** (vitest.config.ts, test helpers)
4. **Start with Phase 1** (unit tests for lib functions)
5. **Gradually expand** test coverage following the priority order

---

**Note:** This framework is designed to be implemented incrementally without changing existing code. You can add tests alongside your current codebase and gradually increase coverage.



