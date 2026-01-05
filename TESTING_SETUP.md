# Testing Framework Setup Guide

**Status:** Ready for implementation  
**Framework:** Vitest (unit/integration), React Testing Library (components), Playwright (E2E)

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install --save-dev \
  vitest @vitest/ui \
  @vitejs/plugin-react \
  @testing-library/react \
  @testing-library/jest-dom \
  @testing-library/user-event \
  jsdom \
  pg-mem @types/pg-mem \
  happy-dom \
  @playwright/test
```

### 2. Run Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run security tests
npm run test:security

# Run E2E tests
npm run test:e2e

# Run with coverage
npm run test:coverage

# Watch mode (for development)
npm run test:watch

# UI mode (interactive)
npm run test:ui
```

---

## 📁 Test Directory Structure

```
tests/
  setup.ts                    # Global test setup
  unit/                       # Unit tests (Vitest)
    utils/
      date-parser.test.ts
    categorization/
      categorization-rules.test.ts
    parsing/
      pdf-parser.test.ts
  integration/                # Integration tests (Vitest)
    api/
      auth.test.ts
      transactions.test.ts
    db/
      migrations.test.ts
  security/                   # Security tests (Vitest)
    rate-limiting.test.ts
    password-validation.test.ts
    csrf.test.ts
  components/                 # Component tests (React Testing Library)
    modals/
      StatementUploadModal.test.tsx
      TransactionModal.test.tsx
  e2e/                        # E2E tests (Playwright)
    journeys/
      login.spec.ts
      signup.spec.ts
      upload-review.spec.ts
      account-deletion.spec.ts
```

---

## 🧪 Test Types

### Unit Tests (`tests/unit/`)
- **Purpose:** Test isolated functions/utilities
- **Tool:** Vitest
- **Scope:** Pure functions, regex patterns, parsing helpers
- **Examples:**
  - Date parsing utilities
  - Categorization rules
  - Amount/merchant normalization
  - Password validation

### Integration Tests (`tests/integration/`)
- **Purpose:** Test interactions between modules
- **Tool:** Vitest + pg-mem (in-memory DB)
- **Scope:** API routes, DB migrations, auth middleware
- **Examples:**
  - API route validation
  - Database schema migrations
  - Authentication flow
  - Deduplication logic

### Component Tests (`tests/components/`)
- **Purpose:** Test React components in isolation
- **Tool:** React Testing Library + Vitest
- **Scope:** UI components, forms, modals
- **Examples:**
  - Upload modal
  - Review modal
  - Category editor
  - Dashboard filters

### E2E Tests (`tests/e2e/`)
- **Purpose:** Test complete user journeys
- **Tool:** Playwright
- **Scope:** Full user workflows
- **Examples:**
  - Login/signup flow
  - Upload/review flow
  - Dashboard interactions
  - Account deletion

### Security Tests (`tests/security/`)
- **Purpose:** Test security measures
- **Tool:** Vitest
- **Scope:** Rate limiting, CSRF, password validation
- **Examples:**
  - Rate limiting enforcement
  - Password strength validation
  - CSRF protection
  - JWT token validation

---

## 🔧 Configuration Files

### `vitest.config.ts`
- Vitest configuration
- Coverage thresholds
- Test environment (jsdom for React)
- Path aliases

### `tests/setup.ts`
- Global test setup
- Mock configurations
- Environment variables
- Next.js mocks

### `.github/workflows/test.yml`
- GitHub Actions workflow
- Runs tests on push/PR
- Uploads artifacts on failure
- Test result summary

---

## 📊 Coverage Goals

- **Unit Tests:** 80% coverage
- **Integration Tests:** 75% coverage
- **E2E Tests:** Critical paths only
- **Overall:** 80% combined coverage

---

## 🎯 Implementation Checklist

### Phase 1: Foundation ✅
- [x] Vitest configuration
- [x] Test directory structure
- [x] GitHub Actions workflow
- [x] Test setup file

### Phase 2: Unit Tests (Next)
- [ ] Date parsing utilities
- [ ] Categorization rules
- [ ] Parsing helpers
- [ ] Password validation

### Phase 3: Integration Tests
- [ ] API route validation
- [ ] Database migrations
- [ ] Auth middleware
- [ ] Deduplication logic

### Phase 4: Component Tests
- [ ] Upload modal
- [ ] Review modal
- [ ] Category editor
- [ ] Dashboard filters

### Phase 5: E2E Tests
- [ ] Login/signup flows
- [ ] Upload/review flow
- [ ] Dashboard interactions
- [ ] Account deletion

### Phase 6: Security Tests
- [ ] Rate limiting
- [ ] Password validation
- [ ] CSRF protection
- [ ] JWT validation

---

## 🔍 Running Tests in CI

Tests run automatically on:
- Push to `main` branch
- Pull requests
- Push to `feature/**` branches

**CI Behavior:**
- Unit/integration tests run first
- E2E tests run in parallel
- Coverage report generated
- Artifacts uploaded only on failure
- Simple pass/fail summary in PR

---

## 📝 Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { validatePasswordStrength } from '@/lib/password-validation';

describe('Password Validation', () => {
  it('should accept valid passwords', () => {
    const result = validatePasswordStrength('Password123!');
    expect(result.valid).toBe(true);
  });
});
```

### Integration Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { newDb } from 'pg-mem';

describe('Database Migrations', () => {
  it('should create schema tables', async () => {
    const db = newDb();
    // Test migration...
  });
});
```

### Component Test Example

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import StatementUploadModal from '@/components/StatementUploadModal';

describe('StatementUploadModal', () => {
  it('should render upload button', () => {
    render(<StatementUploadModal isOpen={true} onClose={() => {}} />);
    expect(screen.getByText(/upload/i)).toBeInTheDocument();
  });
});
```

### E2E Test Example

```typescript
import { test, expect } from '@playwright/test';

test('should login with demo credentials', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /demo login/i }).click();
  await page.waitForURL(/\/(dashboard|$)/);
  await expect(page.locator('[data-testid="user-name"]')).toBeVisible();
});
```

---

## 🐛 Debugging Tests

### Vitest UI
```bash
npm run test:ui
```
Opens interactive UI for debugging tests.

### Playwright UI
```bash
npm run test:e2e:ui
```
Opens Playwright's interactive test runner.

### Watch Mode
```bash
npm run test:watch
```
Reruns tests on file changes.

---

## ✅ Next Steps

1. **Install dependencies** (see Quick Start)
2. **Run initial tests** to verify setup
3. **Implement unit tests** for utilities
4. **Add integration tests** for API routes
5. **Create component tests** for UI components
6. **Expand E2E tests** for user journeys
7. **Add security tests** for compliance

---

**Status:** Framework ready, waiting for dependency installation and test implementation.

