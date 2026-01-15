# Test Strategy & Coverage Plan

## Current Status

✅ **Working:**
- Unit tests (security, categorization) - 50+ tests passing
- Database integration tests (pg-mem) - 19 tests passing
  - Data deduplication
  - Migration integrity
  - PIPEDA compliance (account deletion, data export, PII isolation)

❌ **Issues:**
- API integration tests - All skipped (need to test actual API endpoints)
- E2E tests - All skipped (Playwright finds no tests)
- Coverage: 2.69% (threshold: 20%) - Too low because API routes aren't tested

## The Problem

**Current integration tests only test database operations in isolation:**
- They use pg-mem to test SQL queries directly
- They don't test API route handlers
- They don't test request/response cycles
- They don't test authentication, authorization, or business logic

**Result:** Coverage is low because application code (API routes, components) isn't executed.

## Solution: Two Types of Integration Tests

### 1. **Database Integration Tests** (Keep These)
- Test data integrity, migrations, schema
- Use pg-mem for fast, isolated database testing
- Examples: deduplication, migration-integrity, PII isolation
- **Status:** ✅ Working

### 2. **API Integration Tests** (Need to Add)
- Test actual API route handlers
- Mock `getPool()` to use pg-mem
- Test full request/response cycle
- Test authentication, authorization, validation
- **Status:** ❌ Need to implement

## Implementation Plan

### Phase 1: API Integration Tests (Priority)

**Goal:** Test API endpoints end-to-end to increase coverage

**Approach:**
1. Use pg-mem for test database
2. Mock `getPool()` to return pg-mem pool
3. Call actual API route handlers (`POST`, `GET`, etc.)
4. Verify responses, status codes, data

**Tests to Add:**
- ✅ Authentication API (`/api/auth/login`, `/api/auth/register`)
- ⏭️ Authorization API (user data isolation)
- ⏭️ Transactions API (`/api/transactions`)
- ⏭️ Account management API (`/api/account`, `/api/account/export`)
- ⏭️ PIPEDA endpoints (account deletion, data export)

**Expected Coverage Increase:**
- API routes: 0% → ~60-80%
- Overall: 2.69% → ~15-25%

### Phase 2: E2E Tests (Lower Priority)

**Goal:** Test full user journeys in browser

**Approach:**
1. Start test server with pg-mem database
2. Use Playwright to test UI flows
3. Test critical user journeys

**Tests to Add:**
- Login flow
- Account deletion flow
- Data export flow

**Expected Coverage Increase:**
- Components: 0% → ~30-50%
- Overall: ~15-25% → ~20-30%

### Phase 3: Component Tests (Future)

**Goal:** Test React components in isolation

**Approach:**
- Use React Testing Library
- Mock API calls
- Test component logic and rendering

## Current Test Breakdown

### ✅ Working Tests (69 passing)

**Unit Tests:**
- Security: JWT, CSRF, password validation, rate limiting
- Categorization: Engine, rules

**Database Integration Tests:**
- Deduplication (4 tests)
- Migration integrity (4 tests)
- PIPEDA: Account deletion (3 tests)
- PIPEDA: Data export (3 tests)
- PIPEDA: PII isolation (5 tests)

**Total:** 19 integration tests + 50 unit tests = 69 tests

### ❌ Missing Tests (Need to Add)

**API Integration Tests:**
- Authentication endpoints (login, register)
- Authorization (user data isolation)
- Transaction endpoints
- Account management endpoints
- PIPEDA endpoints (via API)

**E2E Tests:**
- Login flow
- Account deletion
- Data export

## Next Steps

1. ✅ **Implement API integration tests for auth** (in progress)
2. ⏭️ **Implement API integration tests for transactions**
3. ⏭️ **Implement API integration tests for account management**
4. ⏭️ **Re-enable E2E tests** (at least one smoke test)
5. ⏭️ **Measure coverage increase** and adjust as needed

## Coverage Goals

**Current:** 2.69% (threshold: 20%)
**Target:** 20%+ (meet thresholds)
**Long-term:** 80%+ (ambitious goal)

**Strategy:**
- API integration tests should get us to ~15-25%
- E2E tests should get us to ~20-30%
- Component tests would get us to 80%+

## Key Insight

**Database integration tests are valuable but don't increase coverage much** because they:
- Test SQL queries directly
- Don't execute application code (API routes, components)
- Are fast and reliable ✅
- Provide data integrity confidence ✅

**API integration tests are essential for coverage** because they:
- Execute actual API route handlers
- Test full request/response cycles
- Test authentication, authorization, validation
- Will significantly increase coverage 📈

