# Database Migration Plan: Table Renaming and Consolidation

## Overview
This document outlines the migration plan for renaming and consolidating database tables based on the new naming convention and requirements.

## Migration Strategy
**Recommendation: Admin App Tab** - This provides:
- Visual progress tracking
- Ability to run pre/post migration tests
- Rollback capability
- Better error handling and logging
- Can be run multiple times safely (idempotent)

## Table Renames

### Simple Renames (No Schema Changes)
1. `admin_keywords` → `l1_admin_keywords`
2. `admin_merchants` → `l1_admin_merchants`
3. `admin_available_slots` → `l1_admin_available_slots`
4. `admin_chat_bookings` → `l1_admin_chat_bookings`
5. `onboarding_responses` → `l1_onboarding_responses`
6. `survey_responses` → `l1_survey_responses`
7. `l1_events` → `l1_event_facts`

### Renames with Schema Changes
1. `l0_category_list` → `l1_admin_categorisation_list`
2. `l0_insight_list` → `l1_admin_insights_list`
3. `admin_categorization_learning` → `l2_user_categorization_learning`
   - **Schema Changes Required:**
     - Add `previous_category` column
     - Ensure every category change is logged as a separate row (audit trail)

### Consolidations
1. **Combine `l1_users` + `l2_customer_summary_view` → `l1_customer_facts`**
   - This is a complex migration requiring:
     - Data mapping between tables
     - API endpoint updates
     - View/query updates
     - Testing all user-related functionality

### Tables to Review
- `l2_transactions_view` - Question: Is this needed? Seems duplicative of `l1_transaction_facts`

## Questions to Address

### 1. Consent API
**Question:** Is there a reason Consent is not a PUT? Since it should just be capturing the first time? Are there any risks?

**Answer:** Consent should use `INSERT ... ON CONFLICT DO NOTHING` (which we already have). Using PUT would require checking if consent exists first, which could have race conditions. The current POST with unique constraint is safer.

### 2. Batch Learning API
**Question:** What is the batch learning API? Do we need it?

**Answer:** 
- Endpoint: `/api/categorization/batch-learn` (POST)
- Purpose: Allows learning from multiple categorization corrections at once (more efficient than individual calls)
- Usage: Accepts array of corrections with `{description, originalCategory, originalLabel, correctedCategory, correctedLabel}`
- **Recommendation:** Keep it - it's useful for bulk operations and improves performance
- **Migration Note:** Will need to update table reference from `categorization_learning` to `l2_user_categorization_learning`

### 3. Refresh API
**Question:** How does the refresh API work?

**Answer:**
- Endpoint: `/api/auth/refresh` (POST)
- Purpose: Refreshes JWT tokens to extend session without re-login
- Logic: 
  - Validates current token
  - Checks token age (must be < 5 minutes 20 seconds)
  - Issues new token with 5-minute 20-second expiration
  - Used by `api-client.ts` to automatically refresh tokens before expiration
- **Status:** Working correctly, no changes needed for migration

### 4. Legacy Transaction ID
**Question:** Legacy transaction ID on transaction facts still being used?

**Answer:**
- **Yes, still being used** in migration-related code:
  - `/api/admin/migration/test-single-source/route.ts`
  - `/api/admin/migration/fix-unmigrated/route.ts`
  - `/api/admin/migration/investigate/route.ts`
  - `/api/admin/migration/verify-drop/route.ts`
- **Purpose:** Links migrated transactions back to old `transactions` table
- **Recommendation:** 
  - Keep column during migration period
  - Can be removed after verifying all data is migrated and old table is dropped
  - Add to migration cleanup phase

### 5. Foreign Keys
**Question:** Does Foreign Keys sheet have all of the foreign key logic? Is there anything connecting events, sessions and transactions to each other?

**Action:** Review all foreign key relationships and ensure they're documented.

## Pre-Migration Tests

### Data Integrity Tests
- [ ] Count records in each table before migration
- [ ] Verify all foreign key relationships are intact
- [ ] Check for orphaned records
- [ ] Verify data types match expected schema
- [ ] Check for NULL values in required fields

### Functional Tests
- [ ] User registration works
- [ ] User login works
- [ ] Transaction CRUD operations work
- [ ] Event logging works
- [ ] Admin dashboard loads correctly
- [ ] Analytics queries return correct data
- [ ] API endpoints respond correctly

### Schema Tests
- [ ] All expected columns exist
- [ ] All indexes exist
- [ ] All foreign keys are defined
- [ ] All unique constraints are defined

## Migration Steps

### Phase 1: Preparation
1. Create backup of database
2. Run pre-migration tests
3. Document current state
4. Create migration scripts

### Phase 2: Simple Renames
1. Rename tables (using `ALTER TABLE ... RENAME TO`)
2. Update all code references
3. Update foreign key constraints
4. Update indexes
5. Run post-rename tests

### Phase 3: Schema Changes
1. Add new columns (e.g., `previous_category`)
2. Migrate data to new structure
3. Update constraints
4. Run post-schema tests

### Phase 4: Consolidations
1. Map data from source tables
2. Merge into target table
3. Update all API endpoints
4. Update all queries
5. Run comprehensive tests
6. Drop old tables (after verification period)

### Phase 5: Cleanup
1. Remove unused views
2. Update documentation
3. Reorder sheets in Excel export
4. Final verification

## Post-Migration Tests

### Data Integrity Tests
- [ ] Record counts match pre-migration
- [ ] All foreign keys still work
- [ ] No orphaned records created
- [ ] Data types are correct
- [ ] No data loss occurred

### Functional Tests (Same as Pre-Migration)
- [ ] User registration works
- [ ] User login works
- [ ] Transaction CRUD operations work
- [ ] Event logging works
- [ ] Admin dashboard loads correctly
- [ ] Analytics queries return correct data
- [ ] API endpoints respond correctly

### New Feature Tests
- [ ] `l2_user_categorization_learning` logs every category change
- [ ] `previous_category` is populated correctly
- [ ] Consolidated `l1_customer_facts` has all expected data

## Rollback Plan
- Keep old table names as backups (rename with `_old` suffix)
- Maintain migration log
- Ability to revert code changes via git
- Database restore from backup if needed

## Implementation Notes

### Admin Tab Features
- Pre-migration test runner
- Migration execution with progress tracking
- Post-migration test runner
- Rollback functionality
- Migration log viewer
- Test results display (with flags for failed tests)

### Test Flags
Tests can be marked with:
- ✅ Pass
- ❌ Fail
- ⚠️ Warning
- ⏸️ Skipped
- 🔴 Critical (must pass before proceeding)

## Next Steps
1. Review and approve this plan
2. Answer clarifying questions
3. Create migration scripts
4. Build admin tab UI
5. Implement tests
6. Execute migration in staging
7. Verify and deploy

