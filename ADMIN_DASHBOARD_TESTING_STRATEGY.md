# Admin Dashboard Testing Strategy

## Overview
This document outlines the testing strategy for validating the Admin Dashboard functionality, particularly when there is no or minimal data available.

## Testing Approach for Empty/Minimal Data States

### 1. **Unit Tests** (Component-level)

#### Focus Areas:
- **Empty State Rendering**: Verify that tables show structure even with empty data
- **Filter Components**: Test `CheckboxDropdown` component with empty options
- **Data Transformation**: Test functions that format cohort/vanity data with missing fields

#### Example Tests:
```typescript
// tests/unit/admin/empty-state.test.ts
- CheckboxDropdown renders correctly with empty options
- Cohort table shows 12 week columns even with no data
- Vanity metrics table shows all 12 months even with no data
- Customer data table shows all columns even with empty array
- Export function handles empty customer data gracefully
```

### 2. **Integration Tests** (API-level)

#### Focus Areas:
- **API Endpoints with Empty Data**: Verify APIs return proper structure when no data exists
- **Schema-Adaptive Queries**: Test that queries work both pre and post migration
- **Filter Logic**: Test that filters work correctly with empty result sets

#### Example Tests:
```typescript
// tests/integration/api/admin/cohort-analysis.test.ts
- GET /api/admin/cohort-analysis returns proper structure with no users
- GET /api/admin/cohort-analysis returns 12 weeks even with empty data
- GET /api/admin/vanity-metrics returns 12 months even with no transactions
- GET /api/admin/customer-data returns empty array when no users exist
- GET /api/admin/intent-categories returns empty array when no intent data
- GET /api/admin/engagement-chart handles missing user_events table gracefully
```

#### Critical API Tests:
1. **Cohort Analysis API** (`/api/admin/cohort-analysis`)
   - Returns `weeks` array with 12 week labels even if no users
   - Returns `activation` and `engagement` objects with zero/null values
   - Handles filters correctly (totalAccounts, validatedEmails, intentCategories)

2. **Vanity Metrics API** (`/api/admin/vanity-metrics`)
   - Returns `months` array with 12 months (Jan-Dec 2026)
   - Returns all metrics (totalUsers, MAU, newUsers, etc.) with zero values
   - Handles filters correctly

3. **Customer Data API** (`/api/admin/customer-data`)
   - Returns empty array when no users
   - Includes all required fields (user_id, email_validated, is_active, etc.) even if NULL
   - Works with both pre and post migration schemas

4. **Block User API** (`/api/admin/users/block`)
   - Creates `is_active` column if it doesn't exist
   - Updates user status correctly
   - Returns proper success/error responses

### 3. **E2E Tests** (User Journey)

#### Focus Areas:
- **Dashboard Load**: Verify dashboard loads and displays correctly with no data
- **Tab Navigation**: Test switching between Analytics sub-tabs
- **Filter Interaction**: Test filter dropdowns and refresh buttons
- **Export Functionality**: Test CSV export with empty/minimal data
- **Block User Flow**: Test blocking and enabling users from Accounts tab

#### Example E2E Tests:
```typescript
// tests/e2e/admin/dashboard-empty-state.spec.ts
- Admin dashboard loads successfully with no users
- Cohort Analysis tab shows table structure with 12 weeks and all metrics
- Vanity Metrics tab shows table structure with 12 months
- Customer Data tab shows empty state message but table headers are visible
- Export button is disabled when no customer data exists
- Refresh buttons work correctly and show loading states
- Filters render correctly even with empty options
```

```typescript
// tests/e2e/admin/accounts-block-user.spec.ts
- Accounts tab loads and displays all users
- Block button appears for each user
- Clicking Block button disables user and updates UI
- Blocked user cannot login (tested separately in login.spec.ts)
- Enable button appears for blocked users
- Clicking Enable button re-enables user
```

#### Critical E2E Scenarios:

1. **Empty Dashboard State**
   - Navigate to `/admin`
   - Click "Analytics" → "Cohort Analysis"
   - Verify table shows all columns and 12 week headers
   - Verify all metric rows are present (even with 0/- values)
   - Click "Refresh Data" → Verify loading spinner appears
   - Verify no errors in console

2. **Tab Navigation**
   - Navigate between Customer Data, Cohort Analysis, Vanity Metrics, App Health
   - Verify each tab loads without errors
   - Verify table structures are visible even with no data

3. **Filter Interaction**
   - Open Intent Categories dropdown → Verify it opens/closes correctly
   - Select/deselect filter options → Verify state updates
   - Click "Refresh Data" → Verify filters are applied to API call

4. **Export Functionality**
   - Navigate to Customer Data tab
   - With no data: Verify export button is disabled
   - With data: Click export → Verify CSV downloads with correct headers
   - Verify CSV includes all columns (User ID, Email Validated, Is Active, etc.)

5. **Block User Flow**
   - Navigate to Accounts tab
   - Find a user → Verify Block/Enable button is visible
   - Click Block → Verify button changes to "Enable"
   - Verify user's `is_active` status is updated
   - Attempt login with blocked user → Verify login is rejected

## Testing with Minimal Data

### Test Data Setup:
1. **Create 1-2 test users** with minimal onboarding data
2. **Create 1-2 transactions** for one user
3. **Test dashboard rendering** with this minimal dataset

### What to Verify:
- Tables show correct data where it exists
- Empty columns show 0 or "-" appropriately
- Filters work correctly with partial data
- Export includes only available data

## Test Implementation Priority

### High Priority (Critical for functionality):
1. ✅ Empty state table rendering (structure visible)
2. ✅ API endpoints return proper structure with no data
3. ✅ Block/Enable user functionality
4. ✅ Customer Data export with all variables
5. ✅ Login blocking for disabled users

### Medium Priority (Important for UX):
1. Filter dropdown interactions
2. Loading states and spinners
3. Error handling (network failures, API errors)
4. Tab navigation smoothness

### Lower Priority (Nice to have):
1. Visual polish (empty state messages)
2. Performance with large datasets
3. Accessibility (keyboard navigation, screen readers)

## Recommended Test Files to Create

1. **`tests/integration/api/admin/cohort-analysis.test.ts`**
   - Test cohort analysis API with empty data
   - Test filter application
   - Test week calculation logic

2. **`tests/integration/api/admin/vanity-metrics.test.ts`**
   - Test vanity metrics API with empty data
   - Test month range calculation
   - Test metric calculations

3. **`tests/integration/api/admin/customer-data.test.ts`**
   - Test customer data API returns all required fields
   - Test schema-adaptive queries
   - Test export data structure

4. **`tests/integration/api/admin/block-user.test.ts`**
   - Test block/unblock user API
   - Test login blocking for disabled users
   - Test schema creation (is_active column)

5. **`tests/e2e/admin/dashboard-empty-state.spec.ts`**
   - Test dashboard UI with no data
   - Test table structure visibility
   - Test filter interactions

6. **`tests/e2e/admin/accounts-block-user.spec.ts`**
   - Test block user UI flow
   - Test button states and interactions

## Running Tests

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests (requires test database or DISABLE_DB=1)
npm run test:e2e

# All tests
npm test
```

## Notes

- **Schema-Adaptive Testing**: Many tests need to work both pre and post migration. Use schema checks in test setup.
- **Mock Data**: For E2E tests, consider using a seed script to create minimal test data.
- **CI/CD**: Ensure tests pass in GitHub Actions with minimal/no data setup.

