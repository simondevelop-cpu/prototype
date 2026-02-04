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
   - **RED TEXT REQUIREMENT:** This should hold master on ALL events we are capturing
   - **CRITICAL:** Log each event once as a separate row (no aggregation)
   - Every event type (login, transaction_edit, bulk_edit, consent, feedback, etc.) should be a separate row
   - This is the single source of truth for all event data
   - Verify all event types are being logged:
     - User events: login, transaction_edit, bulk_edit, statement_upload, statement_linked, consent, feedback
     - Admin events: admin_login, admin_tab_access, admin_data_download
     - Any other events we're capturing

### Renames with Schema Changes
1. `l0_category_list` → `l1_admin_categorisation_list`
2. `l0_insight_list` → `l1_admin_insights_list`
3. `admin_categorization_learning` → `l2_user_categorization_learning`
   - **Schema Changes Required (RED TEXT REQUIREMENTS):**
     - Add `previous_category` column to track what category was changed FROM
     - **CRITICAL:** Log every category change ever made as a separate row (full audit trail)
     - Each time a user changes a category, create a new row with:
       - `previous_category` = the old category
       - `category` = the new category
       - `description_pattern` = the transaction description pattern
       - `user_id` = the user who made the change
       - Timestamp of when the change was made
     - This ensures complete history of all categorization changes

### Consolidations (RED TEXT REQUIREMENTS)
1. **Combine `l1_users` + `l2_customer_summary_view` → `l1_customer_facts`**
   - **RED TEXT REQUIREMENT:** "combine with l1_customer facts - fix all the functionality, APIs, etc. - let's migrate"
   - This is a complex migration requiring:
     - **Data mapping:** Map all columns from both source tables to target
     - **API endpoint updates:** Update all endpoints that reference `l1_users` or `l2_customer_summary_view`
     - **Query updates:** Update all queries, views, and reports
     - **Functionality fixes:** Ensure all user-related functionality works with consolidated table
     - **Comprehensive testing:** Test all user management, analytics, and reporting features
   - **Migration Steps:**
     1. Analyze schema differences between all three tables
     2. Create unified schema for `l1_customer_facts`
     3. Map and migrate data from both source tables
     4. Update all code references
     5. Test thoroughly
     6. Drop old tables after verification period

### Tables to Review/Remove (RED TEXT REQUIREMENT)
- `l2_transactions_view` 
  - **RED TEXT QUESTION:** "Is this needed at all? Seems duplicative to the l1_transaction_facts table"
  - **Action Required:** 
    - Analyze if this view provides any unique functionality
    - Check if any code references this view
    - If duplicative, remove it during migration cleanup phase
    - If it provides aggregations/calculations, consider if those should be in `l1_transaction_facts` or a different view

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

### 5. Foreign Keys (RED TEXT REQUIREMENT)
**Question:** "Does Foreign Keys sheet have all of the foreign key logic? Is there anything connecting events, sessions and transactions to each other?"

**Action Required:**
- **Comprehensive Review:** Audit all foreign key relationships in the database
- **Document Missing Relationships:** Identify any relationships not currently documented
- **Verify Interconnections:**
  - **Events ↔ Sessions:** `l1_event_facts.session_id` should link to session tracking
  - **Events ↔ Transactions:** `l1_event_facts` metadata may reference `l1_transaction_facts.id` for transaction_edit/bulk_edit events
  - **Sessions ↔ Users:** Sessions are tied to `user_id` in `l1_event_facts`
  - **Transactions ↔ Users:** `l1_transaction_facts.tokenized_user_id` links to `l0_user_tokenization` which links to users
- **Update Foreign Keys Sheet:** Ensure all relationships are documented
- **Add Missing Foreign Keys:** If relationships exist but aren't enforced, add proper foreign key constraints

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

