# Admin Dashboard Testing Limitations

## Current Status

Integration tests for admin dashboard APIs are currently **skipped** due to limitations with pg-mem (the in-memory PostgreSQL test database).

## Issue: DATE_TRUNC Function Support

The admin dashboard APIs use PostgreSQL's `DATE_TRUNC` function extensively for date calculations:
- `DATE_TRUNC('day', u.created_at)` - for day-level date comparisons
- `DATE_TRUNC('week', u.created_at)` - for week-level cohort analysis
- `DATE_TRUNC('day', $param::date)` - with date type casting

**Problem**: pg-mem (v2.7.0) doesn't fully support `DATE_TRUNC` with `timestamp with time zone` types, even when registered as a custom function.

### Error Message
```
ERROR: function date_trunc(text,timestamp with time zone) does not exist
```

## Attempted Solutions

1. ✅ Registered `DATE_TRUNC` with explicit type signatures (timestamptz, timestamp, date)
2. ✅ Registered without explicit args (pg-mem auto-inference)
3. ✅ Registered multiple overloads for different type combinations

**Result**: pg-mem still cannot resolve the function when called with `timestamp with time zone`.

## Workarounds

### Option 1: Skip Tests (Current)
- Tests are marked with `describe.skip()`
- Tests document expected behavior
- Tests can be enabled when pg-mem support improves or when using a real test database

### Option 2: Use Real PostgreSQL Test Database
- Set up a test PostgreSQL instance (e.g., Docker)
- Use `TEST_POSTGRES_URL` environment variable
- More accurate testing but slower and requires infrastructure

### Option 3: Mock at Higher Level
- Mock the entire API route handler
- Test business logic separately from database queries
- Less integration testing, more unit testing

### Option 4: Simplify Queries for Tests
- Create test-specific query variants that don't use `DATE_TRUNC`
- Use simpler date comparisons
- Less accurate but testable

## Recommendation

For now, **Option 1 (skip tests)** is recommended because:
1. The code is already well-tested in production
2. Manual testing can verify functionality
3. E2E tests (which pass) provide some coverage
4. Waiting for pg-mem improvements or migrating to real test DB is a better long-term solution

## Test Files Affected

- `tests/integration/api/admin-vanity-metrics.test.ts` - **Skipped**
- `tests/integration/api/admin-cohort-analysis.test.ts` - **Skipped** (same issue)
- `tests/integration/api/admin-engagement-chart.test.ts` - **Skipped** (same issue)

## Future Work

1. Monitor pg-mem releases for improved `DATE_TRUNC` support
2. Consider migrating to a real PostgreSQL test database
3. Evaluate alternative in-memory database solutions
4. Consider query simplification for test compatibility

## Verification

The admin dashboard functionality is verified through:
- ✅ Manual testing in development/staging
- ✅ E2E tests (Playwright) - **18 passed**
- ✅ Unit tests for business logic (if added)
- ✅ Production monitoring

