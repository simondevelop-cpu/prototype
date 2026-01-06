# Test Viewing Guide

## Quick Summary

### View Test Summary (What Tests Exist)

Run the test summary generator to see all tests and their status:

```bash
npm run test:summary
```

This generates `TEST_SUMMARY.md` with:
- List of all test files
- Test cases (implemented, todo, skipped)
- Coverage by test type (unit, integration, security, e2e)

### View Coverage Report (What Code is Tested)

#### Option 1: HTML Coverage Report (Recommended)

After running tests with coverage:

```bash
npm run test:coverage
```

Then open the HTML report:
```bash
open coverage/index.html
# Or on Windows: start coverage/index.html
# Or on Linux: xdg-open coverage/index.html
```

The HTML report shows:
- **File-by-file coverage** (statements, branches, functions, lines)
- **Uncovered lines** highlighted
- **Interactive navigation** through your codebase

#### Option 2: Terminal Coverage Report

The coverage command also prints a summary table in the terminal showing:
- Overall coverage percentages
- Coverage per file
- Uncovered line numbers

#### Option 3: CI/CD Artifacts

In GitHub Actions, if tests fail, coverage reports are uploaded as artifacts:
1. Go to the failed workflow run
2. Scroll to "Artifacts" section
3. Download `coverage-report`
4. Extract and open `index.html`

## Test Types Overview

### Unit Tests (`tests/unit/`)
- **Purpose**: Test individual functions/modules in isolation
- **Coverage**: Utilities, helpers, pure functions
- **Run**: `npm run test:unit`

### Integration Tests (`tests/integration/`)
- **Purpose**: Test API routes, database operations, full request/response cycles
- **Coverage**: API endpoints, data migrations, PIPEDA compliance
- **Run**: `npm run test:integration`

### Security Tests (`tests/security/`)
- **Purpose**: Test security features (auth, CSRF, rate limiting, password validation)
- **Coverage**: Security-critical code paths
- **Run**: `npm run test:security`

### E2E Tests (`tests/e2e/`)
- **Purpose**: Test full user journeys through the UI
- **Status**: Currently skipped (see `TEST_STRATEGY.md`)
- **Run**: `npm run test:e2e`

## Current Test Coverage

### Well-Tested Areas ✅
- Authentication (login/register) - 57-64% coverage
- Password validation - 91% coverage
- JWT validation - 85% coverage
- CSRF protection - 76% coverage
- Transaction API (new) - Full CRUD + authorization tests

### Needs More Tests 📝
- Most API routes (0% coverage)
- React components (0% coverage)
- PDF parsing (0% coverage)
- Tokenization utilities (0% coverage)

## Viewing Test Results in CI/CD

### GitHub Actions

1. **Go to Actions tab** in your GitHub repo
2. **Click on a workflow run** (e.g., "Tests")
3. **Expand "Unit & Integration Tests"** job
4. **View test output** in the logs

The logs show:
- ✅ Passing tests
- ❌ Failing tests with error details
- ⏭️ Skipped tests
- 📝 Todo tests

### Test Summary Artifacts

If tests fail, artifacts are uploaded:
- `coverage-report/` - HTML coverage report
- `playwright-report/` - E2E test results (if E2E tests run)

## Tips

1. **Run tests locally before pushing**:
   ```bash
   npm test
   ```

2. **Watch mode for development**:
   ```bash
   npm run test:watch
   ```

3. **Run specific test file**:
   ```bash
   npx vitest run tests/integration/api/auth.test.ts
   ```

4. **View test UI** (interactive):
   ```bash
   npm run test:ui
   ```

5. **Check what's not tested**:
   - Look at coverage report for files with 0% coverage
   - Check `TEST_SUMMARY.md` for skipped/todo tests

## Next Steps

To increase coverage:
1. Add API integration tests for routes with 0% coverage
2. Add component tests for React components
3. Gradually increase coverage thresholds in `vitest.config.ts`

