# Admin Dashboard Risks and Mitigations

This document identifies new risks introduced by the admin dashboard features and recommended mitigations.

## Security Risks

### 1. Admin Authentication Bypass
**Risk**: Unauthorized access to admin endpoints could expose sensitive user data.

**Mitigation**:
- JWT token validation on all admin endpoints
- Role-based access control (admin role required)
- Token expiration (1 day)
- Environment variable for JWT_SECRET (not hardcoded in production)

**Test Coverage**: 
- Authentication tests verify token validation
- Authorization tests verify role checks

### 2. SQL Injection
**Risk**: User input in filters could be used for SQL injection attacks.

**Mitigation**:
- Parameterized queries for all user input
- Array casting for PostgreSQL ANY() clauses (`::text[]`)
- No direct string concatenation in SQL queries
- Filter validation before query construction

**Test Coverage**:
- Security tests verify SQL injection protection
- Integration tests verify filter parameter handling

### 3. Data Exposure
**Risk**: Admin dashboard exposes PII (email, last name) in customer data.

**Mitigation**:
- PII removed from Customer Data and Events Data tables (only user ID and first name shown)
- Admin-only access (authentication required)
- No PII in vanity metrics or cohort analysis

**Test Coverage**:
- Integration tests verify PII exclusion
- E2E tests verify UI doesn't display PII

## Data Integrity Risks

### 4. Incorrect Metric Calculations
**Risk**: Metrics calculated incorrectly could lead to wrong business decisions.

**Mitigation**:
- Comprehensive documentation of all metrics (see ADMIN_DASHBOARD_METRICS.md)
- Unit tests for metric calculations
- Integration tests verify calculations against known data
- Schema-adaptive queries handle missing columns gracefully

**Test Coverage**:
- Unit tests for each metric calculation
- Integration tests with known test data
- Manual verification against production data

### 5. Filter Logic Errors
**Risk**: Filters not working correctly could show incorrect data.

**Mitigation**:
- Consistent filter implementation across all endpoints
- Parameter index tracking to prevent mismatches
- Date conversion to ISO strings for timestamp queries
- Extensive logging (in development) for debugging

**Test Coverage**:
- Integration tests for each filter type
- Tests for filter combinations
- Edge case testing (empty filters, invalid values)

### 6. Week Calculation Errors
**Risk**: Incorrect week boundaries could misalign data.

**Mitigation**:
- Consistent week calculation (Sunday start for display, Monday start for PostgreSQL)
- Helper function `formatWeekLabel` for consistent formatting
- Fallback to last 12 weeks if no data

**Test Coverage**:
- Unit tests for week calculation logic
- Integration tests verify week boundaries

## Performance Risks

### 7. Slow Queries
**Risk**: Complex queries with multiple JOINs could be slow with large datasets.

**Mitigation**:
- Indexes on frequently queried columns (user_id, created_at, event_timestamp)
- Efficient subqueries for aggregations
- LIMIT clauses where appropriate
- Schema-adaptive queries avoid unnecessary JOINs

**Test Coverage**:
- Performance tests with large datasets
- Query execution time monitoring

### 8. N+1 Query Problem
**Risk**: Engagement chart queries login days per user sequentially.

**Mitigation**:
- Current implementation queries per user (acceptable for admin dashboard)
- Could be optimized with batch queries if performance becomes issue
- Admin dashboard has lower traffic than user-facing features

**Test Coverage**:
- Performance tests verify acceptable query times

## Schema Evolution Risks

### 9. Migration State Confusion
**Risk**: Code checking both `users` and `onboarding_responses` tables could cause confusion.

**Mitigation**:
- Clear documentation of migration state
- Schema-adaptive queries check for data existence
- Single source of truth (users table post-migration)
- Migration status endpoint for verification

**Test Coverage**:
- Integration tests verify schema adaptation
- Tests for both pre and post-migration states

### 10. Missing Column Handling
**Risk**: Missing columns could cause query failures.

**Mitigation**:
- Schema checks before using columns
- Graceful degradation (return 0 or null)
- Try-catch blocks around schema checks

**Test Coverage**:
- Tests with missing columns
- Tests with missing tables

## Business Logic Risks

### 11. Cohort Filter Misunderstanding
**Risk**: Cohort filter in vanity metrics only affects display, not user counts (unexpected behavior).

**Mitigation**:
- Clear documentation in code comments
- Consistent behavior across all endpoints
- UI clearly indicates which filters affect data vs display

**Test Coverage**:
- Integration tests verify cohort filter behavior
- Documentation tests verify comments are accurate

### 12. Time Calculation Errors
**Risk**: Time to upload calculations could be incorrect (minutes vs days).

**Mitigation**:
- Direct minute calculation for first-day uploads (not converted from days)
- Clear documentation of time units
- Separate calculations for first day vs after first day

**Test Coverage**:
- Unit tests verify time calculations
- Integration tests with known timestamps

## Testing Gaps

### Current Test Coverage
- ✅ Unit tests structure created
- ✅ Integration tests structure created
- ✅ E2E tests structure created
- ⚠️ Tests are currently skipped (require test database setup)

### Recommended Next Steps
1. Set up test database with pg-mem or test PostgreSQL instance
2. Implement authentication test helpers
3. Create test data fixtures
4. Implement unit tests for metric calculations
5. Implement integration tests for API endpoints
6. Implement E2E tests for UI
7. Add performance tests for large datasets

## Monitoring Recommendations

1. **Error Logging**: Monitor console.error logs for API failures
2. **Query Performance**: Monitor query execution times
3. **Authentication Failures**: Track failed authentication attempts
4. **Data Anomalies**: Alert on unexpected metric values (e.g., negative counts)
5. **Schema Changes**: Monitor for missing columns/tables

