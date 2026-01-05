# pg-mem Integration Tests Setup Issue

## Problem

Integration tests using `pg-mem` are failing with `ECONNREFUSED ::1:5432` errors. The tests are trying to connect to a real PostgreSQL instance instead of using pg-mem's in-memory database.

## Error

```
Error: connect ECONNREFUSED ::1:5432
❯ node_modules/pg-pool/index.js:45:11
❯ tests/integration/pipeda/pii-isolation.test.ts:28:5
```

## Root Cause

The `db.adapters.createPg().connectionString` pattern is returning a connection string that points to a real PostgreSQL instance (`::1:5432` - IPv6 localhost), not pg-mem's in-memory database.

## Current Code Pattern (Not Working)

```typescript
const db = newDb();
const connectionString = db.adapters.createPg().connectionString;
const pool = new Pool({ connectionString });
await pool.query('SELECT 1');
```

This pattern causes the Pool to try to connect to a real PostgreSQL instance.

## Possible Solutions

### Option 1: Use pg-mem's Native Query API (If Available)
Use pg-mem's native query methods directly instead of using Pool:
```typescript
const db = newDb();
db.public.query('SELECT 1');
```

**Note:** This requires understanding pg-mem's native API, which may differ from the Pool API.

### Option 2: Use pg-mem Adapter Correctly
The adapter might need to be used differently. Research pg-mem v2.7.x documentation for the correct pattern.

### Option 3: Use Test Database Instead
Set up a real test database (e.g., Docker PostgreSQL container) for integration tests instead of using pg-mem.

### Option 4: Skip Integration Tests for Now
Skip these tests until pg-mem setup can be properly configured. Focus on unit tests and E2E tests.

## Current Status

All integration tests using pg-mem have been skipped (`describe.skip()`) until this issue is resolved.

## Resources

- pg-mem GitHub: https://github.com/oguimbal/pg-mem
- pg-mem npm: https://www.npmjs.com/package/pg-mem
- Version used: `pg-mem@^2.7.0`

## Next Steps

1. Research pg-mem v2.7.x documentation for correct adapter usage
2. Try alternative patterns (native API, different adapter method)
3. Consider using a test database instead of pg-mem
4. Implement one of the solutions above
5. Re-enable integration tests

